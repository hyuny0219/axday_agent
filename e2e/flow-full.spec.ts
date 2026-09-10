import { test, expect } from '@playwright/test';

test('추천 문구만으로 ATTRACT부터 RESULT까지 완주하고, 결과에 5석과 결론이 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS 화면에는 찬성/보류/반대 버튼이 없어야 한다.
  await expect(page.getByRole('button', { name: '찬성' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '보류' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '반대' })).toHaveCount(0);

  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 추천 선택지 중 '앞선 의견 유지'로 후속 없이 바로 마무리한다.
  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await page.getByTestId('followup-option-2').click();

  // MOTION: 확정된 조건으로 표결을 건다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  // VOTE: 찬성을 선택하고 확정한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  // RESULT: 결론과 동등한 5석 카드가 보인다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-CEO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CFO_CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();

  await page.getByTestId('end-session').click();
  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
});
