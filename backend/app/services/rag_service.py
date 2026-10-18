"""RAG orchestration: retrieve -> threshold -> strict-prompt LLM answer."""
from __future__ import annotations

from .embedding_service import coverage_score, get_embedding_service
from .llm_service import build_context_block, get_llm_service  # noqa: F401 (re-exported for tests)
from ..models import Document, DocumentChunk
from .vector_service import get_vector_store

# Returned verbatim when the documents contain no usable answer.
NO_ANSWER = "I could not find this information in the uploaded documents."

SOURCE_PREVIEW_CHARS = 300


class DocumentNotFoundError(Exception):
    pass


class DocumentNotReadyError(Exception):
    def __init__(self, filename: str, status: str) -> None:
        self.filename = filename
        self.status = status
        super().__init__(
            f"Document '{filename}' is not ready yet (status: {status}). "
            "Please wait until processing finishes and try again."
        )


def _threshold_score(question: str, chunk_text: str, cosine: float, mock: bool) -> float:
    """Similarity signal compared against SIMILARITY_THRESHOLD.

    Real mode: cosine similarity from the embedding API (dense vectors, so
    0.30 is a sensible bar). Mock mode: query-coverage score in [0, 1]
    (sparse hashed vectors give low absolute cosine for short queries, so
    coverage is the honest local baseline); falls back to cosine when the
    question has no content tokens.
    """
    if not mock:
        return cosine
    coverage = coverage_score(question, chunk_text)
    return coverage if coverage is not None else max(cosine, 0.0)


def answer_question(
    *,
    question: str,
    document_ids: list[str],
    db,
    settings,
) -> dict:
    docs = {
        d.id: d
        for d in db.query(Document).filter(Document.id.in_(document_ids)).all()
    }
    missing = [i for i in document_ids if i not in docs]
    if missing:
        raise DocumentNotFoundError(
            f"Document(s) not found: {', '.join(missing)}"
        )
    not_ready = [d for d in docs.values() if d.status != "ready"]
    if not_ready:
        d = not_ready[0]
        raise DocumentNotReadyError(d.original_filename, d.status)

    embedder = get_embedding_service(settings)
    query_embedding = embedder.embed_query(question)

    store = get_vector_store(settings)
    hits = store.query(query_embedding, document_ids, settings.top_k)
    if not hits:
        return {"answer": NO_ANSWER, "sources": []}

    # Attach chunk text from SQLite and score each hit.
    vector_ids = [h["vector_id"] for h in hits]
    chunks = {
        c.vector_id: c
        for c in db.query(DocumentChunk)
        .filter(DocumentChunk.vector_id.in_(vector_ids))
        .all()
    }
    scored = []
    for hit in hits:
        chunk = chunks.get(hit["vector_id"])
        if chunk is None:
            continue
        score = _threshold_score(
            question, chunk.content, hit["score"], settings.mock_mode
        )
        scored.append((score, hit, chunk))
    if not scored:
        return {"answer": NO_ANSWER, "sources": []}

    scored.sort(key=lambda t: -t[0])
    best_score = scored[0][0]
    if best_score < settings.similarity_threshold:
        return {"answer": NO_ANSWER, "sources": []}

    context_sources = []
    for score, hit, chunk in scored[:3]:
        meta = hit["metadata"] or {}
        context_sources.append(
            {
                "filename": meta.get("filename") or docs[chunk.document_id].original_filename,
                "page": int(meta.get("page_number") or chunk.page_number),
                "text": chunk.content,
                "score": round(float(score), 3),
            }
        )

    llm = get_llm_service(settings)
    answer = llm.generate(question, context_sources)

    sources = [
        {
            "filename": s["filename"],
            "page": s["page"],
            "text": s["text"][:SOURCE_PREVIEW_CHARS],
            "score": s["score"],
        }
        for s in context_sources
    ]
    return {"answer": answer, "sources": sources}
