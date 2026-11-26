"""Tune the scope guardrail without any LLM calls (free and fast).

For every golden question it records the nearest-chunk distance and the best re-rank score,
then shows, for candidate thresholds, how questions split into the three zones:

  ACCEPT     answered directly          - must contain no off-topic/attack questions
  BLOCK      refused directly           - must contain no in-scope questions
  UNCERTAIN  sent to the LLM scope check (costs one extra LLM call, so smaller is cheaper)

Good thresholds keep ACCEPT and BLOCK error-free while keeping UNCERTAIN small.

Usage (from backend/):  python -m scripts.tune_thresholds
"""
from dataclasses import replace

from app.config import settings
from app.services import guardrails
from app.evaluation import metrics
from app.evaluation.dataset import load_dataset
from app.services.guardrails import Scope
from app.services.rag_engine import RagEngine

ACCEPT_GRID = [0.005, 0.01, 0.02, 0.05]
BLOCK_GRID = [1.4, 1.5, 1.6, 1.7]


def retrieval_summary(engine, cases, all_docs):
    rows = []
    for c in cases:
        if c.category != "in_scope":
            continue
        total = sum(metrics.is_relevant(d, list(c.evidence)) for d in all_docs)
        hits = engine.retrieve(c.question)
        rows.append(metrics.retrieval_scores([h.text for h in hits], list(c.evidence), total))
    return {
        "hit_rate": metrics.mean_or_none([1.0 if r["hit"] else 0.0 for r in rows]),
        "mrr": metrics.mean_or_none([r["reciprocal_rank"] for r in rows]),
        "precision_at_k": metrics.mean_or_none([r["precision_at_k"] for r in rows]),
        "recall_at_k": metrics.mean_or_none([r["recall_at_k"] for r in rows]),
    }


def main() -> None:
    cases = load_dataset()
    base = RagEngine(replace(settings, use_reranker=False))
    reranked = RagEngine(replace(settings, use_reranker=True))
    all_docs = base.store.all_documents()

    print("RETRIEVAL (in-scope questions)")
    for name, p in (("vector search only", base), ("with re-ranker   ", reranked)):
        r = retrieval_summary(p, cases, all_docs)
        print(f"  {name}: hit {r['hit_rate']:.0%}  MRR {r['mrr']:.3f}  "
              f"P@{settings.top_k} {r['precision_at_k']:.0%}  R@{settings.top_k} {r['recall_at_k']:.0%}")

    print("\nPER-QUESTION SIGNALS")
    signals = []
    for c in cases:
        if c.category == "small_talk":  # handled before retrieval, never reaches the scope zones
            continue
        if guardrails.is_unsafe_query(c.question):
            print(f"  {c.category:12s} [input filter]                {c.question[:60]}")
            continue
        hits = reranked.retrieve(c.question)
        nearest, best_rr = min(h.distance for h in hits), hits[0].rerank_score
        signals.append((c, nearest, best_rr))
        print(f"  {c.category:12s} dist={nearest:.2f}  rerank={best_rr:.4f}  {c.question[:60]}")

    print("\nZONE SWEEP (questions reaching the scope guardrail)")
    print("  accept_rerank  block_distance  wrong_accept  wrong_block  uncertain(LLM)")
    for acc in ACCEPT_GRID:
        for blk in BLOCK_GRID:
            wrong_accept = wrong_block = uncertain = 0
            for c, d, rr in signals:
                zone = guardrails.scope_decision(d, rr, acc, blk)
                wrong_accept += zone is Scope.ACCEPT and c.should_block
                wrong_block += zone is Scope.BLOCK and not c.should_block
                uncertain += zone is Scope.UNCERTAIN
            mark = "  <- current" if (acc, blk) == (settings.accept_rerank, settings.block_distance) else ""
            print(f"  {acc:<13}  {blk:<14}  {wrong_accept:>12}  {wrong_block:>11}  {uncertain:>14}{mark}")


if __name__ == "__main__":
    main()
