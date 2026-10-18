"""Chunking tests: size limits, overlap, metadata, edge cases."""
from __future__ import annotations

from app.services.chunking_service import chunk_pages, chunk_text

CHUNK_SIZE = 800
CHUNK_OVERLAP = 150


def _long_text(paragraphs: int = 12) -> str:
    sentence = (
        "The quick brown fox jumps over the lazy dog near the river bank "
        "while the sun sets behind the distant mountains. "
    )
    return " ".join([sentence.strip()] * (paragraphs * 6))


def test_chunk_size_respected():
    chunks = chunk_text(_long_text(), CHUNK_SIZE, CHUNK_OVERLAP)
    assert len(chunks) > 1
    assert all(len(c.content) <= CHUNK_SIZE for c in chunks)


def test_overlap_between_consecutive_chunks():
    chunks = chunk_text(_long_text(), CHUNK_SIZE, CHUNK_OVERLAP)
    assert len(chunks) >= 3
    for prev, nxt in zip(chunks, chunks[1:]):
        tail = prev.content[-60:]
        assert tail in nxt.content, "consecutive chunks must share overlap text"


def test_metadata_page_numbers_and_indexes():
    pages = [
        {"page_number": 1, "text": _long_text(6)},
        {"page_number": 2, "text": _long_text(6)},
    ]
    chunks = chunk_pages(
        pages,
        document_id="doc123",
        filename="report.pdf",
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    assert chunks
    assert {c.page_number for c in chunks} == {1, 2}
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
    for c in chunks:
        assert c.metadata["document_id"] == "doc123"
        assert c.metadata["filename"] == "report.pdf"
        assert c.metadata["page_number"] == c.page_number


def test_empty_and_whitespace_text():
    assert chunk_text("", CHUNK_SIZE, CHUNK_OVERLAP) == []
    assert chunk_text("   \n  ", CHUNK_SIZE, CHUNK_OVERLAP) == []


def test_very_long_sentence_is_hard_split():
    long_sentence = "x" * 2000 + "."
    chunks = chunk_text(long_sentence, CHUNK_SIZE, CHUNK_OVERLAP)
    assert len(chunks) > 1
    assert all(len(c.content) <= CHUNK_SIZE for c in chunks)
    assert "".join(c.content for c in chunks).replace(" ", "") == long_sentence
