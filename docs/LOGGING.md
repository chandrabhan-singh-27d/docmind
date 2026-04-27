# Error Logging & Observability

Design for a free, self-hosted error pipeline that captures errors from
both the browser and the Node server, persists them to Postgres, and
exposes a dashboard for analysis. **Not yet implemented — this document
is the build plan.**

---

## Goals

- One unified store for frontend and backend errors so a single query
  answers "what's broken right now".
- Free at scale — no per-event pricing, no third-party data sharing,
  no caps. Uses infrastructure already in `docker-compose.yml`.
- Pluggable: the capture/transport layer is designed so a future swap
  to Sentry (or GlitchTip) is one client config change, not a rewrite.

---

## Why DB-first instead of Sentry / GlitchTip / Highlight

| Option | Cost | Trade-off |
|---|---|---|
| **DB-first + Metabase** *(this plan)* | Free, no caps | We build ≈150 LOC of capture/transport. Self-hosted Metabase as another Docker service. |
| Sentry free tier | 5k errors/mo cap, 1 user | A buggy deploy can blow the cap in an hour, then events sample out and you stop seeing them. Account signup, third-party storage. |
| GlitchTip self-hosted | Free | Heavier stack (Postgres + Redis + Celery + their app). |
| Highlight.io self-hosted | Free | Multi-service stack; overkill unless we want session replay. |

DocMind already runs Postgres in `docker-compose.yml`, so the marginal
cost of this plan is one extra container (Metabase) and one new table.

---

## Architecture

```
  Browser                              Server (Next.js)             Postgres            Metabase (Docker)
  -------                              ----------------             --------            ----------------
  React error boundary  ──fetch──▶  /api/logs/event (Zod)
  window.onerror          (POST)       (rate-limited)        ──▶  error_events  ───────▶  Dashboards / saved
  unhandledrejection                                                                       SQL questions

  Route handlers ─── try/catch top-level ───────────────────▶  error_events
  Service errors ─── result.error path (already typed) ───────▶  error_events (level=warn)
```

---

## Schema

```sql
CREATE TABLE error_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  level         text NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  source        text NOT NULL CHECK (source IN ('frontend', 'backend')),
  message       text NOT NULL,
  stack         text,
  route         text,                  -- e.g. '/api/chat' or 'page:/'
  request_id    text,                  -- correlation id, propagated header
  user_agent    text,
  url           text,
  release_id    text,                  -- git SHA at deploy time
  context       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX error_events_created_at_idx
  ON error_events (created_at DESC);

CREATE INDEX error_events_level_source_idx
  ON error_events (level, source);

CREATE INDEX error_events_route_idx
  ON error_events (route)
  WHERE route IS NOT NULL;
```

Drizzle definition will live in `src/lib/db/schema.ts` alongside the
existing tables.

---

## Capture surfaces

### Frontend

- **`<RootErrorBoundary>`** wraps `app/layout.tsx`'s children. Catches
  React render errors. Posts to `/api/logs/event` with
  `{ source: 'frontend', level: 'error', message, stack, url }`.
- **Inline `<script>` in `<head>`** wires `window.onerror` and
  `window.addEventListener('unhandledrejection', …)` to a tiny posting
  function. Same pattern as the existing theme bootstrap script.
- **Manual call sites** (e.g. failed fetches in `chat-window.tsx`)
  call `logEvent(…)` directly with relevant context.

### Backend

- **Route-handler wrapper** (`withLogging(handler)`) that wraps each
  `app/api/*/route.ts` export. Catches unexpected throws and logs
  `{ source: 'backend', level: 'error', stack, route, request_id }`.
- **Service-level**: `Result.err` paths in business logic call
  `logEvent({ level: 'warn', … })` so anticipated failures still leave
  a trace without alarming production.

---

## API

### `POST /api/logs/event`

**Body** (Zod-validated):
```ts
{
  level: 'error' | 'warn' | 'info';
  source: 'frontend';            // backend never POSTs to this endpoint
  message: string;               // ≤ 8000 chars
  stack?: string;                // ≤ 16000 chars
  url?: string;
  context?: Record<string, unknown>;  // serialized to jsonb
}
```

**Behavior**:
- Rate-limited via the existing `getDefaultRateLimiter()` from
  `features/security/rate-limiter.ts` to prevent log floods.
- Augments the body with server-derived fields (`request_id`,
  `user_agent`, IP-derived hash if needed).
- Returns `204 No Content` on success.
- Failures are intentionally swallowed in the client — logging must
  never throw and never block the user.

---

## Privacy considerations

- **PII**: by default we **redact user query text** before logging
  chat-related errors. Add a `LOG_INCLUDE_QUERY=true` env var to
  capture queries during local debugging only.
- **IP addresses**: we hash the client IP (already used by the rate
  limiter) rather than storing it raw.
- **Stack traces**: captured verbatim. They can include filesystem
  paths but no user content unless explicitly added to `context`.
- **Document content**: never logged. Only document IDs.

---

## Sampling & retention

- **Sampling**: 100% in v1. We only sample if the table grows past a
  size budget (default plan: 100k rows ≈ 100 MB). Sampling rule, when
  added, will live in the API route and use a stable hash of
  `request_id` so all events from one trace either land or all drop.
- **Retention**: default `DELETE FROM error_events WHERE created_at <
  now() - interval '90 days'` run nightly via a `pg_cron` job. Tunable
  via env var `LOG_RETENTION_DAYS`.

---

## Metabase setup

Add a `metabase` service to `docker-compose.yml`:

```yaml
metabase:
  image: metabase/metabase:latest
  container_name: docmind-metabase
  ports:
    - '3001:3000'
  environment:
    MB_DB_TYPE: postgres
    MB_DB_DBNAME: metabase
    MB_DB_USER: docmind
    MB_DB_PASS: docmind_local
    MB_DB_HOST: db
    MB_DB_PORT: 5432
  depends_on:
    db:
      condition: service_healthy
  volumes:
    - docmind_metabase_data:/metabase-data

volumes:
  docmind_pgdata:
  docmind_metabase_data:
```

Metabase needs its own database (`metabase`) for internal state —
bootstrap once with:

```
podman exec docmind-db psql -U docmind -c "CREATE DATABASE metabase;"
```

Then browse to `http://localhost:3001`, point it at the same Postgres
at `db:5432/docmind`, and the `error_events` table is auto-discovered.

### Starter saved questions

- **Errors in last 24h** —
  `SELECT date_trunc('hour', created_at) AS bucket, count(*) FROM error_events WHERE created_at > now() - interval '24 hours' AND level = 'error' GROUP BY 1 ORDER BY 1;`
- **Top routes by error rate (7d)** —
  `SELECT route, count(*) FROM error_events WHERE created_at > now() - interval '7 days' AND level = 'error' GROUP BY route ORDER BY 2 DESC LIMIT 20;`
- **Frontend vs backend split** —
  `SELECT source, level, count(*) FROM error_events WHERE created_at > now() - interval '7 days' GROUP BY 1, 2;`
- **Slowest-trending error message** —
  `SELECT message, count(*) AS n, max(created_at) AS last_seen FROM error_events WHERE level = 'error' GROUP BY 1 ORDER BY n DESC LIMIT 25;`

---

## Build sequence

1. **Schema migration** — add `error_events` table via Drizzle.
2. **`src/lib/logging/`** — server logger (`logEvent`) and a thin client
   wrapper that POSTs.
3. **`/api/logs/event`** — Zod-validated, rate-limited route handler.
4. **`<RootErrorBoundary>`** in `app/layout.tsx`.
5. **`<head>` script** for `window.onerror` / `unhandledrejection`.
6. **`withLogging(handler)`** wrapper applied to existing API routes.
7. **`docker-compose.yml`** — add Metabase service + volume.
8. **README + ARCHITECTURE.md** — short "Observability" section
   pointing back to this doc.
9. **Optional**: `pg_cron` retention job (or a simple Drizzle-based
   nightly script invoked from a Vercel/cron endpoint).

---

## Switching to Sentry later

The abstraction lives in `src/lib/logging/`. To swap providers:

1. Replace the `logEvent` implementation with a Sentry SDK call.
2. Drop the `error_events` table or keep it as a fallback sink.
3. Remove the `/api/logs/event` route (Sentry SDK posts directly).
4. Source maps go to Sentry via the build hook.

Nothing in `app/`, `features/`, or `components/` needs to change.
That's the whole reason for the abstraction: today's free pipeline is
tomorrow's pluggable adapter.
