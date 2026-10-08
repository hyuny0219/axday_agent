import { test, expect } from './fixtures';

// T78(2026-10-02, 안건 교체): 레지스트리의 두 카드(ai-approval·experience-first)가
// 모두 active라 "준비 중" 카드가 없다 — 이제는 두 카드 모두 선택할 수 있는지, 그리고
// 그중 하나로 임원 의견까지 도달하는지 확인한다.
test('대기에서 임원 의견까지 도달하고, 안건 선택 카드 2장이 모두 활성이다', async ({ page }) => {
  await page.goto('/?mode=scripted');

  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안내 없이 시작' }).click();

  // T78: 시안(S1_Select) 카드는 2장이고, 둘 다 선택 가능한 안건이다.
  await expect(page.getByTestId('scenario-card-ai-approval')).toBeEnabled();
  await expect(page.getByTestId('scenario-card-experience-first')).toBeEnabled();

  await page.getByTestId('scenario-card-ai-approval').click();

  const briefingNext = page.getByRole('button', { name: '의견 듣기' });
  await expect(briefingNext).toBeVisible();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  // T95: 근거 자료를 한 번 열어 닫기 전에는 "의견 듣기 ▶"가 잠겨 있다.
  await expect(briefingNext).toBeDisabled();
  await expect(briefingNext).toHaveAccessibleDescription('근거 자료를 먼저 확인해 주세요');
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await expect(briefingNext).toBeEnabled();
  await briefingNext.click();

  await expect(page.getByRole('heading', { name: '임원 의견 듣기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내 의견 쓰러 가기' })).toBeVisible();
});
