"""Rate limiting via slowapi (in-memory, per IP)."""
from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again."},
    )


def reset_rate_limits() -> None:
    """Clear in-memory counters (used by tests)."""
    try:
        limiter._storage.reset()
    except Exception:
        pass
