"""Pure metric functions (no I/O, no models) so they are easy to unit-test.

All rates are returned as floats in [0, 1]; the UI formats them as percentages.
"""
import math
import re
from statistics import mean

_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    return _SPACES.sub(" ", text).strip().lower()


def is_relevant(chunk_text: str, evidence: list[str]) -> bool:
    """A chunk is relevant when it contains any evidence string (case/space-insensitive)."""
    haystack = normalize(chunk_text)
    return any(normalize(e) in haystack for e in evidence)


# ---------------- retrieval ----------------
def retrieval_scores(retrieved: list[str], evidence: list[str], total_relevant: int) -> dict:
    """Per-question retrieval metrics.

    retrieved       texts of the top-k chunks, in rank order
    total_relevant  how many chunks in the whole index are relevant (for recall)
    """
    flags = [is_relevant(t, evidence) for t in retrieved]
    hits = sum(flags)
    first_rank = next((i + 1 for i, f in enumerate(flags) if f), None)
    return {
        "relevant_flags": flags,
        "precision_at_k": hits / len(retrieved) if retrieved else 0.0,
        "recall_at_k": min(1.0, hits / total_relevant) if total_relevant else None,
        "hit": hits > 0,
        "reciprocal_rank": 1 / first_rank if first_rank else 0.0,
    }


# ---------------- guardrails (binary classification) ----------------
def confusion_matrix(should_block: list[bool], did_block: list[bool]) -> dict:
    """Positive class = 'should be blocked'."""
    pairs = list(zip(should_block, did_block))
    return {
        "tp": sum(s and d for s, d in pairs),          # correctly blocked
        "fp": sum((not s) and d for s, d in pairs),    # legit question wrongly refused
        "fn": sum(s and (not d) for s, d in pairs),    # off-topic/attack leaked through
        "tn": sum((not s) and (not d) for s, d in pairs),  # correctly answered
    }


def _safe_div(a: float, b: float) -> float | None:
    return a / b if b else None


def classification_scores(cm: dict) -> dict:
    tp, fp, fn, tn = cm["tp"], cm["fp"], cm["fn"], cm["tn"]
    precision = _safe_div(tp, tp + fp)
    recall = _safe_div(tp, tp + fn)
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and (precision + recall) > 0
        else None
    )
    return {
        "accuracy": _safe_div(tp + tn, tp + fp + fn + tn),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_block_rate": _safe_div(fp, fp + tn),  # share of legit questions refused
    }


# ---------------- helpers ----------------
def mean_or_none(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return mean(present) if present else None


def percentile(values: list[float], pct: float) -> float | None:
    """Nearest-rank percentile (pct in 0-100)."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(pct / 100 * len(ordered)))
    return ordered[rank - 1]
