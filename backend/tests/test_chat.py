"""Chat API tests: validation, no-answer behaviour, known answers, history."""
from __future__ import annotations

import json

from app.services.rag_service import NO_ANSWER


def _chat(client, question, doc_ids):
    return client.post(
        "/api/chat", json={"question": question, "document_ids": doc_ids}
    )


def test_chat_rejects_empty_question(client, uploaded_doc):
    resp = _chat(client, "", [uploaded_doc["id"]])
    assert resp.status_code == 422


def test_chat_rejects_whitespace_question(client, uploaded_doc):
    resp = _chat(client, "   ", [uploaded_doc["id"]])
    assert resp.status_code == 422


def test_chat_rejects_empty_document_list(client):
    resp = client.post("/api/chat", json={"question": "hi?", "document_ids": []})
    assert resp.status_code == 422


def test_chat_unknown_document_returns_404(client):
    resp = _chat(client, "What is the refund policy?", ["no-such-doc"])
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_chat_no_documents_uploaded_returns_friendly_404(client):
    resp = _chat(client, "Hello?", ["missing-id"])
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_chat_no_answer_when_information_absent(client, uploaded_doc):
    resp = _chat(client, "What is the capital of Mars?", [uploaded_doc["id"]])
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == NO_ANSWER
    assert body["answer"] == "I could not find this information in the uploaded documents."
    assert body["sources"] == []


def test_chat_known_answer_with_sources(client, uploaded_doc):
    resp = _chat(client, "What is the refund window?", [uploaded_doc["id"]])
    assert resp.status_code == 200
    body = resp.json()
    assert "30-day" in body["answer"]
    assert body["sources"], "known answers must include sources"
    for src in body["sources"]:
        assert src["filename"] == "acme-refund-policy.pdf"
        assert src["page"] >= 1
        assert src["text"]
        assert len(src["text"]) <= 320


def test_chat_support_email_answer(client, uploaded_doc):
    resp = _chat(client, "What is the support email address?", [uploaded_doc["id"]])
    assert resp.status_code == 200
    body = resp.json()
    assert "support@acme.example" in body["answer"]
    assert body["sources"]


def test_chat_before_processing_returns_409(client, sample_pdf_bytes):
    # A scanned (needs_ocr) document is not ready for chat.
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    blank = bytes(pdf.output())
    up = client.post(
        "/api/documents/upload",
        files={"file": ("scan.pdf", blank, "application/pdf")},
    )
    assert up.status_code == 201
    doc_id = up.json()["id"]
    resp = _chat(client, "What is this about?", [doc_id])
    assert resp.status_code == 409
    assert "not ready yet" in resp.json()["detail"]


def test_chat_history_roundtrip(client, uploaded_doc):
    _chat(client, "What is the refund window?", [uploaded_doc["id"]])
    resp = client.get("/api/chat/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    roles = [m["role"] for m in body["messages"]]
    assert roles == ["user", "assistant"]  # newest last
    assert body["messages"][0]["content"] == "What is the refund window?"
    assert body["messages"][0]["document_ids"] == [uploaded_doc["id"]]

    clear = client.delete("/api/chat/history")
    assert clear.status_code == 200
    assert client.get("/api/chat/history").json()["total"] == 0


def test_delete_document_cascades_chat_and_vectors(client, uploaded_doc):
    doc_id = uploaded_doc["id"]
    _chat(client, "What is the refund window?", [doc_id])
    assert client.get("/api/chat/history").json()["total"] == 2

    assert client.delete(f"/api/documents/{doc_id}").status_code == 200

    # Chat history referencing the document is gone.
    assert client.get("/api/chat/history").json()["total"] == 0
    # Chat against the deleted document is a clean 404.
    resp = _chat(client, "What is the refund window?", [doc_id])
    assert resp.status_code == 404
    # No vectors remain for the document.
    from app.config import get_settings
    from app.services.vector_service import get_vector_store

    assert get_vector_store(get_settings()).count() == 0


def test_internal_errors_never_leak_details(client, uploaded_doc, make_client, monkeypatch):
    import app.routes.chat as chat_routes

    def _boom(**kwargs):
        raise RuntimeError("secret internal path /tmp/hidden")

    monkeypatch.setattr(chat_routes, "answer_question", _boom)
    # raise_server_exceptions=False so the test client returns the 500
    # response instead of re-raising (Starlette always re-raises server
    # errors to the test client after sending the response).
    safe_client = make_client(raise_server_exceptions=False)
    resp = safe_client.post(
        "/api/chat",
        json={"question": "What is the refund window?", "document_ids": [uploaded_doc["id"]]},
    )
    assert resp.status_code == 500
    body_text = json.dumps(resp.json())
    assert "secret" not in body_text
    assert "/tmp/hidden" not in body_text
    assert "traceback" not in body_text.lower()
    assert resp.json()["detail"] == "An unexpected error occurred. Please try again later."
