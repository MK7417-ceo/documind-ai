"""Document upload / listing / details / deletion endpoints."""
from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import limiter
from ..models import ChatMessage, Document, DocumentChunk
from ..schemas import DocumentDetailResponse, DocumentListResponse, DocumentResponse
from ..services.chunking_service import chunk_pages
from ..services.embedding_service import EmbeddingError, get_embedding_service
from ..services.pdf_service import (
    CorruptPdfError,
    PasswordProtectedError,
    extract_pages,
)
from ..services.vector_service import VectorStoreError, get_vector_store
from ..utils.security import (
    generate_stored_filename,
    is_pdf_magic,
    sanitize_filename,
    sha256_bytes,
)

logger = logging.getLogger("documind")

router = APIRouter(prefix="/documents", tags=["documents"])

NEEDS_OCR_MESSAGE = (
    "This looks like a scanned PDF — OCR is required to extract text from it. "
    "Please upload a text-based PDF, or enable OCR support and try again."
)


async def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    """Read the upload in 1 MB pieces; abort as soon as the limit is exceeded."""
    chunks: list[bytes] = []
    total = 0
    while True:
        piece = await upload.read(1024 * 1024)
        if not piece:
            break
        total += len(piece)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=(
                    "File too large. Maximum upload size is "
                    f"{max_bytes // (1024 * 1024)} MB per file."
                ),
            )
        chunks.append(piece)
    return b"".join(chunks)


def _set_status(db: Session, doc: Document, status: str) -> None:
    doc.status = status
    db.commit()


def _safe_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


def _process_document(
    doc: Document, data: bytes, db: Session, settings
) -> str | None:
    """Run the RAG pipeline, updating doc.status through each stage.

    Returns a user-facing message for needs_ocr, else None.
    """
    _set_status(db, doc, "extracting")
    pages = extract_pages(data)
    doc.page_count = len(pages)
    db.commit()

    _set_status(db, doc, "chunking")
    chunks = chunk_pages(
        pages,
        document_id=doc.id,
        filename=doc.original_filename,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    if not chunks or not any(c.content.strip() for c in chunks):
        _set_status(db, doc, "needs_ocr")
        return NEEDS_OCR_MESSAGE

    _set_status(db, doc, "embedding")
    embeddings = get_embedding_service(settings).embed_texts(
        [c.content for c in chunks]
    )

    _set_status(db, doc, "indexing")
    entries = [
        {
            "vector_id": f"{doc.id}_{c.chunk_index}",
            "embedding": embeddings[i],
            "metadata": {
                "document_id": doc.id,
                "filename": doc.original_filename,
                "page_number": c.page_number,
                "chunk_index": c.chunk_index,
            },
        }
        for i, c in enumerate(chunks)
    ]
    get_vector_store(settings).add_chunks(entries)
    for c in chunks:
        db.add(
            DocumentChunk(
                document_id=doc.id,
                chunk_index=c.chunk_index,
                page_number=c.page_number,
                content=c.content,
                vector_id=f"{doc.id}_{c.chunk_index}",
            )
        )
    doc.chunk_count = len(chunks)
    _set_status(db, doc, "ready")
    return None


def _to_detail(doc: Document, message: str | None = None) -> DocumentDetailResponse:
    return DocumentDetailResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        page_count=doc.page_count,
        status=doc.status,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        message=message,
    )


@router.post("/upload", response_model=DocumentDetailResponse, status_code=201)
@limiter.limit("10/minute")
async def upload_document(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    settings = get_settings()
    filename = file.filename or ""

    # 1. Validate type by extension, then by magic bytes.
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )
    data = await _read_limited(file, settings.max_upload_mb * 1024 * 1024)
    if not is_pdf_magic(data):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF. Please check the file and try again.",
        )

    # 2. Duplicate detection via SHA-256.
    digest = sha256_bytes(data)
    existing = db.query(Document).filter(Document.sha256 == digest).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "This document has already been uploaded as "
                f"'{existing.original_filename}'."
            ),
        )

    # 3. Store safely under a generated name.
    os.makedirs(settings.upload_dir, exist_ok=True)
    stored = generate_stored_filename()
    stored_path = os.path.join(settings.upload_dir, stored)
    with open(stored_path, "wb") as f:
        f.write(data)

    doc = Document(
        original_filename=sanitize_filename(filename),
        stored_filename=stored,
        file_size=len(data),
        sha256=digest,
        status="uploading",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 4. Run the pipeline synchronously (status transitions are visible in DB).
    try:
        message = _process_document(doc, data, db, settings)
    except (PasswordProtectedError, CorruptPdfError) as exc:
        db.delete(doc)
        db.commit()
        _safe_unlink(stored_path)
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except (EmbeddingError, VectorStoreError) as exc:
        logger.error("Pipeline service failure for %s: %s", doc.id, exc)
        _set_status(db, doc, "failed")
        raise HTTPException(
            status_code=502,
            detail="Document processing failed because a backend service was "
            "unavailable. Please try again later.",
        )
    except Exception as exc:  # never leak tracebacks or paths
        logger.error("Pipeline failure for %s: %s", doc.id, exc)
        _set_status(db, doc, "failed")
        raise HTTPException(
            status_code=500,
            detail="Document processing failed unexpectedly. Please try again.",
        )

    db.refresh(doc)
    return _to_detail(doc, message)


@router.get("", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=len(docs),
    )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    message = NEEDS_OCR_MESSAGE if doc.status == "needs_ocr" else None
    return _to_detail(doc, message)


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    settings = get_settings()
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove vectors, the stored file, chat messages and the DB rows (cascade).
    try:
        get_vector_store(settings).delete_document(doc.id)
    except VectorStoreError as exc:
        logger.error("Vector delete failed for %s: %s", doc.id, exc)
    _safe_unlink(os.path.join(settings.upload_dir, doc.stored_filename))

    for msg in db.query(ChatMessage).all():
        if msg.document_ids_json:
            try:
                ids = json.loads(msg.document_ids_json)
            except (json.JSONDecodeError, TypeError):
                continue
            if document_id in ids:
                db.delete(msg)

    name = doc.original_filename
    db.delete(doc)  # cascades to chunks + directly-linked messages
    db.commit()
    return {"detail": f"Document '{name}' and all its data were deleted."}
