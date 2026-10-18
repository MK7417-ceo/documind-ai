"""PDF text extraction with PyMuPDF (page-wise, with clear error types)."""
from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF


class PdfError(Exception):
    """Base class for PDF processing failures."""


class PasswordProtectedError(PdfError):
    """Raised when the PDF requires a password to open."""


class CorruptPdfError(PdfError):
    """Raised when the PDF cannot be parsed at all."""


@dataclass
class PdfPage:
    page_number: int  # 1-based
    text: str


def extract_pages(data: bytes) -> list[PdfPage]:
    """Extract text page by page. Raises PasswordProtectedError/CorruptPdfError."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise CorruptPdfError(
            "The PDF could not be read. It may be corrupted."
        ) from exc
    try:
        if doc.needs_pass:
            raise PasswordProtectedError(
                "This PDF is password-protected. Please upload an unlocked PDF."
            )
        try:
            pages = [
                PdfPage(page_number=i + 1, text=page.get_text("text") or "")
                for i, page in enumerate(doc)
            ]
        except Exception as exc:
            raise CorruptPdfError(
                "The PDF could not be read. It may be corrupted."
            ) from exc
    finally:
        doc.close()
    if not pages:
        raise CorruptPdfError("The PDF could not be read. It may be corrupted.")
    return pages
