"""Step 3 — embed chunks and store them in a persistent ChromaDB collection."""
from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING

import chromadb
import numpy as np

if TYPE_CHECKING:  # heavy (PyTorch) import; loaded lazily so the API starts instantly
    from sentence_transformers import SentenceTransformer

from .chunker import Chunk
from .scraper import title_from_url


@dataclass
class RetrievedChunk:
    id: str
    text: str
    source: str
    title: str
    distance: float
    rerank_score: float | None = None

    @property
    def similarity(self) -> float:
        """Cosine similarity derived from squared-L2 distance of unit vectors: d = 2 - 2cos."""
        return max(0.0, min(1.0, 1 - self.distance / 2.0))


class VectorStore:
    def __init__(self, persist_dir: str, collection_name: str, embedding_model: str):
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._collection_name = collection_name
        self._embedding_model_name = embedding_model
        self._collection = self._client.get_or_create_collection(collection_name)

    @cached_property
    def embedder(self) -> "SentenceTransformer":
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(self._embedding_model_name)

    def embed(self, texts: list[str]) -> np.ndarray:
        return self.embedder.encode(texts, normalize_embeddings=True)

    def count(self) -> int:
        return self._collection.count()

    def all_documents(self) -> list[str]:
        return self._collection.get(include=["documents"])["documents"]

    def rebuild(self, chunks: list[Chunk]) -> int:
        """Replace the whole collection with the given chunks."""
        self._client.delete_collection(self._collection_name)
        self._collection = self._client.create_collection(self._collection_name)
        if not chunks:
            return 0
        embeddings = self.embed([c.text for c in chunks])
        self._collection.add(
            ids=[c.id for c in chunks],
            documents=[c.text for c in chunks],
            embeddings=embeddings.tolist(),
            metadatas=[{"source": c.source, "title": c.title} for c in chunks],
        )
        return len(chunks)

    def query(self, text: str, top_k: int) -> list[RetrievedChunk]:
        if self.count() == 0:
            return []
        result = self._collection.query(
            query_embeddings=self.embed([text]).tolist(),
            n_results=min(top_k, self.count()),
        )
        return [
            RetrievedChunk(
                id=i,
                text=doc,
                source=(meta or {}).get("source", ""),
                title=(meta or {}).get("title") or title_from_url((meta or {}).get("source", "")),
                distance=dist,
            )
            for i, doc, meta, dist in zip(
                result["ids"][0],
                result["documents"][0],
                result["metadatas"][0],
                result["distances"][0],
            )
        ]

    def projection(self, query: str | None = None) -> dict:
        """3-D PCA projection of every stored chunk (plus the query, if given) for the Knowledge Map.

        Only a *view*: the index itself stores and searches the full 384-dimensional vectors.
        """
        from sklearn.decomposition import PCA

        data = self._collection.get(include=["embeddings", "documents", "metadatas"])
        embeddings = np.asarray(data["embeddings"])
        if len(embeddings) < 3:
            return {"points": [], "query": None, "dimensions": None, "explained_variance": None}

        pca = PCA(n_components=3).fit(embeddings)
        coords = pca.transform(embeddings)
        points = [
            {
                "id": cid,
                "x": float(x),
                "y": float(y),
                "z": float(z),
                "source": (meta or {}).get("source", ""),
                "title": (meta or {}).get("title", ""),
                "preview": doc[:160],
            }
            for cid, (x, y, z), doc, meta in zip(data["ids"], coords, data["documents"], data["metadatas"])
        ]
        query_point = None
        if query:
            qx, qy, qz = pca.transform(self.embed([query]))[0]
            query_point = {"x": float(qx), "y": float(qy), "z": float(qz), "text": query}
        return {
            "points": points,
            "query": query_point,
            "dimensions": int(embeddings.shape[1]),
            # Share of the 384-D spread each of the 3 axes captures (how much the picture simplifies).
            "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        }
