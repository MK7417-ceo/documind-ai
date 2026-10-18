"""Upload validation tests (type, magic bytes, size) + security utils."""
from __future__ import annotations

from app.utils.security import (
    generate_stored_filename,
    is_pdf_magic,
    sanitize_filename,
)


def test_upload_rejects_non_pdf_extension(client):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("notes.txt", b"just some text", "text/plain")},
    )
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_upload_rejects_invalid_pdf_magic(client):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"this is not a pdf at all", "application/pdf")},
    )
    assert resp.status_code == 400
    assert "valid PDF" in resp.json()["detail"]


def test_upload_rejects_oversize(make_client):
    client = make_client({"MAX_UPLOAD_MB": "1"})
    big = b"%PDF-1.4\n" + b"0" * (2 * 1024 * 1024)
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("big.pdf", big, "application/pdf")},
    )
    assert resp.status_code == 413
    assert "too large" in resp.json()["detail"].lower()


def test_upload_rejects_empty_file(client):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert resp.status_code == 400


def test_sanitize_filename():
    assert sanitize_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert sanitize_filename("my report (final).pdf") == "my_report_final.pdf"
    assert sanitize_filename("") == "file"
    assert len(sanitize_filename("a" * 500 + ".pdf")) <= 120


def test_generate_stored_filename_unique():
    names = {generate_stored_filename() for _ in range(100)}
    assert len(names) == 100
    assert all(n.endswith(".pdf") for n in names)


def test_is_pdf_magic():
    assert is_pdf_magic(b"%PDF-1.4\nrest")
    assert is_pdf_magic(b"  \n%PDF-1.7 stuff")
    assert not is_pdf_magic(b"hello world")
    assert not is_pdf_magic(b"")
