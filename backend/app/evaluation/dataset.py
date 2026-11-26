"""Load the golden evaluation set from JSON (kept outside the code so it can grow freely)."""
import json
from dataclasses import dataclass
from pathlib import Path

from ..config import BACKEND_DIR

DEFAULT_DATASET = BACKEND_DIR / "eval" / "golden_set.json"
# in_scope: should be answered from the website; small_talk: should get the fixed assistant reply;
# out_of_scope / attack: should be blocked.
CATEGORIES = {"in_scope", "small_talk", "out_of_scope", "attack"}
BLOCK_CATEGORIES = {"out_of_scope", "attack"}


@dataclass(frozen=True)
class EvalCase:
    id: str
    category: str
    question: str
    expected_answer: str
    evidence: tuple[str, ...]

    @property
    def should_block(self) -> bool:
        return self.category in BLOCK_CATEGORIES


def load_dataset(path: Path = DEFAULT_DATASET) -> list[EvalCase]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    cases = []
    for item in raw["cases"]:
        if item["category"] not in CATEGORIES:
            raise ValueError(f"{item['id']}: unknown category {item['category']!r}")
        cases.append(
            EvalCase(
                id=item["id"],
                category=item["category"],
                question=item["question"],
                expected_answer=item["expected_answer"],
                evidence=tuple(item.get("evidence", [])),
            )
        )
    ids = [c.id for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate case ids in golden set")
    return cases
