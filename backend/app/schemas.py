"""Pydantic v2 request/response schemas. All API input is validated here."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    file_size: int
    page_count: int
    status: str
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetailResponse(DocumentResponse):
    message: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[str] = Field(min_length=1, max_length=20)


class SourceItem(BaseModel):
    filename: str
    page: int
    text: str
    score: Optional[float] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    document_ids: Optional[list[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
    total: int


class HealthResponse(BaseModel):
    status: str
    mock_mode: bool
    documents: int
    version: str
