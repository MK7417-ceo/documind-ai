"""Health endpoint tests."""
from __future__ import annotations


def test_health_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["mock_mode"] is True
    assert body["documents"] == 0
    assert body["version"]


def test_health_reflects_uploads(client, uploaded_doc):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["documents"] == 1
