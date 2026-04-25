# DocMind — Architecture Guide

Quick reference for understanding the codebase. Read this before contributing.

---

## Dependency Graph

```
lib/result.ts           ← Foundation: Result<T, E> type
lib/errors.ts           ← AppError discriminated union
lib/db/schema.ts        ← Drizzle schema (documents, chunks tables)
lib/db/connection.ts    ← DB connection singleton
lib/llm/groq-client.ts  ← Groq API wrapper (chat completions)
lib/embeddings/hf-embeddings.ts ← HuggingFace embedding client

features/security/      ← Input validation, prompt injection defense
features/ingestion/     ← Upload → parse → chunk → embed → store
features/retrieval/     ← Query → embed → search → build prompt → LLM
features/chat/          ← Chat orchestration + UI components

app/api/                ← Thin route handlers (validate → delegate → respond)
app/page.tsx            ← Main page (tabs: Documents | Chat)
```

**Flow:** `lib/ → features/security → features/ingestion → features/retrieval → features/chat → app/`

Lower layers never import from higher layers. No circular dependencies.

---

## Key Patterns

### Result\<T, E\>

All service functions return `Result<T, AppError>` instead of throwing. Pattern match with `result.ok`:

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
  case 'LLM_RATE_LIMITED': ...
  case 'PROMPT_INJECTION_DETECTED': ...
}
```

### Ingestion Pipeline

Pure function chain — each step takes input, returns `Result`:

```
parseDocument(buffer) → chunkText(content) → embedChunks(chunks) → insertDocument + insertChunks
```

Deduplication: content hash checked before embedding. Same content = skip.

### Retrieval Pipeline

```
detectPromptInjection(query) → generateSingleEmbedding(query) → searchSimilarChunks(embedding) → buildMessages(context) → chatCompletion(messages) → parseLlmResponse(raw)
```

### Repository Pattern

All DB access through repository functions in `features/*/repositories/`. Services never call `db` directly.

---

## File Naming

- `kebab-case.ts` for all files
- `types.ts` for feature-level type definitions
- `services/` for business logic functions
- `repositories/` for data access functions
- `components/` for React components

---

## Environment

All env vars validated at runtime via Zod (`config/env.ts`). App fails fast with a clear error if any are missing.

Required:
- `GROQ_API_KEY` — Groq API key (free tier)
- `HF_API_TOKEN` — HuggingFace Inference API token (free)
- `DATABASE_URL` — PostgreSQL connection string (defaults to local pgvector)
