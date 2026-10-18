"""PDF extraction tests: happy path, password-protected, corrupt, scanned."""
from __future__ import annotations

import fitz
import pytest

from app.services.pdf_service import (
    CorruptPdfError,
    PasswordProtectedError,
    PdfError,
    extract_pages,
)


def test_extract_pages_from_sample_pdf(sample_pdf_bytes):
    pages = extract_pages(sample_pdf_bytes)
    assert len(pages) == 4
    assert [p.page_number for p in pages] == [1, 2, 3, 4]
    full = "\n".join(p.text for p in pages)
    assert "Acme Corp" in full
    assert "30-day refund window" in pages[1].text
    assert "support@acme.example" in full


def _make_encrypted_pdf_bytes(tmp_path) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "top secret content")
    out = str(tmp_path / "locked.pdf")
    doc.save(out, encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="s3cret", owner_pw="s3cret")
    doc.close()
    with open(out, "rb") as f:
        return f.read()


def test_extract_pages_password_protected(tmp_path):
    data = _make_encrypted_pdf_bytes(tmp_path)
    with pytest.raises(PasswordProtectedError):
        extract_pages(data)


def test_extract_pages_corrupt():
    with pytest.raises(PdfError):
        extract_pages(b"%PDF-1.4\n\x00\x01\x02 broken xref trailer <<>>")


def test_upload_password_protected_returns_422(client, tmp_path):
    data = _make_encrypted_pdf_bytes(tmp_path)
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("locked.pdf", data, "application/pdf")},
    )
    assert resp.status_code == 422
    assert "password" in resp.json()["detail"].lower()


def _make_blank_pdf_bytes() -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_fill_color(200, 200, 200)
    pdf.rect(10, 10, 100, 50, style="F")  # a grey rectangle, no text
    return bytes(pdf.output())


def test_upload_scanned_pdf_needs_ocr(client):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("scan.pdf", _make_blank_pdf_bytes(), "application/pdf")},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "needs_ocr"
    assert "OCR" in body["message"]
