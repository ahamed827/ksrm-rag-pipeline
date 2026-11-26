"""Server-Sent Events framing."""
import json


def sse_frame(event: str, data: dict | list) -> str:
    """Encode one SSE frame. JSON keeps newlines in the payload escaped, so one `data:` line is enough."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
