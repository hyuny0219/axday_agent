import { test, expect } from './fixtures';

test('제목이 렌더된다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
});
