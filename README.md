# DocMind

RAG-powered knowledge base with citations. Upload documents, ask questions, get answers grounded in your data — with source references.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat&logo=typescript&logoColor=fff)
![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat&logo=next.js&logoColor=fff)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-f55036?style=flat)
![pgvector](https://img.shields.io/badge/pgvector-0.8-336791?style=flat&logo=postgresql&logoColor=fff)

---

## What It Does

1. **Upload** PDFs, Markdown, or plain text documents
2. **Automatic ingestion** — parses, chunks (sliding window with overlap), embeds via HuggingFace, stores in pgvector
3. **Ask questions** — natural language queries search across all your documents
4. **Get cited answers** — Groq-powered LLM answers grounded in retrieved context, with inline source citations

---

## Architecture

```
User
 │
 ├── Upload Document ──────────────────────────────────────────┐
 │                                                             │
 │   ┌─────────────────── Ingestion Pipeline ────────────────┐ │
 │   │                                                       │ │
 │   │  validate upload ──► parse (PDF/text) ──► chunk       │ │
 │   │  (MIME, size,        (pdf-parse v2)       (sliding    │ │
 │   │   magic bytes)                             window)    │ │
 │   │                                              │        │ │
 │   │                         store ◄── embed      │        │ │
 │   │                       (pgvector)  (HuggingFace)       │ │
 │   └───────────────────────────────────────────────────────┘ │
 │                                                             │
 ├── Ask Question ─────────────────────────────────────────────┤
 │                                                             │
 │   ┌─────────────────── Retrieval Pipeline ────────────────┐ │
 │   │                                                       │ │
 │   │  sanitize query ──► embed query ──► vector search     │ │
 │   │  (injection         (HuggingFace)   (pgvector         │ │
 │   │   detection)                         cosine sim)      │ │
 │   │                                        │              │ │
 │   │  parse citations ◄── LLM call ◄── build prompt       │ │
 │   │  (structured JSON)   (Groq)        (context +         │ │
 │   │                                    system rules)      │ │
 │   └───────────────────────────────────────────────────────┘ │
 │                                                             │
 └── Response with citations ──────────────────────────────────┘
```

---

## Design Decisions

| Decision | Why |
|----------|-----|
| **Groq (Llama 3.3 70B)** for generation | Free tier, fast inference, strong reasoning. No API costs. |
| **HuggingFace Inference API** for embeddings | Free, no local GPU needed. `all-MiniLM-L6-v2` produces 384-dim vectors — small, fast, accurate. |
| **pgvector over Pinecone/Chroma** | Self-hosted, free, SQL joins for metadata filtering, runs in Docker. No vendor lock-in. |
| **Content-hash deduplication** | Same document uploaded twice → skip re-embedding. SHA-256 of text content as dedup key. |
| **Sliding window chunking** | 500-token chunks with 100-token overlap. Prevents info loss at boundaries. Sentence-boundary aware. |
| **Result\<T, E\> over try/catch** | Explicit error handling. Every function returns a typed Result. Business logic has zero try/catch. |
| **Prompt injection defense** | User input wrapped in `<user_query>` delimiters. Pattern-based detection for known injection attacks. System prompts immutable. |
| **Functional architecture** | Pure functions, no classes, composition pipelines: `validate → parse → chunk → embed → store`. Every step is independently testable. |

---

## Security Model

- **Prompt injection detection** — regex-based detection for known patterns + delimiter wrapping for user queries
- **File upload validation** — MIME type allowlist, size limits, PDF magic byte verification
- **API key isolation** — keys in `process.env`, never logged, never sent to client
- **Input validation** — Zod schemas on every API route before any processing
- **Filename sanitization** — strips path traversal characters, limits length
- **Error response hygiene** — discriminated union errors, no internal details leaked to client

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict mode, no `any`) |
| **LLM** | Groq — Llama 3.3 70B Versatile (free tier) |
| **Embeddings** | HuggingFace Inference API — all-MiniLM-L6-v2 (free) |
| **Vector DB** | PostgreSQL + pgvector (Docker) |
| **ORM** | Drizzle |
| **Validation** | Zod v4 |
| **PDF Parsing** | pdf-parse v2 |
| **Styling** | Tailwind CSS v4 |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat endpoint
│   │   └── documents/route.ts     # Upload, list, delete
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # Main UI (tabs: Documents | Chat)
├── config/
│   └── env.ts                     # Zod-validated environment config
├── features/
│   ├── chat/
│   │   ├── components/            # ChatWindow, MessageBubble, CitationCard
│   │   └── services/              # ask-question, parse-citations
│   ├── ingestion/
│   │   ├── components/            # UploadDropzone, DocumentList
│   │   ├── repositories/          # document-repo (DB access)
│   │   └── services/              # parse, chunk, embed, ingest pipeline
│   ├── retrieval/
│   │   ├── repositories/          # vector-search-repo (pgvector queries)
│   │   └── services/              # search-documents, build-prompt
│   └── security/
│       ├── sanitize-input.ts      # Prompt injection defense
│       └── validate-upload.ts     # File validation (MIME, size, magic bytes)
└── lib/
    ├── db/                        # Drizzle schema + connection
    ├── embeddings/                # HuggingFace client
    ├── llm/                       # Groq client
    ├── errors.ts                  # Discriminated union error types
    └── result.ts                  # Result<T, E> type
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Podman or Docker
- [Groq API key](https://console.groq.com/) (free)
- [HuggingFace API token](https://huggingface.co/settings/tokens) (free)

### Setup

```bash
# Clone
git clone https://github.com/chandrabhan-singh-27d/docmind.git
cd docmind

# Install dependencies
pnpm install

# Start pgvector (Podman)
podman run -d --name docmind-db \
  -p 5432:5432 \
  -e POSTGRES_USER=docmind \
  -e POSTGRES_PASSWORD=docmind_local \
  -e POSTGRES_DB=docmind \
  docker.io/pgvector/pgvector:pg17

# Enable pgvector extension
podman exec docmind-db psql -U docmind -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Push schema
pnpm drizzle-kit push

# Configure environment
cp .env.example .env.local
# Edit .env.local and fill in GROQ_API_KEY and HF_API_TOKEN

# Loading order (highest priority first):
#   1. .env.local       (per-developer overrides, gitignored)
#   2. .env             (project defaults, gitignored)
#   3. process.env      (shell exports, e.g. ~/.bashrc)
#
# .env.local wins, so you don't need to unset shell exports — keys present
# in your .env.local override the shell. Keys absent from .env.local fall
# back to whatever your shell exports (or platform-injected env in prod).

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Data Flow

```
Upload: File → validate → parse → chunk → embed → pgvector
Query:  Question → sanitize → embed → vector search → build prompt → LLM → parse citations → response
Delete: Document ID → cascade delete (document + all chunks + embeddings)
```

All data flows unidirectionally. No circular dependencies. Each pipeline step is a pure function.

---

## License

MIT
