import { test as base } from '@playwright/test';
import { installDeterministicStyles } from './fixtures';

/**
 * Project-wide test fixture. Every spec in tests/visual/ imports `test`
 * from here instead of '@playwright/test'. The `beforeEach` runs once
 * per test, after `page.goto`, but we attach via `page.on('framenavigated')`
 * so the styles install on every navigation — specs that reload still
 * get deterministic rendering.
 */
export const test = base.extend<{ setupPage: void }>({
  setupPage: [
    async ({ page }, use) => {
      const onNavigated = (): void => {
        void installDeterministicStyles(page).catch(() => {
          // The page may navigate away mid-install; that's fine.
        });
      };
      page.on('framenavigated', onNavigated);
      await use();
      page.off('framenavigated', onNavigated);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
