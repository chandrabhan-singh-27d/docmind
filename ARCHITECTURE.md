# DocMind — Architecture Guide

Quick reference for understanding the codebase. Read this before contributing.

---

## Dependency Graph

```
lib/result.ts                  ← Foundation: Result<T, E> type
lib/errors.ts                  ← AppError discriminated union
lib/cache/lru-cache.ts         ← Generic LRU+TTL cache primitive
lib/db/schema.ts               ← Drizzle schema (documents, chunks)
lib/db/connection.ts           ← DB connection singleton
lib/llm/groq-client.ts         ← Groq API wrapper (chat + streaming)
lib/embeddings/hf-embeddings.ts ← Transformers.js (local ONNX) embedding client

features/security/             ← Input validation, prompt-injection defense, rate limiter
features/ingestion/            ← Upload → parse → chunk → embed → store
features/retrieval/            ← Query → cached embed → search → build prompt
features/chat/                 ← Chat orchestration + streaming UI components

components/                    ← Cross-cutting UI (theme-toggle)
config/env.ts                  ← Zod-validated env, layered .env.local > .env > shell

app/api/                       ← Thin route handlers (rate-limit → validate → delegate)
app/page.tsx                   ← Main page (tabs: Documents | Chat)
app/layout.tsx                 ← Root layout + pre-hydration theme bootstrap script
next.config.ts                 ← Security headers (CSP, HSTS, etc.) + serverExternalPackages
```

**Flow:** `lib/ → features/security → features/ingestion → features/retrieval → features/chat → app/`

Lower layers never import from higher layers. No circular dependencies.

---

## Key Patterns

### Result\<T, E\>

All service functions return `Result<T, AppError>` instead of throwing.
Pattern match with `result.ok`:

```typescript
const result = await ingestDocument(params);
if (!result.ok) return handleError(result.error);  // error is typed
const document = result.value;                      // value is typed
```

### AppError (Discriminated Union)

Every error has a `type` field. Switch on it for exhaustive handling:

```typescript
switch (error.type) {
  case 'VALIDATION_ERROR': ...
  case 'LLM_RATE_LIMITED': ...        // upstream Groq throttled us
  case 'RATE_LIMITED': ...            // our limiter throttled the client
  case 'PROMPT_INJECTION_DETECTED': ...
}
```

### Ingestion Pipeline

Pure function chain — each step takes input, returns `Result`:

```
parseDocument(buffer) → chunkText(content) → embedChunks(chunks) →
insertDocument + insertChunks
```

Deduplication: content hash checked before embedding. Same content = skip.

Embedding runs in-process via Transformers.js. The model loads on first
request and stays warm for the lifetime of the Node process. The
`onnxruntime-node` and `@huggingface/transformers` packages are listed
in `next.config.ts` `serverExternalPackages` so Turbopack leaves them as
Node `require`s rather than bundling their native bindings.

### Retrieval Pipeline

```
hasInjection(query, history) → buildRetrievalQuery(query, history)
  → lru-cache.get OR generateSingleEmbedding
  → searchSimilarChunks(embedding, topK, optional documentId)
  → buildMessages(context, history)
  → streamChatCompletion → SSE stream
```

Key behaviors:

- **Injection check** runs across the current query *and* every prior
  user-role turn (history bypasses the `<user_query>` wrapping).
- **History-aware retrieval query** prepends the most recent prior user
  turn to the new query before embedding, so follow-ups like "explain a
  bit more" still surface relevant chunks.
- **Embedding cache** — LRU+TTL keyed by `model::normalized-query` (hot
  set fits a 256-entry / 1-hour budget by default).
- **Per-document scope** — if `documentId` is set, the similarity
  threshold is skipped: the user already chose what to search.
- **Conversation context** — prior turns are included in the LLM's
  message array; only the final user message is wrapped with the
  context block and `<user_query>` tags.
- **Streaming** — server emits SSE events: `step` (search trace),
  `delta` (token), `chunks` (debug detail), `citations` (parsed
  marker), `done`, `error`. A buffered emitter holds back any tail
  that could become the `CITATIONS_JSON:` marker so it never leaks
  into the visible answer.

### Repository Pattern

All DB access through repository functions in `features/*/repositories/`.
Services never call `db` directly.

### Streaming + UI

- Server: `ask-question-stream.ts` returns a `ReadableStream` of
  newline-delimited SSE events.
- Client: `chat-window.tsx` reads the stream, parses each event with
  `parseSseData`, and folds it into per-message state via
  `applyStreamEvent`. The `SearchSteps` component renders the trace.

### Theme

- `app/layout.tsx` ships an inline `<head>` script that sets the
  `.light` or `.dark` class on `<html>` *before* paint, so there's no
  flash on dark-OS users.
- `components/theme-toggle.tsx` reads the live DOM class on click
  (DOM is the source of truth, React state is only a derived view).
- Tailwind v4 binds the `dark:` modifier to the `.dark` class via
  `@custom-variant dark` in `globals.css`.

---

## File Naming

- `kebab-case.ts` for all files
- `types.ts` for feature-level type definitions
- `services/` for business logic functions
- `repositories/` for data access functions
- `components/` for React components
- `*.test.ts` for vitest tests, colocated next to the unit under test

---

## Observability

Error pipeline (frontend + backend → Postgres → Metabase) is documented
separately in [`docs/LOGGING.md`](docs/LOGGING.md). The plan is
self-hosted, free at scale, and designed so swapping to Sentry later is
a single-file change.

---

## Environment

All env vars validated at runtime via Zod (`config/env.ts`). The loader
layers `.env.local` > `.env` > `process.env`, so a stale shell export
never silently shadows your file. App fails fast with a clear error if
required vars are missing.

Required:

- `GROQ_API_KEY` — Groq API key (free tier)
- `DATABASE_URL` — PostgreSQL connection string (defaults to local
  pgvector on `localhost:5433`)

Optional:

- `HF_API_TOKEN` — unused by default since embeddings run locally;
  retained for users who swap the embeddings client to a remote
  inference provider.
- `EMBEDDING_MODEL`, `LLM_MODEL`, `MAX_UPLOAD_SIZE_MB`,
  `MAX_CHUNKS_PER_QUERY`, `RATE_LIMIT_RPM` — see `.env.example`.
