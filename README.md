# SupportDesk AI

AI-powered customer ticket resolution: **React + TypeScript** frontend and **Express + TypeScript** backend, with **Gemini** chat + embeddings/RAG, and Freshdesk integration.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind, Lucide, react-icons |
| Backend | Express, TypeScript, Prisma, Neon PostgreSQL, Zod |
| AI | Google Gemini (Ask Assistant + knowledge-base embeddings) |
| Ticketing | Freshdesk REST API + webhooks |

## Project structure

```
├── frontend/          # React SPA (port 5173)
├── backend/           # Express API (port 8000)
│   ├── docs/          # FAQ knowledge base (.txt)
│   ├── prisma/        # Neon PostgreSQL schema
│   └── src/
└── README.md
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL (Neon), JWT_SECRET, GEMINI_API_KEY, Freshdesk vars
npm install
npx prisma db push
npm run dev
```

API: `http://localhost:8000`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

UI: `http://localhost:5173`

### 3. Database (Neon)

Users, tickets, and history live in **Neon PostgreSQL**. Create a project at [console.neon.tech](https://console.neon.tech), copy the pooled connection string into `backend/.env` as `DATABASE_URL`, then run `npx prisma db push`.

### 4. Sign in

1. Open the UI — you’ll land on **Sign in**
2. Click **Create one** → register with name, email, password (min 6 chars) — stored in Neon
3. After login, Dashboard and all app pages unlock
4. Use **Sign out** in the sidebar to leave

Protected API routes require a JWT (`Authorization: Bearer <token>`). Freshdesk webhooks stay public (verified by webhook secret).

## Environment

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `8000`) |
| `DATABASE_URL` | Neon PostgreSQL connection string (`postgresql://...?sslmode=require`) |
| `CORS_ORIGIN` | Frontend origin (`http://localhost:5173`) |
| `FRESHDESK_DOMAIN` | Freshdesk subdomain |
| `FRESHDESK_API_KEY` | Freshdesk API key |
| `FRESHDESK_WEBHOOK_SECRET` | Webhook verification secret |
| `GEMINI_API_KEY` | Google Gemini API key (chat + embeddings) |
| `GEMINI_MODEL` | Gemini chat model id (default `gemini-3.8-flash`) |
| `GEMINI_EMBEDDING_MODEL` | Embedding model id (default `text-embedding-004`) |

Without `GEMINI_API_KEY`, classification still works (keywords) and RAG falls back to keyword search over `backend/docs/`.  
**Ask Assistant** and semantic knowledge search require `GEMINI_API_KEY` (from Google AI Studio).

### Frontend (`.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (`http://localhost:8000`) |

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health + AI status |
| `GET` | `/config/public` | Non-secret config for Settings UI |
| `POST` | `/webhook/freshdesk` | Freshdesk webhook |
| `POST` | `/test-ticket` | Process a mock ticket end-to-end |
| `POST` | `/classify` | Tier/category only |
| `POST` | `/rag` | Knowledge-base query |
| `POST` | `/chat` | Gemini chat (FAQ-grounded) |
| `POST` | `/reprocess-ticket` | Re-fetch and reprocess |
| `GET` | `/stats` | Counts / rates |
| `GET` | `/analytics` | Tier distribution + recent |
| `GET` | `/tickets` | Paginated list |
| `GET` | `/tickets/:id` | Ticket detail |

## UI pages

- **Dashboard** — health, stats, recent tickets
- **Classify** — run test tickets through the full pipeline
- **Knowledge** — RAG against FAQ docs
- **Ask Assistant** — Gemini chatbot grounded on FAQ docs
- **Tickets** — list/detail + reprocess
- **Settings** — Freshdesk / Gemini status (read-only)

## License

MIT
