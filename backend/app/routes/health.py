"""Health check endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Document
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    settings = get_settings()
    return HealthResponse(
        status="ok",
        mock_mode=settings.mock_mode,
        documents=db.query(Document).count(),
        version=settings.version,
    )
