# Lease Extraction Console (Frontend)

A minimal Next.js UI for the Legal Document Processing Pipeline backend. Submit raw
lease text, watch it get extracted and validated, and browse the stored contracts.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- TypeScript

## Pages

| Route | Purpose | Backend call |
|---|---|---|
| `/` | Paste raw lease text and run the extraction pipeline | `POST /api/v1/extract` |
| `/contracts` | Table of every successfully processed contract | `GET /api/v1/contracts` |
| `/contracts/[id]` | Full stored record for one contract | `GET /api/v1/contracts/{id}` |

## Setup

Requires Node.js 20 or newer, and the backend running on port 8000.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

The app is served at http://localhost:3000.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Base URL of the backend API |

Set it in `.env.local`. The `NEXT_PUBLIC_` prefix is required — the value is read in the
browser. If the backend runs on another host or port (for example under Docker Compose),
change it here and restart `npm run dev`.

## API client layer

All network access goes through `lib/api.ts`. Components never call `fetch` directly.
The client owns the base URL, JSON headers, a 90 second timeout (extraction waits on an
LLM), and translation of backend error payloads into a typed `ApiError` carrying
`status`, `code`, and per-field validation messages.

## Handled states

Every page renders explicit loading, success, empty, and error states from the shared
components in `components/`.

| Situation | HTTP | What the user sees |
|---|---|---|
| Extraction succeeded | 201 | Extracted fields plus contract duration, linked to its detail page |
| Record flagged INVALID | 422 | Red panel listing each failing field and why |
| Model returned an unusable payload | 502 | "Model returned an unusable response" |
| Extraction provider down or rate limited | 503 | "Extraction provider unavailable" |
| Contract does not exist | 404 | "Contract not found" |
| Backend not running | — | "Backend unreachable", naming the configured base URL |
| Request exceeded 90s | — | "The request timed out" |

## Notes

- The backend must allow this origin. `CORS_ORIGINS` in the backend config defaults to
  `http://localhost:3000`.
- **Load sample** fills the textarea with the case study's sample lease, so you can
  exercise the pipeline without pasting anything.

## Commands

```bash
npm run dev     # development server on :3000
npm run build   # production build
npm run start   # serve the production build
npx eslint .    # lint
npx tsc --noEmit  # typecheck
```
