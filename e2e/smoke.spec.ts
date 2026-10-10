import { test, expect } from './fixtures';

test('제목이 렌더된다', async ({ page }) => {
  await page.goto('/?mode=scripted&coach=off');
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
});
