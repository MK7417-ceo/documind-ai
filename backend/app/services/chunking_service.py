"""Sentence-aware text chunking with configurable size and overlap.

Long texts are split on sentence boundaries and greedily packed into chunks
of at most ``chunk_size`` characters. Consecutive chunks share trailing
sentences (up to ``chunk_overlap`` characters) so context is not lost at
boundaries. Every chunk keeps its page number and document metadata.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Union

from .pdf_service import PdfPage

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n{2,}")


def clean_text(text: str) -> str:
    """Normalise whitespace and undo hyphenated line breaks."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    return [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]


def _hard_split(text: str, size: int) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)] or [""]


@dataclass
class TextChunk:
    content: str
    page_number: int  # 1-based
    chunk_index: int = 0  # global index across the document
    metadata: dict = field(default_factory=dict)


def _carry_overlap(buf: list[str], chunk_overlap: int) -> tuple[list[str], int]:
    """Take trailing sentences of the finished chunk as the next chunk's prefix."""
    carry: list[str] = []
    carry_len = 0
    for prev in reversed(buf):
        carry.insert(0, prev)
        carry_len += len(prev) + (1 if carry_len else 0)
        if carry_len >= chunk_overlap:
            break
    return carry, carry_len


def _pack_units(units: list[str], chunk_size: int, chunk_overlap: int) -> list[str]:
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0  # == len(" ".join(buf))

    for unit in units:
        if buf and buf_len + 1 + len(unit) > chunk_size:
            chunks.append(" ".join(buf))
            buf, buf_len = _carry_overlap(buf, chunk_overlap)
            if buf and buf_len + 1 + len(unit) > chunk_size:
                buf, buf_len = [], 0  # carry alone too big; start fresh
        if buf:
            buf_len += 1  # separator space
        buf.append(unit)
        buf_len += len(unit)

    if buf:
        chunks.append(" ".join(buf))
    return [c for c in chunks if c.strip()]


def chunk_text(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    page_number: int = 1,
    document_id: str = "",
    filename: str = "",
) -> list[TextChunk]:
    cleaned = clean_text(text)
    if not cleaned:
        return []
    units: list[str] = []
    for sentence in split_sentences(cleaned):
        if len(sentence) > chunk_size:
            units.extend(_hard_split(sentence, chunk_size))
        else:
            units.append(sentence)
    pieces = _pack_units(units, chunk_size, chunk_overlap)
    return [
        TextChunk(
            content=piece,
            page_number=page_number,
            metadata={
                "document_id": document_id,
                "filename": filename,
                "page_number": page_number,
            },
        )
        for piece in pieces
    ]


def chunk_pages(
    pages: list[Union[PdfPage, dict]],
    *,
    document_id: str,
    filename: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[TextChunk]:
    """Chunk every page; assign global chunk indexes afterwards."""
    chunks: list[TextChunk] = []
    for page in pages:
        if isinstance(page, dict):
            page_number, text = page["page_number"], page["text"]
        else:
            page_number, text = page.page_number, page.text
        chunks.extend(
            chunk_text(
                text,
                chunk_size,
                chunk_overlap,
                page_number=page_number,
                document_id=document_id,
                filename=filename,
            )
        )
    for i, chunk in enumerate(chunks):
        chunk.chunk_index = i
        chunk.metadata["chunk_index"] = i
    return chunks
