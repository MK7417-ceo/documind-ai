"""Filename sanitising, hashing and upload validation helpers."""
from __future__ import annotations

import hashlib
import re
import uuid

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]")


def sanitize_filename(name: str | None) -> str:
    """Werkzeug-style sanitising for *display* of the original filename.

    The stored file always uses a generated uuid name; this is only used for
    the human-readable original filename recorded in the database.
    """
    base = (name or "file").replace("\\", "/").split("/")[-1].strip()
    base = _UNSAFE_CHARS.sub("_", base).strip("._")
    base = re.sub(r"_+", "_", base)
    base = re.sub(r"_+(\.[A-Za-z0-9]+)$", r"\1", base)  # no trailing "_" before ext
    return (base or "file")[:120]


def generate_stored_filename() -> str:
    """Internal, collision-free filename used on disk (never user input)."""
    return f"{uuid.uuid4().hex}.pdf"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_pdf_magic(data: bytes) -> bool:
    """Check the PDF magic header (%PDF-) near the start of the file."""
    return data.lstrip()[:5] == b"%PDF-"
