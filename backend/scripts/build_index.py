"""Scrape ksrmce.ac.in and (re)build the vector index.

Usage (from backend/):  python -m scripts.build_index
"""
from app.config import settings
from app.services.rag_engine import RagEngine

if __name__ == "__main__":
    stats = RagEngine(settings).build_index()
    print(f"Scraped {stats['pages_scraped']}/{stats['pages_total']} pages -> {stats['chunks']} chunks indexed.")
