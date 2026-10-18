# DocuMind AI — 5-Minute Demo Script

For presenting the project to clients, interviewers, or stakeholders.
Assumes the app is running locally (backend `:8000`, frontend `:5173`, mock mode is fine).

## 0:00 — The pitch (30s)

> "DocuMind AI is a document question-answering system. You upload PDFs —
> policies, manuals, contracts — and chat with them. Every answer is grounded
> in your documents with page citations, and if the answer isn't there, it says
> so instead of hallucinating."

Open the **landing page** (`/`): point out the CTA and the four feature cards.

## 0:30 — Upload (1 min)

1. Click **"Upload Documents"** → dashboard → **"Upload document"**.
2. Drag in `data/sample_docs/acme-refund-policy.pdf` (or any PDF).
3. Narrate the live pipeline: *Uploading → Extracting → Chunking → Embedding →
   Indexing → Ready.*
4. Show the document row: name, size, 4 pages, green **Ready** badge.

*Optional credibility beat:* try uploading a `.txt` or oversized file to show the
friendly validation error; mention the 20 MB limit and duplicate detection.

## 1:30 — Ask something it knows (1.5 min)

Go to **Chat**, make sure the document is selected, ask:

- **"What is the refund window?"**
- Point out: the grounded answer **and the source cards** — filename, page 2,
  expandable text preview.
- Follow up: **"What is the restocking fee?"** or click a suggested-question chip
  (*"Summarize this document."*) to show follow-ups work.

## 3:00 — Ask something it doesn't know (1 min) — the key moment

Ask: **"What is the capital of Mars?"**

> "Watch this — instead of inventing an answer, it says exactly:
> *'I could not find this information in the uploaded documents.'*
> That's the anti-hallucination guarantee, enforced by a similarity threshold
> before the LLM is ever called."

## 4:00 — Management (1 min)

- **Dashboard**: stat cards (total documents, questions asked, last processed),
  recent-documents table.
- Open the **document details** page: metadata, chunk count, status.
- **Settings**: theme toggle (flip to dark mode — it looks great), API/model
  status card showing *Mock (no API key)* vs *Live API*, and the danger zone
  (clear history / delete all).
- Back in chat: **Clear chat** button.

## 5:00 — Close (30s)

> "Full-stack: React + TypeScript frontend, FastAPI backend, ChromaDB vector
> search, SQLite metadata. Runs offline in mock mode, or flip one env var to use
> any OpenAI-compatible model. 38 automated tests, Docker-ready, and every
> answer cites its page."

### If they ask technical questions

- **"What embedding model?"** — Any OpenAI-compatible embeddings API; offline,
  a deterministic hashed n-gram baseline (labeled as such, not production).
- **"How do you prevent hallucinations?"** — Strict system prompt + retrieval
  similarity gate; the LLM never sees the question without retrieved context.
- **"Can it scale?"** — The vector store is behind an interface — swap ChromaDB
  for pgvector; move the SQLite URL to Postgres; both are one-env-var changes.
