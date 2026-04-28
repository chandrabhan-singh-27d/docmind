# Visual regression tests

Playwright snapshot tests covering every user-visible surface in light
and dark themes, on desktop and mobile viewports.

## Why these exist

Unit tests verify behavior; they don't catch broken theme cascades,
broken mobile layouts, contrast failures, off-center buttons, or any
other *pixel-level* regression. Visual tests do. Every UI-touching PR
must update or extend these specs.

## How they work

- Each spec opens the app, mocks the API at the network level (no DB,
  no Groq, no HF needed) via `tests/visual/fixtures.ts`, drives the
  UI through Playwright, and asserts a stable screenshot.
- Snapshots live in `tests/visual/__snapshots__/` and are committed.
- Four projects run for each spec: `desktop-light`, `desktop-dark`,
  `mobile-light`, `mobile-dark`. The `colorScheme` and `viewport`
  options come from the project config; nothing in the spec hard-codes
  them.

## Running locally

```bash
# First time: install browser binaries
pnpm exec playwright install chromium

# Run against a freshly started dev server
pnpm test:visual

# Open the interactive UI runner
pnpm test:visual:ui

# Update snapshots after an intentional UI change
pnpm test:visual:update
```

The Playwright config starts `pnpm dev` automatically on port 3000 if
no server is running. Test env values are placeholders — they satisfy
Zod validation but no real API is hit because all routes are mocked.

## Coverage map

| Spec | What it covers |
|---|---|
| `home.spec.ts` | Documents tab — empty list, populated list, dropzone default state |
| `chat.spec.ts` | Empty chat, answered conversation, expanded steps trace, per-document scope, no-relevant-matches, no-documents-uploaded |
| `theme-toggle.spec.ts` | Toggle button render, class flip + localStorage persistence + reload, icon swap |
| `message-bubble.spec.ts` | User vs assistant bubble alignment, serif body type |

Total cells: 4 specs × ~3 tests each × 4 projects ≈ 50 snapshots per
full run, all parallel.

## Adding a new test

1. Create `tests/visual/<surface>.spec.ts`.
2. `await mockApiRoutes(page, { ... })` to seed deterministic data.
3. `await page.goto('/')` and drive the UI as a user would.
4. `await stabilizeForScreenshot(page)` to disable animations + caret.
5. `await expect(page).toHaveScreenshot('name.png', { fullPage: true })`
   or scope to a locator for component-level shots.
6. Run `pnpm test:visual:update` once to commit baseline screenshots.
7. Open the PR — reviewers should see the new snapshots in the diff.

## Why we mock the API at Playwright level

Visual tests must be deterministic. A real DB has timestamp drift, a
real LLM streams different word counts every time, a real embedding
model adds 1–3 s of cold-start latency. Mocking at
`page.route('**/api/...')` gives byte-identical responses on every run
while still exercising the *real* client-side rendering pipeline
(SSE parsing, state updates, Tailwind, theme bootstrap, etc.).
