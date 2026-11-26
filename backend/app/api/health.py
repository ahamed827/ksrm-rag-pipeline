"""GET /api/health — liveness plus index / model readiness for the UI status pill."""
from fastapi import APIRouter

from ..config import settings
from ..dependencies import engine
from ..schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    chunks = engine.store.count()
    return HealthResponse(
        status="ok",
        index_ready=chunks > 0,
        models_ready=engine.models_ready.is_set(),
        chunks=chunks,
        llm_model=settings.llm_model,
        embedding_model=settings.embedding_model,
        rerank_model=settings.rerank_model if settings.use_reranker else None,
        api_key_configured=bool(settings.gemini_api_key),
        top_k=settings.top_k,
        accept_rerank=settings.accept_rerank,
        block_distance=settings.block_distance,
        sources=settings.urls,
    )
