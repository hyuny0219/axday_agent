import { test, expect } from './fixtures';

// T78(2026-10-02, 안건 교체): 레지스트리의 두 카드(ai-approval·experience-first)가
// 모두 active라 "준비 중" 카드가 없다 — 이제는 두 카드 모두 선택할 수 있는지, 그리고
// 그중 하나로 임원 의견까지 도달하는지 확인한다.
test('대기에서 임원 의견까지 도달하고, 안건 선택 카드 2장이 모두 활성이다', async ({ page }) => {
  await page.goto('/?mode=scripted');

  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
  await page.getByRole('button', { name: '체험 시작' }).click();

  // T78: 시안(S1_Select) 카드는 2장이고, 둘 다 선택 가능한 안건이다.
  await expect(page.getByTestId('scenario-card-ai-approval')).toBeEnabled();
  await expect(page.getByTestId('scenario-card-experience-first')).toBeEnabled();

  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();

  const briefingNext = page.getByRole('button', { name: '의견 듣기' });
  await expect(briefingNext).toBeVisible();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await briefingNext.click();

  await expect(page.getByRole('heading', { name: '임원 네 명의 첫 의견' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내 의견 말하기' })).toBeVisible();
});
