"""Run the golden-set evaluation and print a four-level scorecard.

Usage (from backend/):  python -m scripts.evaluate
Results are also saved to eval/results/latest.json (shown in the UI's Evaluation tab).
"""
from app.config import settings
from app.evaluation.runner import run_evaluation
from app.services.rag_engine import RagEngine


def pct(v):
    return "  n/a" if v is None else f"{v * 100:5.1f}%"


def progress(done, total, question):
    if question:
        print(f"[{done + 1}/{total}] {question}")


if __name__ == "__main__":
    engine = RagEngine(settings)
    if not engine.index_ready:
        raise SystemExit("Index is empty. Run: python -m scripts.build_index")
    report = run_evaluation(engine, progress)
    s = report["summary"]
    r, g, gr, sy = s["retrieval"], s["generation"], s["guardrails"], s["system"]
    cm = gr["confusion"]

    print("\n" + "=" * 56 + "\n            RAG PERFORMANCE SCORECARD\n" + "=" * 56)
    print(f"RETRIEVAL   (n={r['n']}, k={r['k']})")
    print(f"  Precision@k {pct(r['precision_at_k'])}   Recall@k {pct(r['recall_at_k'])}")
    mrr = "n/a" if r["mrr"] is None else f"{r['mrr']:.3f}"
    print(f"  Hit rate    {pct(r['hit_rate'])}   MRR      {mrr}")
    print(f"GENERATION  (n={g['n']})")
    print(f"  Faithfulness {pct(g['faithfulness'])}  Relevancy {pct(g['relevancy'])}  Correctness {pct(g['correctness'])}")
    print(f"GUARDRAILS  (n={gr['n']}, positive = should block)")
    print(f"  Accuracy {pct(gr['accuracy'])}  Precision {pct(gr['precision'])}  Recall {pct(gr['recall'])}  F1 {pct(gr['f1'])}")
    print(f"  TP={cm['tp']} (blocked correctly)  FN={cm['fn']} (leaked)  FP={cm['fp']} (wrongly refused)  TN={cm['tn']}")
    print("SYSTEM")
    print(f"  Avg latency {sy['avg_latency_s']:.2f}s   p95 {sy['p95_latency_s']:.2f}s   errors {sy['errors']}")
    if sy["label_issues"]:
        print(f"  ! Golden-set evidence matched no chunk for: {', '.join(sy['label_issues'])}")

    failures = [c for c in report["cases"] if not c["guardrail_correct"]]
    if failures:
        print("\nGuardrail mistakes:")
        for c in failures:
            kind = "LEAKED" if c["should_block"] else "WRONGLY BLOCKED"
            print(f"  [{kind}] {c['question']}  (distance={c['best_distance']})")
