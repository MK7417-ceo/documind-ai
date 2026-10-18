"""Embeddings: real OpenAI-compatible API, or a deterministic local mock.

MOCK MODE (default) is a LOCAL-TESTING BASELINE, NOT production quality: it
uses hashed word n-gram embeddings (384-dim, L2-normalised) with stopword
removal and light stemming. Retrieval works for local tests and demos, but
for production set MOCK_MODE=false and point EMBEDDING_API_URL at a real
embedding API.
"""
from __future__ import annotations

import hashlib
import re

import httpx
import numpy as np

EMBEDDING_DIM = 384

_STOPWORDS = frozenset(
    """
    a an the and or but if then else when while of at by for with about into
    through during before after above below to from up down in out on off over
    under again further once here there all any both each few more most other
    some such no nor only own same so than too very can will just don should
    now i you he she it we they them his her its our their this that these
    those what which who whom whose is am are was were be been being have has
    had having do does did doing would could ought shall may might must my
    your me him us as
    """.split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _stem(token: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            return token[: -len(suffix)]
    return token


def tokenize(text: str) -> list[str]:
    """Lower-cased content tokens: alphanumerics, stopwords removed, stemmed."""
    tokens = []
    for raw in _TOKEN_RE.findall(text.lower()):
        if len(raw) < 2 or raw in _STOPWORDS:
            continue
        tokens.append(_stem(raw))
    return tokens


def _hash_index(term: str) -> int:
    digest = hashlib.md5(term.encode("utf-8")).hexdigest()
    return int(digest, 16) % EMBEDDING_DIM


def mock_embed_texts(texts: list[str]) -> np.ndarray:
    """Deterministic hashed unigram+bigram embeddings, L2-normalised."""
    vectors = np.zeros((len(texts), EMBEDDING_DIM), dtype=np.float32)
    for row, text in enumerate(texts):
        tokens = tokenize(text)
        for i, tok in enumerate(tokens):
            vectors[row, _hash_index("u:" + tok)] += 1.0
            if i > 0:
                vectors[row, _hash_index("b:" + tokens[i - 1] + " " + tok)] += 1.0
        norm = float(np.linalg.norm(vectors[row]))
        if norm > 0:
            vectors[row] /= norm
    return vectors


def coverage_score(question: str, chunk_text: str) -> float | None:
    """Fraction of the question's content tokens present in the chunk.

    Used as the similarity-threshold signal in mock mode (sparse hashed
    vectors have low absolute cosine for short queries, so a calibrated
    query-coverage score in [0, 1] is the honest local baseline).
    Returns None when the question has no content tokens.
    """
    q = set(tokenize(question))
    if not q:
        return None
    d = set(tokenize(chunk_text))
    return len(q & d) / len(q)


class EmbeddingError(Exception):
    """Raised when embeddings cannot be produced (API failure / misconfig)."""


def _post_with_retry(url: str, headers: dict, payload: dict, timeout: float) -> dict:
    last_exc: Exception | None = None
    for _ in range(2):  # 1 retry
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # network error, timeout, HTTP error
            last_exc = exc
    raise EmbeddingError(f"Embedding request failed: {type(last_exc).__name__}") from last_exc


class EmbeddingService:
    mock = True

    def __init__(self, settings) -> None:
        self.settings = settings

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        raise NotImplementedError

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed_texts([text])[0]


class MockEmbeddingService(EmbeddingService):
    mock = True

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        return mock_embed_texts(texts)


class ApiEmbeddingService(EmbeddingService):
    mock = False

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        s = self.settings
        if not s.embedding_api_url or not s.embedding_api_key or not s.embedding_model:
            raise EmbeddingError(
                "Embedding API is not configured. Set EMBEDDING_API_URL, "
                "EMBEDDING_API_KEY and EMBEDDING_MODEL, or use MOCK_MODE=true."
            )
        url = s.embedding_api_url.rstrip("/") + "/embeddings"
        headers = {"Authorization": f"Bearer {s.embedding_api_key}"}
        payload = {"model": s.embedding_model, "input": texts}
        data = _post_with_retry(url, headers, payload, s.http_timeout_s)
        try:
            items = sorted(data["data"], key=lambda d: d["index"])
            arr = np.array([it["embedding"] for it in items], dtype=np.float32)
        except (KeyError, TypeError, ValueError) as exc:
            raise EmbeddingError("Embedding API returned an unexpected response.") from exc
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return arr / norms


def get_embedding_service(settings) -> EmbeddingService:
    if settings.mock_mode:
        return MockEmbeddingService(settings)
    return ApiEmbeddingService(settings)
