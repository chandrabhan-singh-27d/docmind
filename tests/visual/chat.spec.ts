import type { Page } from '@playwright/test';
import { test, expect } from './setup';
import { mockApiRoutes, settle } from './fixtures';

const getChatTabButton = (page: Page) =>
  page.getByRole('navigation').getByRole('button', { name: /^Chat$/ });

test.describe('Chat tab', () => {
  test('renders the empty chat state', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await getChatTabButton(page).click();
    await expect(page.getByText('Ask a question about your uploaded documents')).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-empty.png', { fullPage: true });
  });

  test('renders an answered conversation with steps trace', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await getChatTabButton(page).click();
    await page.getByPlaceholder(/Ask about your documents/).fill('What is a document?');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.getByText(/A document is a piece of text/)).toBeVisible();
    await expect(page.getByRole('button', { name: /How I searched/ })).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-answered.png', { fullPage: true });
  });

  test('renders the expanded steps trace', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await getChatTabButton(page).click();
    await page.getByPlaceholder(/Ask about your documents/).fill('What is a document?');
    await page.getByRole('button', { name: 'Ask' }).click();

    await expect(page.getByText(/A document is a piece of text/)).toBeVisible();
    await page.getByRole('button', { name: /How I searched/ }).click();
    await expect(page.getByText('Found 3 relevant passages')).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-steps-expanded.png', { fullPage: true });
  });

  test('renders the per-document scope banner when chatting from a doc CTA', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await page
      .locator('[data-testid="document-row"][data-filename="Profile.pdf"]')
      .getByRole('button', { name: 'Chat' })
      .click();
    await expect(page.getByText(/Scoped to/)).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-scoped.png', { fullPage: true });
  });

  test('renders the no-relevant-matches state', async ({ page }) => {
    await mockApiRoutes(page, { chat: { mode: 'no-matches' } });
    await page.goto('/');
    await getChatTabButton(page).click();
    await page.getByPlaceholder(/Ask about your documents/).fill('something unrelated');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText(/couldn't find anything relevant/)).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-no-matches.png', { fullPage: true });
  });

  test('renders the no-documents-uploaded state', async ({ page }) => {
    await mockApiRoutes(page, { documents: [], chat: { mode: 'no-docs' } });
    await page.goto('/');
    await getChatTabButton(page).click();
    await page.getByPlaceholder(/Ask about your documents/).fill('hello');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText(/I don't have any documents to search through/)).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('chat-no-docs.png', { fullPage: true });
  });
});
