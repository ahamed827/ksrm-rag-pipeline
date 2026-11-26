"""Request / response models for the HTTP API.

The chat endpoint streams Server-Sent Events; the payload of each event type is documented here.
"""
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    with_judge: bool = True


class HealthResponse(BaseModel):
    status: str
    index_ready: bool
    models_ready: bool
    chunks: int
    llm_model: str
    embedding_model: str
    rerank_model: str | None
    api_key_configured: bool
    top_k: int
    accept_rerank: float
    block_distance: float
    sources: list[str]


class IndexStats(BaseModel):
    pages_scraped: int
    pages_total: int
    chunks: int


# ---------- SSE payloads for POST /api/chat ----------
class StatusEvent(BaseModel):
    """event: status — pipeline stage changed."""
    stage: str  # "retrieving" | "generating"


class TokenEvent(BaseModel):
    """event: token — next piece of the answer text."""
    text: str


class BlockedEvent(BaseModel):
    """event: blocked — a guardrail refused the question (no tokens are generated)."""
    reason: str  # "input_filter" | "out_of_scope"
    message: str


class SourceOut(BaseModel):
    """One cited page. event: sources carries a list of these, after the answer."""
    title: str
    url: str
    score: float  # best re-rank relevance (0-1) among the page's retrieved chunks
    snippets: list[str]


class ErrorEvent(BaseModel):
    """event: error — the request failed; the stream ends."""
    message: str


# event: metrics — dict of retrieval / guardrail / judge scores (see RagEngine._prepare)
# event: done    — {} ; the stream ends.
