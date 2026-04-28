import { test, expect } from './setup';
import { mockApiRoutes, settle } from './fixtures';

const getChatTabButton = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation').getByRole('button', { name: /^Chat$/ });

test.describe('Message bubbles', () => {
  test('user and assistant bubbles render with serif body and proper alignment', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await getChatTabButton(page).click();
    await page.getByPlaceholder(/Ask about your documents/).fill('What is a document?');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText(/A document is a piece of text/)).toBeVisible();
    await settle(page);

    await expect(page.getByTestId('chat-region')).toHaveScreenshot('message-bubbles.png');
  });
});
