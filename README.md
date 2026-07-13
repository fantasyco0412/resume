# Resume Generator

Monorepo with a **Next.js frontend** and an **Express API backend**, deployable separately.

## Structure

```
├── frontend/          # Next.js UI (port 3000)
├── backend/           # Express API — AI, PDF, file saves (port 4000)
├── lib/               # Shared TypeScript (Supabase clients, types, helpers)
└── templates/         # Resume HTML templates (used by backend PDF generation)
```

## What It Does

- Analyse pasted job pages (cheap model) → list of job cards
- Generate tailored resumes per job (OpenRouter — user picks AI type + model)
- Download PDFs, generate interview answers, track history in Supabase

## Tech Stack

- **Frontend:** Next.js 14, React 18, Tailwind, Supabase client
- **Backend:** Express, OpenRouter, Puppeteer, Mustache
- **Shared:** Supabase auth (JWT on API routes), shared `lib/`

## Environment

Copy examples and fill in values:

| File | Purpose |
|------|---------|
| `frontend/.env.local` | Supabase public keys; optional `NEXT_PUBLIC_API_URL` in production |
| `backend/.env` | `OPENROUTER_API_KEY`, `PORT`, `CORS_ORIGIN`, Supabase keys for JWT verify |
| Repo root `.env.local` | Optional — backend also loads `../.env.local` in dev |

**Local dev:** leave `NEXT_PUBLIC_API_URL` unset. The frontend proxies `/api/*` → `http://localhost:4000` (see `frontend/next.config.js`).

**Production:** set `NEXT_PUBLIC_API_URL=https://your-api.example.com` on the frontend and `CORS_ORIGIN=https://your-app.example.com` on the backend.

## Setup

```bash
npm install          # installs root + workspace packages
npm run dev          # backend :4000 + frontend :3000
```

Or run separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Deploy

### Frontend (Vercel, Netlify, etc.)

- Root directory: `frontend`
- Build: `npm run build`
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

### Backend (Railway, Fly.io, VPS, etc.)

- Root directory: `backend`
- Start: `npm run start` (uses `tsx src/index.ts`)
- Env: `OPENROUTER_API_KEY`, Supabase vars, `CORS_ORIGIN`, `PORT`
- Ensure `templates/` is available (set `TEMPLATES_DIR` to repo `templates/` path)

## API routes (backend)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | No |
| GET | `/api/openrouter-models` | No |
| POST | `/api/extract-job` | Yes |
| POST | `/api/analyze` | Yes |
| POST | `/api/generate-pdf` | Yes |
| POST | `/api/answer-questions` | Yes |
| POST | `/api/cover-letter` | Yes |
| POST | `/api/save-pdf`, `/api/save-resume-pdf`, `/api/save-text` | Yes |

## Scripts (repo root)

```bash
npm run dev              # both services
npm run dev:frontend
npm run dev:backend
npm run build            # backend + frontend
npm run start:frontend
npm run start:backend
```
