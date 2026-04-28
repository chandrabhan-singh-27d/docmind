import { test, expect } from './setup';
import { mockApiRoutes, settle, fixtureDocuments } from './fixtures';

test.describe('Home / Documents tab', () => {
  test('renders the empty document list', async ({ page }) => {
    await mockApiRoutes(page, { documents: [] });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'DocMind' })).toBeVisible();
    await expect(page.getByText('No documents uploaded yet')).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('documents-empty.png', { fullPage: true });
  });

  test('renders the documents tab with three documents', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    for (const doc of fixtureDocuments) {
      await expect(
        page.locator(`[data-testid="document-row"][data-filename="${doc.filename}"]`),
      ).toBeVisible();
    }
    await settle(page);
    await expect(page).toHaveScreenshot('documents-list.png', { fullPage: true });
  });

  test('renders the upload dropzone in default state', async ({ page }) => {
    await mockApiRoutes(page, { documents: [] });
    await page.goto('/');
    const dropzone = page.getByTestId('upload-dropzone');
    await expect(dropzone).toBeVisible();
    await settle(page);
    await expect(dropzone).toHaveScreenshot('dropzone-default.png');
  });
});
