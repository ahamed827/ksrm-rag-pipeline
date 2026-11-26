"""Knowledge-base endpoints: rebuild the index and the 2-D map used by the Knowledge Map tab."""
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..dependencies import engine
from ..schemas import IndexStats

router = APIRouter(prefix="/api", tags=["knowledge"])


@router.post("/index/rebuild", response_model=IndexStats)
async def rebuild_index() -> IndexStats:
    """Re-scrape the website and rebuild the vector index (takes about a minute)."""
    try:
        return IndexStats(**await run_in_threadpool(engine.build_index))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/vectors")
async def vectors(query: str | None = None) -> dict:
    def build() -> dict:
        data = engine.store.projection(query)
        # Highlight the chunks real retrieval returns (2-D closeness can mislead after PCA).
        data["retrieved"] = (
            [{"id": h.id, "distance": round(h.distance, 4)} for h in engine.retrieve(query)]
            if query and engine.index_ready else []
        )
        return data

    return await run_in_threadpool(build)
