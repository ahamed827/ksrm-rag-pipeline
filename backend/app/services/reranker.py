"""Cross-encoder re-ranker.

The bi-encoder (vector search) embeds question and chunk separately, so it is fast but coarse.
A cross-encoder reads the question and the chunk *together* and outputs a relevance score.
We use it to (1) re-order a wider candidate set and (2) gate out-of-scope questions.
"""
from functools import cached_property
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # heavy (PyTorch) imports; loaded lazily so the API starts instantly
    from sentence_transformers import CrossEncoder


class Reranker:
    def __init__(self, model_name: str):
        self._model_name = model_name

    @cached_property
    def model(self) -> "CrossEncoder":
        from sentence_transformers import CrossEncoder

        return CrossEncoder(self._model_name)

    def score(self, question: str, passages: list[str]) -> list[float]:
        """Relevance of each passage to the question, as a probability in [0, 1]."""
        if not passages:
            return []
        import torch

        scores = self.model.predict([(question, p) for p in passages], activation_fn=torch.nn.Sigmoid())
        return [float(s) for s in scores]
