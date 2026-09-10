import { test, expect, type Page } from '@playwright/test';

async function reachDiscuss(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
}

async function finishToResult(page: Page) {
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await page.getByTestId('followup-option-2').click(); // 앞선 의견 유지

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
}

test('AI 비서실장을 열고 내 발언 정리를 적용하면, 결과에 사용 기록이 남는다', async ({ page }) => {
  await reachDiscuss(page);

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill('아직 확인되지 않은 부분이 있어 검토 없이 바로 진행하지 않겠습니다.');

  // 패널은 닫혀 있다가 열기 버튼으로만 열리고, '닫기'가 항상 보인다.
  await expect(page.getByTestId('assistant-panel')).toHaveCount(0);
  await page.getByTestId('assistant-toggle').click();
  const panel = page.getByTestId('assistant-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('assistant-close')).toBeVisible();
  await expect(panel.getByText('AI 비서실장(시연)')).toBeVisible();

  await page.getByTestId('assistant-action-refine').click();
  const refineResult = page.getByTestId('assistant-result-refine');
  await expect(refineResult).toBeVisible();

  const refinedText = await page.getByTestId('assistant-refine-draft').textContent();
  expect(refinedText).toContain('않');
  expect(refinedText).toContain('없이');

  // 적용을 누르기 전에는 원문이 바뀌지 않는다.
  await expect(textarea).toHaveValue('아직 확인되지 않은 부분이 있어 검토 없이 바로 진행하지 않겠습니다.');

  await page.getByTestId('assistant-apply-refine').click();
  await expect(textarea).toHaveValue(refinedText ?? '');

  await page.getByTestId('assistant-close').click();
  await expect(page.getByTestId('assistant-panel')).toHaveCount(0);

  await finishToResult(page);

  const aiHelp = page.getByTestId('result-ai-help');
  await expect(aiHelp).toContainText('자료 4장 자동 정리 데모 표시');
  await expect(aiHelp).toContainText('내 발언 정리를 내 발언에 적용했습니다.');
  await expect(page.getByTestId('result-ai-help-none')).toHaveCount(0);
});

test('패널을 열지 않고 완주해도 결과에는 자료 자동 정리 기록만 남는다', async ({ page }) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-P1').click();
  await finishToResult(page);

  const aiHelp = page.getByTestId('result-ai-help');
  await expect(aiHelp).toContainText('자료 4장 자동 정리 데모 표시');
  await expect(page.getByTestId('result-ai-help-none')).toContainText(
    '추가 AI 도움은 사용하지 않았습니다.',
  );
});
