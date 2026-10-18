"""Document upload / listing / details / deletion API tests."""
from __future__ import annotations


def test_upload_happy_path(client, sample_pdf_bytes):
    resp = client.post(
        "/api/documents/upload",
        files={
            "file": ("acme-refund-policy.pdf", sample_pdf_bytes, "application/pdf")
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"]
    assert body["original_filename"] == "acme-refund-policy.pdf"
    assert body["status"] == "ready"
    assert body["page_count"] == 4
    assert body["chunk_count"] > 0
    assert body["file_size"] == len(sample_pdf_bytes)


def test_upload_duplicate_returns_409(client, sample_pdf_bytes):
    files = {"file": ("acme-refund-policy.pdf", sample_pdf_bytes, "application/pdf")}
    first = client.post("/api/documents/upload", files=files)
    assert first.status_code == 201
    second = client.post("/api/documents/upload", files=files)
    assert second.status_code == 409
    assert "already been uploaded" in second.json()["detail"]
    assert "acme-refund-policy.pdf" in second.json()["detail"]


def test_list_documents(client, uploaded_doc):
    resp = client.get("/api/documents")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["documents"][0]["id"] == uploaded_doc["id"]


def test_get_document_details(client, uploaded_doc):
    resp = client.get(f"/api/documents/{uploaded_doc['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["chunk_count"] == uploaded_doc["chunk_count"]
    assert body["page_count"] == 4


def test_get_document_not_found(client):
    resp = client.get("/api/documents/does-not-exist")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Document not found."


def test_delete_document_not_found(client):
    resp = client.delete("/api/documents/does-not-exist")
    assert resp.status_code == 404


def test_delete_document_removes_everything(client, uploaded_doc, sample_pdf_bytes):
    doc_id = uploaded_doc["id"]
    resp = client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 200
    assert client.get(f"/api/documents/{doc_id}").status_code == 404
    assert client.get("/api/documents").json()["total"] == 0

    # Vectors are gone: re-uploading the same bytes is NOT a duplicate anymore,
    # and the store holds no chunks for the deleted document.
    from app.config import get_settings
    from app.services.vector_service import get_vector_store

    store = get_vector_store(get_settings())
    assert store.count() == 0

    re_upload = client.post(
        "/api/documents/upload",
        files={
            "file": ("acme-refund-policy.pdf", sample_pdf_bytes, "application/pdf")
        },
    )
    assert re_upload.status_code == 201
