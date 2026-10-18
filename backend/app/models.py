"""SQLAlchemy models for documents, chunks and chat history."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(32), primary_key=True, default=_uuid)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    page_count = Column(Integer, nullable=False, default=0)
    sha256 = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(32), nullable=False, default="uploading", index=True)
    chunk_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )
    messages = relationship(
        "ChatMessage", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(32), primary_key=True, default=_uuid)
    document_id = Column(
        String(32), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    vector_id = Column(String(64), nullable=False, unique=True)

    document = relationship("Document", back_populates="chunks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(32), primary_key=True, default=_uuid)
    document_id = Column(
        String(32), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role = Column(String(16), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    document_ids_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    document = relationship("Document", back_populates="messages")
