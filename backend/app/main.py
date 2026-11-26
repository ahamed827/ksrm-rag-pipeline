"""FastAPI application: CORS, routers and startup.

Startup is instant: the vector index is built offline (python -m scripts.build_index) and the
models warm up in a background thread while the API is already serving requests.
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import chat, evaluation, health, knowledge
from .config import settings
from .dependencies import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not engine.index_ready:
        logger.warning("Vector index is empty. Run `python -m scripts.build_index` before chatting.")
    if settings.warmup_on_start:
        threading.Thread(target=engine.warmup, name="model-warmup", daemon=True).start()
    else:
        engine.models_ready.set()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="KSRM RAG API", version="2.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    for module in (health, chat, knowledge, evaluation):
        app.include_router(module.router)
    return app


app = create_app()
