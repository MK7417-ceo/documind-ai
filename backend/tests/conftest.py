"""Pytest fixtures: isolated app per test (tmp DB, tmp dirs, MOCK_MODE=true)."""
from __future__ import annotations

import importlib.util
import os
import sys

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _make_client(tmp_path, monkeypatch, extra_env, raise_server_exceptions=True):
    data = tmp_path / "data"
    data.mkdir(parents=True, exist_ok=True)
    env = {
        "DATABASE_URL": f"sqlite:///{data / 'documind.db'}",
        "VECTOR_STORE_DIR": str(data / "vector_store"),
        "UPLOAD_DIR": str(data / "uploads"),
        "MOCK_MODE": "true",
        "CORS_ORIGINS": "http://localhost:5173",
    }
    env.update(extra_env or {})
    for k, v in env.items():
        monkeypatch.setenv(k, v)

    from app.config import get_settings

    get_settings.cache_clear()
    from app.middleware.rate_limit import reset_rate_limits

    reset_rate_limits()
    from app.services.vector_service import reset_vector_store_cache

    reset_vector_store_cache()
    from app.main import create_app

    return TestClient(create_app(), raise_server_exceptions=raise_server_exceptions)


@pytest.fixture()
def make_client(tmp_path, monkeypatch):
    def _make(extra_env=None, raise_server_exceptions=True):
        return _make_client(
            tmp_path, monkeypatch, extra_env, raise_server_exceptions
        )

    return _make


@pytest.fixture()
def client(make_client):
    return make_client()


def _load_sample_pdf_module():
    path = os.path.join(BACKEND_DIR, "..", "scripts", "make_sample_pdf.py")
    spec = importlib.util.spec_from_file_location("make_sample_pdf", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def sample_pdf_path(tmp_path):
    module = _load_sample_pdf_module()
    path = str(tmp_path / "acme-refund-policy.pdf")
    module.create_sample_pdf(path)
    return path


@pytest.fixture()
def sample_pdf_bytes(sample_pdf_path):
    with open(sample_pdf_path, "rb") as f:
        return f.read()


@pytest.fixture()
def uploaded_doc(client, sample_pdf_bytes):
    resp = client.post(
        "/api/documents/upload",
        files={
            "file": ("acme-refund-policy.pdf", sample_pdf_bytes, "application/pdf")
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
