"""Central configuration. Every tunable value lives here and can be overridden by env vars."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_URLS = [
    "https://ksrmce.ac.in/",
    "https://ksrmce.ac.in/about/",
    "https://ksrmce.ac.in/academics/courses-intake/",
    "https://ksrmce.ac.in/academics/regulations/",
    "https://ksrmce.ac.in/admissions/",
    "https://ksrmce.ac.in/placements/overview/",
    "https://ksrmce.ac.in/departments/cse/",
    "https://ksrmce.ac.in/departments/ece/",
    "https://ksrmce.ac.in/departments/eee/",
    "https://ksrmce.ac.in/departments/mech/",
    "https://ksrmce.ac.in/departments/civil/",
]


def _env_float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def _env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.environ.get("GEMINI_API_KEY", "")
    llm_model: str = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
    embedding_model: str = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    urls: list[str] = field(default_factory=lambda: list(DEFAULT_URLS))
    verify_ssl: bool = os.environ.get("VERIFY_SSL", "false").lower() == "true"
    request_timeout: int = _env_int("REQUEST_TIMEOUT", 15)

    chunk_size: int = _env_int("CHUNK_SIZE", 600)
    chunk_overlap: int = _env_int("CHUNK_OVERLAP", 100)

    # Built offline by `python -m scripts.build_index`; the API only reads it.
    chroma_dir: str = os.environ.get("CHROMA_DIR", str(BACKEND_DIR / "chroma_db"))
    collection_name: str = os.environ.get("COLLECTION_NAME", "ksrm_web_docs")
    top_k: int = _env_int("TOP_K", 4)

    # Cross-encoder re-ranking: fetch `candidate_k` by vector search, re-score, keep `top_k`.
    use_reranker: bool = os.environ.get("USE_RERANKER", "true").lower() == "true"
    rerank_model: str = os.environ.get("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    # 30 of 45 chunks: catches answers vector search ranks 21-30 (e.g. "Who is the principal?" at #23)
    # at ~1 s/question on CPU; re-ranking all chunks gave no further gain for 50% more time.
    candidate_k: int = _env_int("CANDIDATE_K", 30)

    # Scope guardrail (see guardrails.py). Anything between the two goes to the LLM scope check.
    # Answer directly when the best re-rank score is at least this.
    accept_rerank: float = _env_float("ACCEPT_RERANK", 0.01)
    # Block directly when the nearest chunk's squared-L2 distance exceeds this (0 = identical, 4 = opposite).
    block_distance: float = _env_float("BLOCK_DISTANCE", 1.6)

    # Load embedding + re-rank models in a background thread at startup so the first chat is fast.
    warmup_on_start: bool = os.environ.get("WARMUP_ON_START", "true").lower() == "true"

    cors_origins: list[str] = field(
        default_factory=lambda: os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
    )


settings = Settings()
