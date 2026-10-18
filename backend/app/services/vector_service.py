"""Vector store with a small, swappable interface.

Preferred backend: ChromaDB in persistent local mode. We always supply our
own embeddings (``embeddings=`` / ``query_embeddings=``), so ChromaDB never
downloads a model. If ChromaDB cannot be imported, we fall back to a real
numpy-based store persisted as ``.npz`` in the same directory.

Interface (so PostgreSQL/pgvector can be added later):
    add_chunks(entries)  -> None
    query(query_embedding, document_ids, top_k) -> list of scored hits
    delete_document(document_id) -> None
    delete_all() -> None
    count() -> int

A hit is ``{"vector_id": str, "score": float, "metadata": dict}`` where
``score`` is cosine similarity in [-1, 1] and metadata carries
``document_id``, ``filename``, ``page_number`` and ``chunk_index``.
"""
from __future__ import annotations

import json
import logging
import os

import numpy as np

from .embedding_service import EMBEDDING_DIM

logger = logging.getLogger("documind")

COLLECTION_NAME = "documind_chunks"


class VectorStoreError(Exception):
    """Raised when the vector database operation fails."""


class VectorStore:
    def add_chunks(self, entries: list[dict]) -> None:
        raise NotImplementedError

    def query(
        self, query_embedding: np.ndarray, document_ids: list[str], top_k: int
    ) -> list[dict]:
        raise NotImplementedError

    def delete_document(self, document_id: str) -> None:
        raise NotImplementedError

    def delete_all(self) -> None:
        raise NotImplementedError

    def count(self) -> int:
        raise NotImplementedError


class ChromaVectorStore(VectorStore):
    def __init__(self, persist_dir: str) -> None:
        os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
        import chromadb  # noqa: PLC0415 - optional import, decided at runtime

        os.makedirs(persist_dir, exist_ok=True)
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(self, entries: list[dict]) -> None:
        if not entries:
            return
        try:
            self._collection.add(
                ids=[e["vector_id"] for e in entries],
                embeddings=[
                    np.asarray(e["embedding"], dtype=np.float32).tolist()
                    for e in entries
                ],
                metadatas=[e["metadata"] for e in entries],
            )
        except Exception as exc:
            raise VectorStoreError(f"Vector store write failed: {exc}") from exc

    def query(
        self, query_embedding: np.ndarray, document_ids: list[str], top_k: int
    ) -> list[dict]:
        if top_k <= 0 or not document_ids:
            return []
        try:
            res = self._collection.query(
                query_embeddings=[
                    np.asarray(query_embedding, dtype=np.float32).tolist()
                ],
                n_results=top_k,
                where={"document_id": {"$in": list(document_ids)}},
                include=["metadatas", "distances"],
            )
        except Exception as exc:
            raise VectorStoreError(f"Vector store query failed: {exc}") from exc
        hits = []
        for vid, dist, meta in zip(
            res["ids"][0], res["distances"][0], res["metadatas"][0]
        ):
            # cosine distance -> cosine similarity
            hits.append(
                {"vector_id": vid, "score": float(1.0 - dist), "metadata": meta or {}}
            )
        return hits

    def delete_document(self, document_id: str) -> None:
        try:
            self._collection.delete(where={"document_id": document_id})
        except Exception as exc:
            raise VectorStoreError(f"Vector store delete failed: {exc}") from exc

    def delete_all(self) -> None:
        try:
            self._client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
        )

    def count(self) -> int:
        return self._collection.count()


class NumpyVectorStore(VectorStore):
    """Real fallback vector store: brute-force cosine over L2-normalised
    vectors, persisted to ``numpy_store.npz`` so it survives restarts."""

    def __init__(self, persist_dir: str) -> None:
        os.makedirs(persist_dir, exist_ok=True)
        self._path = os.path.join(persist_dir, "numpy_store.npz")
        self._ids: list[str] = []
        self._metas: list[dict] = []
        self._matrix = np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        self._load()

    # -- persistence -----------------------------------------------------
    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            data = np.load(self._path, allow_pickle=True)
            self._ids = [str(x) for x in data["ids"]]
            self._metas = [json.loads(x) for x in data["metas"]]
            self._matrix = np.asarray(data["matrix"], dtype=np.float32)
        except Exception as exc:
            logger.warning("Could not load numpy vector store: %s", exc)

    def _save(self) -> None:
        np.savez(
            self._path,
            ids=np.array(self._ids),
            matrix=self._matrix,
            metas=np.array([json.dumps(m) for m in self._metas]),
        )

    # -- interface -------------------------------------------------------
    def add_chunks(self, entries: list[dict]) -> None:
        if not entries:
            return
        vecs = [np.asarray(e["embedding"], dtype=np.float32) for e in entries]
        self._ids.extend(e["vector_id"] for e in entries)
        self._metas.extend(e["metadata"] for e in entries)
        self._matrix = (
            np.vstack([self._matrix] + vecs) if vecs else self._matrix
        )
        self._save()

    def query(
        self, query_embedding: np.ndarray, document_ids: list[str], top_k: int
    ) -> list[dict]:
        if top_k <= 0 or not document_ids or not self._ids:
            return []
        q = np.asarray(query_embedding, dtype=np.float32)
        n = float(np.linalg.norm(q))
        if n > 0:
            q = q / n
        sims = self._matrix @ q  # embeddings are L2-normalised -> cosine
        order = np.argsort(-sims)
        hits = []
        wanted = set(document_ids)
        for idx in order:
            meta = self._metas[int(idx)]
            if meta.get("document_id") not in wanted:
                continue
            hits.append(
                {
                    "vector_id": self._ids[int(idx)],
                    "score": float(sims[int(idx)]),
                    "metadata": meta,
                }
            )
            if len(hits) >= top_k:
                break
        return hits

    def delete_document(self, document_id: str) -> None:
        keep = [
            i
            for i, m in enumerate(self._metas)
            if m.get("document_id") != document_id
        ]
        self._ids = [self._ids[i] for i in keep]
        self._metas = [self._metas[i] for i in keep]
        self._matrix = self._matrix[keep] if keep else np.zeros(
            (0, EMBEDDING_DIM), dtype=np.float32
        )
        self._save()

    def delete_all(self) -> None:
        self._ids, self._metas = [], []
        self._matrix = np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        self._save()

    def count(self) -> int:
        return len(self._ids)


_stores: dict[str, VectorStore] = {}


def get_vector_store(settings) -> VectorStore:
    """Return the cached store for this directory (ChromaDB, else numpy)."""
    key = os.path.abspath(settings.vector_store_dir)
    if key not in _stores:
        try:
            _stores[key] = ChromaVectorStore(key)
            backend = "chromadb"
        except Exception as exc:
            logger.warning("ChromaDB unavailable (%s); using numpy store.", exc)
            _stores[key] = NumpyVectorStore(key)
            backend = "numpy"
        logger.info("Vector store backend: %s at %s", backend, key)
    return _stores[key]


def reset_vector_store_cache() -> None:
    """Drop cached stores (used by tests to get a fresh directory)."""
    _stores.clear()
