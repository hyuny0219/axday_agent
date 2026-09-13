import { test, expect } from './fixtures';

test('대기에서 임원 의견까지 도달하고, 준비 중 안건은 선택할 수 없다', async ({ page }) => {
  await page.goto('/?mode=scripted');

  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
  await page.getByRole('button', { name: '체험 시작' }).click();

  await expect(page.getByTestId('scenario-card-data-openness')).toBeDisabled();
  await expect(page.getByTestId('scenario-card-prevention')).toBeDisabled();

  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();

  const briefingNext = page.getByRole('button', { name: '의견 듣기' });
  await expect(briefingNext).toBeVisible();
  await expect(page.getByTestId('briefing-issues')).toBeVisible();
  await briefingNext.click();

  await expect(page.getByRole('heading', { name: '임원들의 첫 의견' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내 의견 말하기' })).toBeVisible();
});
