"""Step 2 — split each page into overlapping chunks, keeping the source URL and page title."""
from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .scraper import Page, clean_text


@dataclass
class Chunk:
    id: str
    text: str
    source: str
    title: str


def chunk_pages(pages: list[Page], chunk_size: int, chunk_overlap: int) -> list[Chunk]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks: list[Chunk] = []
    for page in pages:
        for piece in splitter.split_text(clean_text(page.text)):
            chunks.append(Chunk(id=f"chunk_{len(chunks)}", text=piece, source=page.url, title=page.title))
    return chunks
