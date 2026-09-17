// v0.9 브리핑 이해도 패치(T39) E2E: 의장 브리핑·핵심 쟁점 3개·조건 미리보기 4칩이
// 보이고 칩을 눌러도 아무 일도 일어나지 않는다. 진행 스트립이 BRIEFING에서 ①을,
// DISCUSS에서 ③을 가리키는지도 함께 확인한다.

import { test, expect } from './fixtures';

test('브리핑에 의장 브리핑·핵심 쟁점·조건 미리보기가 보이고 칩은 클릭해도 반응하지 않는다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-issues')).toBeVisible();
  await expect(page.getByTestId('briefing-issues').locator('li.briefing-issues__item')).toHaveCount(
    3,
  );

  const conditionPreview = page.getByTestId('condition-preview');
  await expect(conditionPreview).toBeVisible();
  const chips = conditionPreview.locator('.condition-preview__chip');
  await expect(chips).toHaveCount(4);
  for (const id of ['PILOT', 'REVIEW', 'ACCESS', 'MEASURE']) {
    await expect(page.getByTestId(`condition-preview-chip-${id}`)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  }

  // 칩을 눌러도 브리핑 화면에 그대로 남아 있어야 한다(클릭 불가, 다음 화면으로 넘어가지 않음).
  await chips.first().click({ force: true });
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  // 진행 스트립: BRIEFING에서는 ①이 현재 단계다.
  await expect(page.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS에서는 ③이 현재 단계다.
  await expect(page.getByTestId('progress-step-3')).toHaveAttribute('aria-current', 'step');
});
