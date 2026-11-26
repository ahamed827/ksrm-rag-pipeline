"""Runs the golden set through the engine and scores it at four levels:
retrieval, generation, guardrails and system.
"""
import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Callable

from ..config import BACKEND_DIR
from ..services.rag_engine import RagEngine
from . import metrics
from .dataset import EvalCase, load_dataset

logger = logging.getLogger(__name__)
RESULTS_PATH = BACKEND_DIR / "eval" / "results" / "latest.json"

ProgressFn = Callable[[int, int, str], None]


def _evaluate_case(engine: RagEngine, case: EvalCase, all_docs: list[str]) -> dict:
    row: dict = {"id": case.id, "category": case.category, "question": case.question,
                 "expected_answer": case.expected_answer, "should_block": case.should_block}

    # Retrieval is scored on its own, independent of guardrails, for in-scope questions.
    if case.category == "in_scope":
        hits = engine.retrieve(case.question)
        total_relevant = sum(metrics.is_relevant(d, list(case.evidence)) for d in all_docs)
        scores = metrics.retrieval_scores([h.text for h in hits], list(case.evidence), total_relevant)
        row["retrieval"] = {**scores, "total_relevant": total_relevant, "retrieved_ids": [h.id for h in hits]}
        row["label_issue"] = total_relevant == 0  # evidence matches nothing: fix the golden set

    # Full engine (guardrails + generation). Latency excludes the evaluation judge.
    result = engine.ask(case.question, with_judge=False)
    row.update(status=result.status, blocked_by=result.blocked_by, answer=result.answer,
               latency_s=round(result.latency_ms / 1000, 3), did_block=result.status == "blocked",
               best_distance=result.metrics.get("best_distance"), rerank_score=result.metrics.get("rerank_score"),
               scope_check=result.metrics.get("scope_check"))
    row["guardrail_correct"] = row["did_block"] == case.should_block
    if case.category == "small_talk":  # must get the fixed assistant reply, not a refusal or a website answer
        row["guardrail_correct"] = row["scope_check"] == "small_talk"

    # Generation quality, judged by the LLM, only where an answer was produced for an in-scope question.
    row["generation"] = None
    if case.category == "in_scope" and result.status == "answered":
        context = "\n\n".join(s.text for s in result.sources)
        try:
            row["generation"] = engine.llm.judge_against_expected(
                case.question, context, case.expected_answer, result.answer)
        except Exception as exc:
            row["judge_error"] = str(exc)
    return row


def summarize(rows: list[dict], top_k: int) -> dict:
    retrieval_rows = [r["retrieval"] for r in rows if r.get("retrieval") and not r.get("label_issue")]
    gen_rows = [r["generation"] for r in rows if r.get("generation")]
    cm = metrics.confusion_matrix([r["should_block"] for r in rows], [r["did_block"] for r in rows])
    latencies = [r["latency_s"] for r in rows]

    by_category = {}
    for cat in ("in_scope", "small_talk", "out_of_scope", "attack"):
        group = [r for r in rows if r["category"] == cat]
        if group:
            by_category[cat] = {"n": len(group), "correct": sum(r["guardrail_correct"] for r in group)}

    return {
        "retrieval": {
            "k": top_k,
            "n": len(retrieval_rows),
            "precision_at_k": metrics.mean_or_none([r["precision_at_k"] for r in retrieval_rows]),
            "recall_at_k": metrics.mean_or_none([r["recall_at_k"] for r in retrieval_rows]),
            "hit_rate": metrics.mean_or_none([1.0 if r["hit"] else 0.0 for r in retrieval_rows]),
            "mrr": metrics.mean_or_none([r["reciprocal_rank"] for r in retrieval_rows]),
        },
        "generation": {
            "n": len(gen_rows),
            "faithfulness": metrics.mean_or_none([g.get("faithfulness") for g in gen_rows]),
            "relevancy": metrics.mean_or_none([g.get("relevancy") for g in gen_rows]),
            "correctness": metrics.mean_or_none([g.get("correctness") for g in gen_rows]),
        },
        "guardrails": {"n": len(rows), "confusion": cm, **metrics.classification_scores(cm),
                       "by_category": by_category},
        "system": {
            "avg_latency_s": metrics.mean_or_none(latencies),
            "p95_latency_s": metrics.percentile(latencies, 95),
            "errors": sum(r["status"] == "error" for r in rows),
            # How often the scope guardrail needed the (slower) LLM check.
            "llm_scope_checks": sum(r.get("scope_check") == "llm" for r in rows),
            "label_issues": [r["id"] for r in rows if r.get("label_issue")],
        },
    }


def run_evaluation(engine: RagEngine, on_progress: ProgressFn | None = None) -> dict:
    cases = load_dataset()
    all_docs = engine.store.all_documents()
    rows = []
    for i, case in enumerate(cases):
        if on_progress:
            on_progress(i, len(cases), case.question)
        rows.append(_evaluate_case(engine, case, all_docs))
    if on_progress:
        on_progress(len(cases), len(cases), "")

    s = engine.settings
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config": {"llm_model": s.llm_model, "embedding_model": s.embedding_model, "top_k": s.top_k,
                   "use_reranker": s.use_reranker, "rerank_model": s.rerank_model if s.use_reranker else None,
                   "accept_rerank": s.accept_rerank, "block_distance": s.block_distance},
        "summary": summarize(rows, s.top_k),
        "cases": rows,
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def load_latest_report() -> dict | None:
    if RESULTS_PATH.exists():
        return json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    return None


class EvaluationJob:
    """Runs one evaluation at a time in a background thread so the HTTP request returns immediately."""

    def __init__(self, engine: RagEngine):
        self._engine = engine
        self._lock = threading.Lock()
        self.state = {"running": False, "done": 0, "total": 0, "current": "", "error": None,
                      "started_at": None, "report": load_latest_report()}

    def start(self) -> bool:
        with self._lock:
            if self.state["running"]:
                return False
            self.state.update(running=True, done=0, total=0, current="", error=None, started_at=time.time())
        threading.Thread(target=self._run, daemon=True).start()
        return True

    def _progress(self, done: int, total: int, current: str) -> None:
        self.state.update(done=done, total=total, current=current)

    def _run(self) -> None:
        try:
            self.state["report"] = run_evaluation(self._engine, self._progress)
        except Exception as exc:
            logger.exception("Evaluation failed")
            self.state["error"] = str(exc)
        finally:
            self.state["running"] = False
