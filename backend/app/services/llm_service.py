"""LLM answering: strict document-grounded prompt, real or mock backend.

MOCK MODE is a LOCAL-TESTING BASELINE, NOT production quality: the mock LLM
builds an extractive answer from the retrieved chunks (top overlapping
sentences + source citations) instead of generating text. Set MOCK_MODE=false
with LLM_API_URL/LLM_API_KEY/LLM_MODEL for a real OpenAI-compatible model.
"""
from __future__ import annotations

import httpx

from .chunking_service import split_sentences
from .embedding_service import tokenize

# Used verbatim by both the mock and the real LLM path.
SYSTEM_PROMPT = (
    "You answer questions only using the provided document context. "
    "Do not use outside knowledge. "
    "Do not guess. "
    "If the answer is not available in the context, say: "
    '"I could not find this information in the uploaded documents." '
    "Keep the answer clear and concise. "
    "Cite the source filename and page number when possible."
)


class LLMError(Exception):
    """Raised when the language model cannot produce an answer."""


def build_context_block(sources: list[dict]) -> str:
    parts = []
    for s in sources:
        parts.append(
            f"[Source: {s['filename']}, page {s['page']}]\n{s['text']}"
        )
    return "\n\n".join(parts)


def build_user_prompt(question: str, sources: list[dict]) -> str:
    return (
        "Answer the question using ONLY the document context below.\n\n"
        f"Question: {question}\n\n"
        f"Document context:\n{build_context_block(sources)}"
    )


def mock_extractive_answer(question: str, sources: list[dict]) -> str:
    """Pick the sentences from the retrieved chunks that overlap the question
    most, and present them with source citations. Extractive = cannot invent
    facts beyond what the chunks contain."""
    q_tokens = set(tokenize(question))
    scored: list[tuple[int, int, str, dict]] = []
    for src in sources:
        for sent in split_sentences(src["text"]):
            overlap = len(q_tokens & set(tokenize(sent)))
            if overlap > 0:
                scored.append((overlap, len(sent), sent, src))
    scored.sort(key=lambda t: (-t[0], t[1]))

    picked: list[str] = []
    seen: set[str] = set()
    for _, _, sent, _ in scored:
        key = sent.strip().lower()
        if key not in seen:
            seen.add(key)
            picked.append(sent.strip())
        if len(picked) >= 3:
            break
    if not picked:  # question had no content tokens; show the top chunk
        picked = [sources[0]["text"][:400].strip()]

    cites = ", ".join(
        f"{s['filename']} (page {s['page']})" for s in sources[:3]
    )
    return (
        "Based on the uploaded documents:\n\n"
        + " ".join(picked)
        + f"\n\nSources: {cites}."
    )


def _post_with_retry(url: str, headers: dict, payload: dict, timeout: float) -> dict:
    last_exc: Exception | None = None
    for _ in range(2):  # 1 retry
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            last_exc = exc
    raise LLMError(f"LLM request failed: {type(last_exc).__name__}") from last_exc


class LLMService:
    mock = True

    def __init__(self, settings) -> None:
        self.settings = settings

    def generate(self, question: str, sources: list[dict]) -> str:
        raise NotImplementedError


class MockLLMService(LLMService):
    mock = True

    def generate(self, question: str, sources: list[dict]) -> str:
        if not sources:
            raise LLMError("No source context available.")
        return mock_extractive_answer(question, sources)


class ApiLLMService(LLMService):
    mock = False

    def generate(self, question: str, sources: list[dict]) -> str:
        s = self.settings
        if not s.llm_api_url or not s.llm_api_key or not s.llm_model:
            raise LLMError(
                "LLM API is not configured. Set LLM_API_URL, LLM_API_KEY and "
                "LLM_MODEL, or use MOCK_MODE=true."
            )
        url = s.llm_api_url.rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {s.llm_api_key}"}
        payload = {
            "model": s.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(question, sources)},
            ],
            "temperature": 0.0,
        }
        data = _post_with_retry(url, headers, payload, s.http_timeout_s)
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, TypeError, IndexError) as exc:
            raise LLMError("LLM API returned an unexpected response.") from exc


def get_llm_service(settings) -> LLMService:
    if settings.mock_mode:
        return MockLLMService(settings)
    return ApiLLMService(settings)
