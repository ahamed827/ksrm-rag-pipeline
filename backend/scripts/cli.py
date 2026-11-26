"""Terminal chat with the RAG assistant (the original Colab loop).

Usage (from backend/):  python -m scripts.cli
"""
from app.config import settings
from app.services.rag_engine import RagEngine


def main() -> None:
    engine = RagEngine(settings)
    if not engine.index_ready:
        raise SystemExit("Index is empty. Run: python -m scripts.build_index")
    print(f"KSRM RAG Assistant ready ({engine.store.count()} chunks). Type 'exit' to stop.\n")

    while True:
        question = input("Ask a question about KSRM: ").strip()
        if question.lower() in {"exit", "quit"}:
            break
        if not question:
            continue

        r = engine.ask(question)
        print("-" * 60)
        print(r.answer)
        if r.metrics:
            print("\nMetrics:", {k: v for k, v in r.metrics.items()})
        for i, s in enumerate(r.sources, 1):
            print(f"  [{i}] d={s.distance:.2f}  {s.source}")
        print(f"({r.latency_ms} ms)\n" + "=" * 60)


if __name__ == "__main__":
    main()
