# SupportDesk AI

AI-powered customer ticket resolution: **React + TypeScript** frontend and **Express + TypeScript** backend, with Hugging Face embeddings/RAG, **Gemini** chat assistant, and Freshdesk integration.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind, Lucide, react-icons |
| Backend | Express, TypeScript, Prisma, SQLite, Zod |
| AI | Hugging Face Inference API (RAG) + Google Gemini (Ask Assistant) |
| Ticketing | Freshdesk REST API + webhooks |

## Project structure

```
├── frontend/          # React SPA (port 5173)
├── backend/           # Express API (port 8000)
│   ├── docs/          # FAQ knowledge base (.txt)
│   ├── prisma/        # SQLite schema
│   └── src/
└── README.md
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET, GEMINI_API_KEY (for chat), HF_API_TOKEN (optional), Freshdesk vars
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

### 3. Sign in

1. Open the UI — you’ll land on **Sign in**
2. Click **Create one** → register with name, email, password (min 6 chars)
3. After login, Dashboard and all app pages unlock
4. Use **Sign out** in the sidebar to leave

Protected API routes require a JWT (`Authorization: Bearer <token>`). Freshdesk webhooks stay public (verified by webhook secret).

## Environment

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `8000`) |
| `DATABASE_URL` | Prisma SQLite URL (`file:./tickets.db`) |
| `CORS_ORIGIN` | Frontend origin (`http://localhost:5173`) |
| `FRESHDESK_DOMAIN` | Freshdesk subdomain |
| `FRESHDESK_API_KEY` | Freshdesk API key |
| `FRESHDESK_WEBHOOK_SECRET` | Webhook verification secret |
| `HF_API_TOKEN` | Hugging Face token for embeddings |
| `HF_EMBEDDING_MODEL` | Embedding model id |
| `GEMINI_API_KEY` | Google Gemini API key for Ask Assistant |
| `GEMINI_MODEL` | Gemini model id (default `gemini-3.8-flash`) |

Without `HF_API_TOKEN`, classification still works (keywords) and RAG falls back to keyword search over `backend/docs/`.  
**Ask Assistant** requires `GEMINI_API_KEY` (free-tier Gemini key from Google AI Studio).

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
- **Settings** — Freshdesk / HF / Gemini status (read-only)

## License

MIT
