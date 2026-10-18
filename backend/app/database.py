"""SQLAlchemy engine / session wiring.

``init_db`` must be called once at startup (or per-test) before sessions
are used; ``get_db`` is the FastAPI dependency that yields a session.
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

_engine = None
_SessionLocal = None


def init_db(database_url: str):
    global _engine, _SessionLocal
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    if database_url.startswith("sqlite"):
        # Ensure the parent directory of a file-based sqlite DB exists.
        path = database_url.split("sqlite:///", 1)[-1]
        if path and path != ":memory:":
            parent = os.path.dirname(os.path.abspath(path))
            os.makedirs(parent, exist_ok=True)
    _engine = create_engine(database_url, connect_args=connect_args)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def get_engine():
    if _engine is None:
        raise RuntimeError("Database not initialised: call init_db() first.")
    return _engine


def create_tables() -> None:
    Base.metadata.create_all(get_engine())


def drop_tables() -> None:
    Base.metadata.drop_all(get_engine())


def get_db():
    if _SessionLocal is None:
        raise RuntimeError("Database not initialised: call init_db() first.")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
