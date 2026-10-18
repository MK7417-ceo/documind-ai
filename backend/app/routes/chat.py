"""Chat endpoints: ask questions, read history, clear history."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import limiter
from ..models import ChatMessage
from ..schemas import ChatHistoryResponse, ChatMessageResponse, ChatRequest, ChatResponse
from ..services.embedding_service import EmbeddingError
from ..services.llm_service import LLMError
from ..services.rag_service import (
    DocumentNotFoundError,
    DocumentNotReadyError,
    answer_question,
)
from ..services.vector_service import VectorStoreError

logger = logging.getLogger("documind")

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("30/minute")
def chat(request: Request, payload: ChatRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=422, detail="Question must not be empty."
        )
    try:
        result = answer_question(
            question=question,
            document_ids=payload.document_ids,
            db=db,
            settings=settings,
        )
    except DocumentNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="One or more documents were not found. Upload a document first.",
        )
    except DocumentNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except (EmbeddingError, LLMError, VectorStoreError) as exc:
        logger.error("Chat service failure: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="The AI service is temporarily unavailable. Please try again later.",
        )

    ids_json = json.dumps(payload.document_ids)
    db.add(
        ChatMessage(
            document_id=payload.document_ids[0],
            role="user",
            content=question,
            document_ids_json=ids_json,
        )
    )
    db.add(
        ChatMessage(
            document_id=payload.document_ids[0],
            role="assistant",
            content=result["answer"],
            document_ids_json=ids_json,
        )
    )
    db.commit()
    return ChatResponse(answer=result["answer"], sources=result["sources"])


@router.get("/history", response_model=ChatHistoryResponse)
def get_history(
    limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)
):
    rows = (
        db.query(ChatMessage)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()[::-1]  # newest last
    )
    messages = []
    for r in rows:
        ids = None
        if r.document_ids_json:
            try:
                ids = json.loads(r.document_ids_json)
            except (json.JSONDecodeError, TypeError):
                ids = None
        messages.append(
            ChatMessageResponse(
                id=r.id,
                role=r.role,
                content=r.content,
                document_ids=ids,
                created_at=r.created_at,
            )
        )
    return ChatHistoryResponse(messages=messages, total=len(messages))


@router.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    count = db.query(ChatMessage).delete()
    db.commit()
    return {"detail": f"Cleared {count} chat message(s)."}
