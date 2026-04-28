import type { Page, Route } from '@playwright/test';

/**
 * Deterministic fixture data so screenshots are stable across runs.
 * No timestamps that drift, no random IDs.
 */
export const fixtureDocuments = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'Profile.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 42_240,
    totalChunks: 3,
    createdAt: '2026-01-15T10:30:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    filename: 'System_Design_Playbook.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 256_000,
    totalChunks: 18,
    createdAt: '2026-01-12T08:14:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    filename: 'meeting-notes.md',
    mimeType: 'text/markdown',
    sizeBytes: 8_192,
    totalChunks: 1,
    createdAt: '2026-01-10T16:45:00.000Z',
  },
] as const;

export type ChatMockMode = 'normal' | 'no-matches' | 'no-docs';

export interface ChatMockOptions {
  readonly mode?: ChatMockMode;
  readonly steps?: ReadonlyArray<{ id: string; label: string; detail?: string }>;
  readonly answer?: string;
}

const encodeSse = (events: ReadonlyArray<Record<string, unknown>>): string =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');

/**
 * Wire up deterministic mocks for both API routes used on the page.
 * Visual tests should never hit a real DB / Groq / HF stack.
 */
export const mockApiRoutes = async (
  page: Page,
  options: { documents?: ReadonlyArray<typeof fixtureDocuments[number]>; chat?: ChatMockOptions } = {},
): Promise<void> => {
  const docs = options.documents ?? fixtureDocuments;
  const chat = options.chat ?? {};

  await page.route('**/api/documents', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: docs }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/chat', async (route: Route) => {
    const events: Record<string, unknown>[] = [];
    const mode: ChatMockMode = chat.mode ?? 'normal';

    switch (mode) {
      case 'no-docs':
        events.push(
          { type: 'delta', content: "I don't have any documents to search through. Please upload some documents first." },
          { type: 'done' },
        );
        break;
      case 'no-matches':
        events.push(
          { type: 'step', step: JSON.stringify({ id: 'understand', label: 'Understanding your question' }) },
          { type: 'step', step: JSON.stringify({ id: 'search', label: 'Searching your documents', detail: 'across all uploaded documents' }) },
          { type: 'step', step: JSON.stringify({ id: 'matches', label: 'No matching passages found' }) },
          { type: 'delta', content: "I couldn't find anything relevant to your question in the uploaded documents. Try rephrasing or asking about specific topics covered in them." },
          { type: 'done' },
        );
        break;
      case 'normal': {
        const steps = chat.steps ?? [
        { id: 'understand', label: 'Understanding your question' },
        { id: 'search', label: 'Searching your documents', detail: 'across all uploaded documents' },
        { id: 'matches', label: 'Found 3 relevant passages', detail: 'Profile.pdf · 92%, Profile.pdf · 81%, System_Design_Playbook.pdf · 74%' },
        { id: 'generate', label: 'Composing the answer' },
      ];
        const answer = chat.answer ?? 'A document is a piece of text that contains information you can search and reference. Each one is split into chunks, embedded as vectors, and indexed so questions about it can find the most relevant passages.';

        for (const step of steps) {
          events.push({ type: 'step', step: JSON.stringify(step) });
        }
        events.push({
          type: 'chunks',
          chunks: JSON.stringify([
            { id: 'c1', filename: 'Profile.pdf', chunkIndex: 0, similarity: 0.92, preview: 'Top Skills: Server Driven UI, Test-Driven Development, Node.js...' },
            { id: 'c2', filename: 'Profile.pdf', chunkIndex: 1, similarity: 0.81, preview: 'Experience working with React, TypeScript, and Postgres...' },
          ]),
        });
        // Stream the answer in word-chunks for realism.
        for (const word of answer.split(' ')) {
          events.push({ type: 'delta', content: `${word} ` });
        }
        events.push({ type: 'done' });
        break;
      }
    }

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
      body: encodeSse(events),
    });
  });

  // Swallow any client-side log POSTs so they don't show as failed requests.
  await page.route('**/api/logs/event', async (route: Route) => {
    await route.fulfill({ status: 204, body: '' });
  });
};

/**
 * Wait for the network to settle before taking a snapshot. Animation
 * disabling lives in the per-test fixture (test.beforeEach) so authors
 * can't forget to call it — every page in tests/visual gets it for free.
 */
export const settle = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle');
};

const DETERMINISTIC_STYLES = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

/**
 * Inject the no-animation, no-caret stylesheet. Called once per test by
 * the fixture in tests/visual/setup.ts — specs don't invoke it directly.
 */
export const installDeterministicStyles = async (page: Page): Promise<void> => {
  await page.addStyleTag({ content: DETERMINISTIC_STYLES });
};
