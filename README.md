# DocMind

Local-first RAG over your documents. Upload PDFs, Markdown, or text, ask
natural-language questions, and watch the model search and answer with a
transparent step-by-step trace. Embeddings run **in-process** via
Transformers.js — no API token, no rate limits, no network round-trip per query.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat&logo=typescript&logoColor=fff)
![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat&logo=next.js&logoColor=fff)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-f55036?style=flat)
![Transformers.js](https://img.shields.io/badge/Transformers.js-local-ffd21e?style=flat)
![pgvector](https://img.shields.io/badge/pgvector-0.8-336791?style=flat&logo=postgresql&logoColor=fff)
![Vitest](https://img.shields.io/badge/Vitest-passing-6e9f18?style=flat&logo=vitest&logoColor=fff)

---

## What It Does

1. **Upload** PDFs, Markdown, or plain text. Upload validation checks MIME,
   size, and (for PDFs) magic bytes before anything is parsed.
2. **Automatic ingestion** — parses, chunks (sliding window, sentence-aware),
   embeds **locally** via Transformers.js, stores in pgvector. Re-uploading
   the same content is a no-op (content-hash dedup).
3. **Per-document or whole-library chat** — each document has a Chat CTA that
   scopes retrieval to that one file. Without a scope, retrieval searches
   everything.
4. **Conversation memory** — follow-ups like "explain a bit more" actually work:
   the prior user turn is folded into the embedding query, and recent turns are
   replayed to the LLM.
5. **Transparent search** — every answer ships with a collapsible "How I
   searched" trace: Understanding → Searching → Found N passages → Composing.
   No more "trust me, the answer is right".
6. **Streamed answers** with strict grounding rules in the system prompt and a
   buffered emitter that prevents internal markers from leaking into the prose.

---

## Architecture

```
User
 │
 ├── Upload Document ───────────────────────────────────┐
 │                                                             │
 │   ┌─────────────────── Ingestion Pipeline ────────────┐ │
 │   │                                                       │ │
 │   │  validate upload ──►  parse (PDF/text) ──►  chunk      │ │
 │   │  (MIME, size,        (pdf-parse v2)       (sliding   │ │
 │   │   magic bytes)                             window)   │ │
 │   │                                              │        │ │
 │   │                         store ◄── embed       │        │ │
 │   │                       (pgvector)  (Transformers.js,   │ │
 │   │                                    local ONNX)        │ │
 │   └───────────────────────────────────────────────────────────┘ │
 │                                                             │
 ├── Ask Question ─────────────────────────────────────────┤
 │                                                             │
 │   ┌─────────────────── Retrieval Pipeline ────────────┐ │
 │   │                                                       │ │
 │   │  injection check ──► history-aware  ──►   embed query  │ │
 │   │  (across query +    retrieval query    (Transformers │ │
 │   │   history)          (last user turn     .js, cached) │ │
 │   │                      + new query)            │        │ │
 │   │                                                ▼        │ │
 │   │   stream answer ◄── LLM call    ◄──   vector search   │ │
 │   │   (SSE: step,       (Groq Llama       (pgvector cosine,│ │
 │   │    delta, citations) 3.3 70B,            optional doc │ │
 │   │                       streaming)          scope)       │ │
 │   └─────────────────────────────────────────────────────────────┘ │
 │                                                             │
 └── Streamed answer + transparent search trace ───────────────
```

---

## Design Decisions

| Decision | Why |
|----------|-----|
| **Local embeddings via Transformers.js** | `Xenova/all-MiniLM-L6-v2` runs in-process via ONNX (~25 MB model, cached at `~/.cache/huggingface`). Free forever, no rate limits, no third-party data. The first request after a cold boot pays a 1–3 s model load; subsequent calls are warm. |
| **Groq (Llama 3.3 70B Versatile) for generation** | Free tier, ~300+ tok/sec, strong reasoning. Only piece of the pipeline that's still remote. |
| **pgvector over Pinecone/Chroma** | Self-hosted, free, SQL joins for metadata filtering, runs in Docker. No vendor lock-in. |
| **Per-document scope bypasses similarity threshold** | When the user explicitly chose a document, generic queries like "summarize this" or "explain it like I'm 5" carry little semantic signal but still deserve an answer. The threshold only filters when searching across the whole library. |
| **History-aware retrieval** | Embedding query is built from the prior user turn + the new query, so follow-ups like "explain a bit more" still find relevant chunks. The LLM also receives recent turns as conversation context. |
| **Buffered streaming emitter** | Internal `CITATIONS_JSON:` marker is held back at the tail until disambiguated, so it never leaks into the user-visible prose. |
| **Content-hash deduplication** | Same document uploaded twice → skip re-embedding. SHA-256 of trimmed text content. |
| **Sliding-window chunking** | 500-token chunks with 100-token overlap. Sentence-boundary aware. Prevents info loss at chunk boundaries. |
| **Result\<T, E\> over try/catch** | Explicit error handling. Every service function returns a typed `Result`. Business logic has zero `try/catch`. |
| **Prompt-injection defense** | Pattern-based detection across the current query AND every prior user-role turn in history. User input wrapped in `<user_query>` delimiters. System prompts immutable. |
| **Functional architecture** | Pure functions, no classes, composition pipelines. Every step is independently testable. |

---

## Security Model

- **Prompt-injection detection** — regex-based, applied to the current query *and* every prior user turn in conversation history (history bypasses the `<user_query>` wrapping, so it gets its own check).
- **File upload validation** — MIME allowlist, size limits, PDF magic-byte verification.
- **Per-IP rate limiter** — token-bucket on `/api/chat` and `/api/documents` (POST/DELETE) to shield Groq's 30 RPM free-tier key from a single noisy client.
- **Security headers** — CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy. Configured in `next.config.ts`.
- **API key isolation** — keys read via Zod-validated `getEnv()`, never logged, never sent to the client.
- **Input validation** — Zod schemas on every API route before any processing.
- **Filename sanitization** — path-traversal characters stripped, length capped.
- **Error response hygiene** — discriminated-union `AppError`, no internal details leaked to the client.
- **Audit-clean dependency tree** — `pnpm` overrides pin `postcss ≥ 8.5.10` and `esbuild ≥ 0.25.0` to clear known transitive advisories.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Node runtime) |
| **Language** | TypeScript (strict mode, no `any`) |
| **LLM** | Groq — Llama 3.3 70B Versatile (free tier) |
| **Embeddings** | Transformers.js (`@huggingface/transformers`) — all-MiniLM-L6-v2, local ONNX |
| **Vector DB** | PostgreSQL 17 + pgvector (Docker) |
| **ORM** | Drizzle |
| **Validation** | Zod v4 |
| **PDF Parsing** | pdf-parse v2 (server-only via `serverExternalPackages`) |
| **Styling** | Tailwind CSS v4 (with class-based dark mode via `@custom-variant`) |
| **Tests** | Vitest |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat endpoint (rate-limited, SSE response)
│   │   └── documents/route.ts     # Upload, list, delete (rate-limited)
│   ├── globals.css                # Tailwind v4 + theme tokens + dark variant
│   ├── layout.tsx                 # Pre-hydration theme bootstrap script
│   └── page.tsx                   # Tabs (Documents | Chat) + theme toggle
├── components/
│   └── theme-toggle.tsx           # Light/dark toggle, OS-default on first visit
├── config/
│   └── env.ts                     # Zod-validated env, .env.local > .env > shell
├── features/
│   ├── chat/
│   │   ├── components/            # ChatWindow, MessageBubble, SearchSteps
│   │   └── services/              # ask-question-stream, parse-citations, stream-utils
│   ├── ingestion/
│   │   ├── components/            # UploadDropzone, DocumentList
│   │   ├── repositories/          # document-repo (DB access)
│   │   └── services/              # parse, chunk, embed, ingest pipeline
│   ├── retrieval/
│   │   ├── repositories/          # vector-search-repo (pgvector queries)
│   │   └── services/              # search-documents (cached), build-prompt
│   └── security/
│       ├── sanitize-input.ts      # Prompt-injection patterns
│       ├── rate-limiter.ts        # Token-bucket limiter
│       └── validate-upload.ts     # File validation (MIME, size, magic bytes)
└── lib/
    ├── cache/                     # LRU+TTL cache for query embeddings
    ├── db/                        # Drizzle schema + connection
    ├── embeddings/                # Transformers.js client (local ONNX)
    ├── llm/                       # Groq client (chat + stream)
    ├── errors.ts                  # Discriminated-union error types
    └── result.ts                  # Result<T, E> type
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Podman or Docker
- [Groq API key](https://console.groq.com/) (free)

> Embeddings run **locally** in the Node process via
> [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js) — no
> HF token, no rate limits, no network round-trip per query. The
> `Xenova/all-MiniLM-L6-v2` model (~25 MB) is downloaded once on first request
> and cached at `~/.cache/huggingface`.

### Setup

```bash
# Clone
git clone https://github.com/chandrabhan-singh-27d/docmind.git
cd docmind

# Install dependencies
pnpm install

# Start pgvector (Podman). Host port 5433 avoids clashing with a system
# postgres on 5432.
podman run -d --name docmind-db \
  -p 5433:5432 \
  -e POSTGRES_USER=docmind \
  -e POSTGRES_PASSWORD=docmind_local \
  -e POSTGRES_DB=docmind \
  docker.io/pgvector/pgvector:pg17

# Enable pgvector extension
podman exec docmind-db psql -U docmind -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Push schema
DATABASE_URL=postgresql://docmind:docmind_local@localhost:5433/docmind \
  pnpm drizzle-kit push

# Configure environment
cp .env.example .env.local
# Edit .env.local and fill in GROQ_API_KEY (HF_API_TOKEN is optional)

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Env loading order (highest first)

1. `.env.local` — per-developer overrides (gitignored)
2. `.env` — project defaults (gitignored)
3. `process.env` — shell exports / platform-injected

`.env.local` wins, so a stale shell export never silently shadows your file.

---

## Data Flow

```
Upload: File → validate → parse → chunk → embed (local) → pgvector

Query:  Question → injection check (query + history) → history-aware
        retrieval query → cached embed → pgvector search (optionally
        scoped to one doc) → build prompt (system + history + context)
        → Groq stream → SSE (step events + token deltas + citations)

Delete: Document ID → cascade delete (document + all chunks + embeddings)
```

All data flows unidirectionally. No circular dependencies. Each pipeline
step is a pure function returning `Result<T, AppError>`.

---

## Tests

```
pnpm test          # one-shot run
pnpm test:watch    # watch mode
```

Covers the LRU+TTL embedding cache, token-bucket rate limiter,
prompt-injection detector, citation-marker buffered emitter, and the
history-aware retrieval-query builder.

---

## Observability

A self-hosted error pipeline (browser + server errors → Postgres →
Metabase dashboards) is designed in [`docs/LOGGING.md`](docs/LOGGING.md).
The plan reuses the existing Postgres container and adds Metabase as a
single extra Docker service — no per-event pricing, no third-party data
sharing.

---

## License

MIT
