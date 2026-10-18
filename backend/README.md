# DocuMind AI — Backend

FastAPI backend for **DocuMind AI**, an AI-powered document question-answering
(RAG) system. Upload PDFs, ask questions, get answers grounded *only* in the
uploaded documents with source citations (filename + page number).

## Quick start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: copy and edit config (all settings have defaults, so this is optional)
cp ../.env.example ../.env

# Generate the sample PDF used for demos/tests
python ../scripts/make_sample_pdf.py

# Run the API
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Configuration

All settings are environment variables (see `../.env.example`). The important ones:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///<root>/data/documind.db` | SQLAlchemy URL (SQLite locally) |
| `VECTOR_STORE_DIR` | `<root>/data/vector_store` | ChromaDB persistent dir |
| `UPLOAD_DIR` | `<root>/data/uploads` | Stored PDFs |
| `MAX_UPLOAD_MB` | `20` | Per-file upload limit |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `800` / `150` | Chunking (chars) |
| `TOP_K` | `5` | Retrieved chunks per question |
| `SIMILARITY_THRESHOLD` | `0.30` | Below this → "not found" answer |
| `MOCK_MODE` | `true` | Local mock embeddings + mock LLM |
| `EMBEDDING_API_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` | — | OpenAI-compatible embeddings (when `MOCK_MODE=false`) |
| `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` | — | OpenAI-compatible chat API (when `MOCK_MODE=false`) |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins |

### Mock mode (default)

`MOCK_MODE=true` uses a **local-testing baseline, not production quality**:

- **Embeddings:** deterministic hashed word n-gram vectors (384-dim,
  L2-normalised, stopwords removed, light stemming). No downloads, no API.
- **LLM:** extractive "mock LLM" that answers by quoting the most relevant
  sentences from the retrieved chunks and citing filename + page. It cannot
  invent facts beyond the chunks.
- **Threshold signal:** query-coverage score (fraction of the question's
  content tokens found in the chunk) in `[0, 1]`, because sparse hashed
  vectors give low absolute cosine for short queries.

For production set `MOCK_MODE=false` and configure the real APIs; the
threshold then applies to cosine similarity from the real embedding model.

## API endpoints

All under the `/api` prefix.

| Method | Path | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload one PDF (`multipart` field `file`). Validates extension, `%PDF` magic bytes, size ≤ `MAX_UPLOAD_MB`, SHA-256 dedupe (duplicate → 409). Runs extract → chunk → embed → index synchronously; returns the document with `status` (`ready`, `needs_ocr`, …). Password-protected / corrupt → 422. |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/{id}` | Document details (incl. `chunk_count`, `status`) |
| DELETE | `/api/documents/{id}` | Delete document, file, chunks, vectors and related chat messages |
| POST | `/api/chat` | `{"question": "...", "document_ids": ["..."]}` → `{"answer": "...", "sources": [{"filename", "page", "text", "score"}]}`. Below-threshold → exactly `"I could not find this information in the uploaded documents."` with `sources: []`. |
| GET | `/api/chat/history?limit=50` | Chat history, newest last |
| DELETE | `/api/chat/history` | Clear chat history |
| GET | `/api/health` | `{"status": "ok", "mock_mode": bool, "documents": n, "version": "..."}` |

Rate limits: uploads 10/min, chat 30/min per IP (slowapi). Errors are generic
JSON — stack traces and local paths are never exposed.

## RAG pipeline

1. **Upload** → validate → save under a uuid filename (`data/uploads/`).
2. **Extract** (`pdf_service`): PyMuPDF, page-wise text.
3. **Clean** (`chunking_service`): normalise whitespace, de-hyphenate.
4. **Chunk**: sentence-aware packing, `CHUNK_SIZE` chars, `CHUNK_OVERLAP`
   chars of trailing-sentence overlap; metadata keeps `document_id`,
   `filename`, 1-based `page_number`, `chunk_index`.
5. **Embed** (`embedding_service`): mock hashed n-grams or real API.
6. **Index** (`vector_service`): ChromaDB persistent collection
   (`cosine` space, own embeddings supplied — ChromaDB downloads nothing);
   falls back to a real numpy `.npz` store if ChromaDB is unavailable.
   Chunk text stays in SQLite (`document_chunks`).
7. **Chat** (`rag_service`): embed question → top-K cosine retrieval across
   the selected documents → similarity-threshold gate → strict system prompt
   → answer + sources (filename, page, ~300-char preview, score).

The strict system prompt used for every LLM call:

> You answer questions only using the provided document context. Do not use
> outside knowledge. Do not guess. If the answer is not available in the
> context, say: "I could not find this information in the uploaded
> documents." Keep the answer clear and concise. Cite the source filename and
> page number when possible.

## Project layout

```
backend/
  app/
    main.py                 # FastAPI factory, CORS, rate limiting, error handlers
    config.py               # env-based settings
    database.py             # SQLAlchemy engine/session
    models.py               # Document, DocumentChunk, ChatMessage
    schemas.py              # Pydantic v2 request/response models
    routes/                 # documents.py, chat.py, health.py
    services/
      pdf_service.py        # PyMuPDF extraction + error types
      chunking_service.py   # sentence-aware chunking with overlap
      embedding_service.py  # mock hashed n-grams / OpenAI-compatible API
      vector_service.py     # ChromaDB (or numpy fallback) behind one interface
      llm_service.py        # mock extractive LLM / OpenAI-compatible API
      rag_service.py        # retrieve → threshold → answer orchestration
    utils/security.py       # filename sanitising, hashing, magic bytes
    middleware/rate_limit.py
  tests/                    # pytest suite (runs with MOCK_MODE=true, tmp dirs)
  requirements.txt
  Dockerfile
```

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Tests use throwaway temp directories for the DB, uploads and vector store —
nothing touches your real `data/` folder.

## Docker

```bash
# from the project root
docker compose up --build
# backend → http://localhost:8000, frontend → http://localhost:5173
```

## Suggested demo questions (sample PDF)

After generating `data/sample_docs/acme-refund-policy.pdf` and uploading it:

- What is the refund window?
- What is the support email address?
- How long does standard shipping take?
- What is the restocking fee for opened items?
- Summarize this document.
- What is the capital of Mars? *(→ "I could not find this information in the uploaded documents.")*

## Known limitations

- Mock mode is a retrieval baseline, not production quality — use a real
  embedding + LLM API for production.
- Scanned/image PDFs are detected (`needs_ocr`) but OCR itself is not
  implemented yet.
- Document processing is synchronous in the upload request (fine locally;
  move to a background worker for production).
- Single-user: no authentication yet.
