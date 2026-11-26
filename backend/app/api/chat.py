"""POST /api/chat — answers stream back as Server-Sent Events."""
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..dependencies import engine
from ..schemas import ChatRequest
from .sse import sse_frame

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(req: ChatRequest) -> StreamingResponse:
    """Stream events: status → token* (or blocked) → sources → metrics → done.

    The generator is synchronous; Starlette iterates it in a worker thread, so blocking model
    calls never stall the event loop.
    """
    def events() -> Iterator[str]:
        try:
            for event, data in engine.ask_stream(req.question.strip(), req.with_judge):
                yield sse_frame(event, data)
        except Exception:  # last line of defence: always close the stream with an error event
            yield sse_frame("error", {"message": "Something went wrong. Please try again."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
