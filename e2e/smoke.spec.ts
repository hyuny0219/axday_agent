import { test, expect } from '@playwright/test';

test('제목이 렌더된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
});
