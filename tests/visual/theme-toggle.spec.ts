import { test, expect } from './setup';
import { mockApiRoutes, settle } from './fixtures';

test.describe('Theme toggle', () => {
  test('renders the toggle button next to the header', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
    await expect(toggle).toBeVisible();
    await settle(page);
    await expect(toggle).toHaveScreenshot('toggle-button.png');
  });

  test('flips the document class and persists across reload', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const initial = await page.evaluate(() =>
      document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );

    await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click();

    const afterClick = await page.evaluate(() =>
      document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );
    expect(afterClick).not.toBe(initial);

    const stored = await page.evaluate(() => localStorage.getItem('docmind-theme'));
    expect(stored).toBe(afterClick);

    await page.reload();
    const afterReload = await page.evaluate(() =>
      document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );
    expect(afterReload).toBe(afterClick);
  });

  test('icon visually reflects the current theme after toggle', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
    await settle(page);
    await expect(toggle).toHaveScreenshot('toggle-icon-initial.png');

    await toggle.click();
    await settle(page);
    await expect(toggle).toHaveScreenshot('toggle-icon-flipped.png');
  });
});
