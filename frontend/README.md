# DocuMind AI — Frontend

React + Vite + TypeScript + Tailwind CSS frontend for **DocuMind AI**, an
AI-powered document question-answering (RAG) app. Upload PDFs, then ask
questions and get answers grounded in your documents — always with
page-level source citations.

## Tech stack

- React 19 + TypeScript (strict) + Vite 6
- react-router-dom 7
- Tailwind CSS v4 (via `@tailwindcss/vite`), class-based dark mode
- No UI framework — all components are hand-built and small

## Prerequisites

- Node.js 18+ (tested on v24.20.0)
- The DocuMind AI backend running (default `http://localhost:8000`)

## Setup

```bash
cd frontend
npm install
```

Copy the env example and point it at your backend if needed:

```bash
cp .env.example .env
# edit VITE_API_URL if your backend runs elsewhere
```

## Run

```bash
npm run dev
# → http://localhost:5173
```

Type checks + production build:

```bash
npm run build   # runs `tsc --noEmit && vite build`
npm run preview # serve the production build locally
```

## Pages

| Route | Page |
|---|---|
| `/` | Landing page (hero, features, how-it-works) |
| `/dashboard` | Stats, recent documents, upload modal |
| `/chat` | Document selector + chat with source citations |
| `/documents/:id` | Document details, status, delete |
| `/settings` | Theme/accent preferences, API status, danger zone |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |

All API calls live in `src/lib/api.ts` with typed functions and friendly
`ApiError` messages — no raw stack traces reach the UI.

## Notes

- Upload validation (PDF only, ≤ 20 MB) runs client-side; the backend
  re-validates.
- Processing status (extracting → chunking → embedding → indexing → ready)
  is polled from `GET /api/documents/{id}` every 1.5 s.
- Theme (light/dark) and accent choice persist in `localStorage`.
- `/api/health` reports backend status and mock/live mode on the Settings page.
