"""Central configuration.

Every setting comes from an environment variable with a sensible default,
so the app runs with zero configuration and no secrets are ever hard-coded.
See / .env.example at the project root for the full list.
"""
from __future__ import annotations

import os
from functools import lru_cache


def _project_root() -> str:
    # backend/app/config.py -> backend -> project root
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        root = _project_root()
        self.project_root = root
        self.database_url = os.environ.get(
            "DATABASE_URL", f"sqlite:///{root}/data/documind.db"
        )
        self.vector_store_dir = os.environ.get(
            "VECTOR_STORE_DIR", os.path.join(root, "data", "vector_store")
        )
        self.upload_dir = os.environ.get(
            "UPLOAD_DIR", os.path.join(root, "data", "uploads")
        )
        self.max_upload_mb = int(os.environ.get("MAX_UPLOAD_MB", "20"))
        self.chunk_size = int(os.environ.get("CHUNK_SIZE", "800"))
        self.chunk_overlap = int(os.environ.get("CHUNK_OVERLAP", "150"))
        self.top_k = int(os.environ.get("TOP_K", "5"))
        self.similarity_threshold = float(os.environ.get("SIMILARITY_THRESHOLD", "0.30"))
        self.mock_mode = _as_bool(os.environ.get("MOCK_MODE"), True)

        self.embedding_api_url = os.environ.get("EMBEDDING_API_URL", "")
        self.embedding_api_key = os.environ.get("EMBEDDING_API_KEY", "")
        self.embedding_model = os.environ.get("EMBEDDING_MODEL", "")
        self.llm_api_url = os.environ.get("LLM_API_URL", "")
        self.llm_api_key = os.environ.get("LLM_API_KEY", "")
        self.llm_model = os.environ.get("LLM_MODEL", "")
        self.http_timeout_s = float(os.environ.get("HTTP_TIMEOUT_S", "30"))

        origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]

        self.env = os.environ.get("APP_ENV", "development")
        self.version = "0.1.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
