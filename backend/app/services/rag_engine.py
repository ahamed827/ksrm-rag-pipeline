"""The RAG engine: ties scraping, chunking, retrieval, guardrails and generation together.

Two entry points share the same preparation step (`_prepare`), so they can never disagree:
  ask()         -> complete RagResponse   (evaluation, CLI)
  ask_stream()  -> (event, data) tuples    (SSE chat endpoint)
"""
import logging
import threading
import time
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field

from ..config import Settings
from . import guardrails
from .chunker import chunk_pages
from .guardrails import Scope
from .llm import GeminiClient
from .reranker import Reranker
from .scraper import scrape_pages
from .vector_store import RetrievedChunk, VectorStore

logger = logging.getLogger(__name__)

INDEX_MISSING_MESSAGE = "The knowledge base hasn't been built yet. Run `python -m scripts.build_index` in backend/."
GENERATION_FAILED_MESSAGE = "Sorry, I couldn't generate an answer right now. Please try again in a moment."

Event = tuple[str, dict | list]


@dataclass
class Source:
    """One retrieved chunk (chunk-level, used by evaluation)."""
    id: str
    text: str
    source: str
    title: str
    distance: float
    similarity: float
    rerank_score: float | None = None


@dataclass
class RagResponse:
    question: str
    status: str  # "answered" | "blocked" | "error"
    answer: str = ""
    blocked_by: str | None = None  # "input_filter" | "out_of_scope"
    sources: list[Source] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    latency_ms: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class _Ready:
    """Preparation passed every guardrail: generation may start."""
    context: str
    sources: list[Source]
    metrics: dict


def page_citations(sources: list[Source], snippet_chars: int = 220) -> list[dict]:
    """Collapse chunk-level sources into one citation per page (best score first) for the UI."""
    pages: dict[str, dict] = {}
    for s in sources:
        score = s.rerank_score if s.rerank_score is not None else s.similarity
        page = pages.setdefault(s.source, {"title": s.title, "url": s.source, "score": score, "snippets": []})
        page["score"] = max(page["score"], score)
        page["snippets"].append(s.text[:snippet_chars])
    return sorted(pages.values(), key=lambda p: p["score"], reverse=True)


class RagEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.store = VectorStore(settings.chroma_dir, settings.collection_name, settings.embedding_model)
        self.llm = GeminiClient(settings.gemini_api_key, settings.llm_model)
        self.reranker = Reranker(settings.rerank_model) if settings.use_reranker else None
        self.models_ready = threading.Event()

    # ---------- lifecycle ----------
    @property
    def index_ready(self) -> bool:
        return self.store.count() > 0

    def warmup(self) -> None:
        """Load the embedding and re-rank models so the first real question is fast."""
        try:
            self.store.embed(["warmup"])
            if self.reranker:
                self.reranker.score("warmup", ["warmup"])
        except Exception:
            logger.exception("Model warm-up failed; models will load on first request")
        finally:
            self.models_ready.set()

    def build_index(self) -> dict:
        s = self.settings
        pages = scrape_pages(s.urls, verify_ssl=s.verify_ssl, timeout=s.request_timeout)
        chunks = chunk_pages(pages, s.chunk_size, s.chunk_overlap)
        count = self.store.rebuild(chunks)
        logger.info("Indexed %d chunks from %d/%d pages", count, len(pages), len(s.urls))
        return {"pages_scraped": len(pages), "pages_total": len(s.urls), "chunks": count}

    # ---------- retrieval & guardrails ----------
    def retrieve(self, question: str) -> list[RetrievedChunk]:
        s = self.settings
        if not self.reranker:
            return self.store.query(question, s.top_k)

        candidates = self.store.query(question, s.candidate_k)
        for chunk, score in zip(candidates, self.reranker.score(question, [c.text for c in candidates])):
            chunk.rerank_score = score
        candidates.sort(key=lambda c: c.rerank_score, reverse=True)
        return candidates[: s.top_k]

    def _check_scope(self, question: str, best_distance: float, best_rerank: float | None) -> tuple[bool, str]:
        """Return (in_scope, which signal decided it): 'reranker', 'distance' or 'llm'."""
        s = self.settings
        decision = guardrails.scope_decision(best_distance, best_rerank, s.accept_rerank, s.block_distance)
        if decision is Scope.ACCEPT:
            return True, "reranker"
        if decision is Scope.BLOCK:
            return False, "distance"
        try:
            return self.llm.is_in_scope(question), "llm"
        except Exception as exc:
            # Fail open: the grounded prompt (G3) still stops the LLM from answering beyond the context.
            logger.warning("LLM scope check failed, allowing question: %s", exc)
            return True, "llm_unavailable"

    def _prepare(self, question: str) -> RagResponse | _Ready:
        """G1 -> small talk -> retrieval -> G2. Returns a final response, or what generation needs."""
        s = self.settings
        if guardrails.is_unsafe_query(question):
            return RagResponse(question, "blocked", blocked_by="input_filter",
                               answer=guardrails.INPUT_FILTER_MESSAGE)

        reply = guardrails.small_talk_reply(question)
        if reply:
            return RagResponse(question, "answered", answer=reply, metrics={"scope_check": "small_talk"})

        if not self.index_ready:
            return RagResponse(question, "error", answer=INDEX_MISSING_MESSAGE)

        hits = self.retrieve(question)
        nearest = min(hits, key=lambda h: h.distance)  # after re-ranking, rank 1 may not be the nearest vector
        best_rerank = hits[0].rerank_score
        metrics = {
            "best_distance": round(nearest.distance, 4),
            "block_distance": s.block_distance,
            # Raw cosine similarity of question vs nearest chunk. NOT a probability: short questions vs
            # 600-char passages typically score 0.4-0.7 even when the chunk contains the answer.
            "similarity": round(nearest.similarity, 2),
            "rerank_score": None if best_rerank is None else round(best_rerank, 4),
            "accept_rerank": s.accept_rerank if self.reranker else None,
        }
        sources = [
            Source(h.id, h.text, h.source, h.title, round(h.distance, 4), round(h.similarity, 4),
                   None if h.rerank_score is None else round(h.rerank_score, 4))
            for h in hits
        ]

        in_scope, metrics["scope_check"] = self._check_scope(question, nearest.distance, best_rerank)
        if not in_scope:
            return RagResponse(question, "blocked", blocked_by="out_of_scope", sources=sources, metrics=metrics,
                               answer=guardrails.OUT_OF_SCOPE_MESSAGE)

        return _Ready(context="\n\n".join(h.text for h in hits), sources=sources, metrics=metrics)

    def _judge(self, question: str, context: str, answer: str, metrics: dict) -> None:
        try:
            scores = self.llm.judge_live(question, context, answer)
            metrics["faithfulness"] = round(scores.get("faithfulness", 0) * 100, 1)
            metrics["relevancy"] = round(scores.get("relevancy", 0) * 100, 1)
        except Exception as exc:  # scoring is best-effort; never lose the answer over it
            logger.warning("Judge failed: %s", exc)

    # ---------- answering ----------
    def ask(self, question: str, with_judge: bool = True) -> RagResponse:
        start = time.perf_counter()
        prepared = self._prepare(question)
        if isinstance(prepared, RagResponse):
            response = prepared
        else:
            try:
                answer = self.llm.answer(question, prepared.context)
                if with_judge:
                    self._judge(question, prepared.context, answer, prepared.metrics)
                response = RagResponse(question, "answered", answer=answer,
                                       sources=prepared.sources, metrics=prepared.metrics)
            except Exception:
                logger.exception("LLM generation failed")
                response = RagResponse(question, "error", answer=GENERATION_FAILED_MESSAGE,
                                       sources=prepared.sources, metrics=prepared.metrics)
        response.latency_ms = int((time.perf_counter() - start) * 1000)
        return response

    def ask_stream(self, question: str, with_judge: bool = True) -> Iterator[Event]:
        """Yield SSE events: status, token*, blocked, sources, metrics, done / error."""
        start = time.perf_counter()
        elapsed_ms = lambda: int((time.perf_counter() - start) * 1000)  # noqa: E731

        yield "status", {"stage": "retrieving"}
        prepared = self._prepare(question)

        if isinstance(prepared, RagResponse):
            if prepared.status == "blocked":
                yield "blocked", {"reason": prepared.blocked_by, "message": prepared.answer}
            elif prepared.status == "error":
                yield "error", {"message": prepared.answer}
                return
            else:  # small talk: one fixed reply, no sources
                yield "token", {"text": prepared.answer}
            yield "metrics", {**prepared.metrics, "latency_ms": elapsed_ms()}
            yield "done", {}
            return

        yield "status", {"stage": "generating"}
        parts: list[str] = []
        try:
            for piece in self.llm.stream_answer(question, prepared.context):
                parts.append(piece)
                yield "token", {"text": piece}
        except Exception:
            logger.exception("LLM streaming failed")
            yield "error", {"message": GENERATION_FAILED_MESSAGE}
            return

        yield "sources", page_citations(prepared.sources)
        prepared.metrics["latency_ms"] = elapsed_ms()  # time to full answer; judge is extra
        if with_judge:
            self._judge(question, prepared.context, "".join(parts), prepared.metrics)
        yield "metrics", prepared.metrics
        yield "done", {}
