import { test, expect } from './fixtures';

test('추천 문구만으로 ATTRACT부터 RESULT까지 완주하고, 결과에 5석과 결론이 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
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
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
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
  await expect(page.getByTestId('result-seat-CFO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();

  await page.getByTestId('end-session').click();
  await expect(page.getByRole('heading', { name: 'BOARDROOM 2026' })).toBeVisible();
});

test('추천 문구를 하나도 고르지 않고 직접 입력만으로 ATTRACT부터 RESULT까지 완주한다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS: 추천 문구 카드를 클릭하지 않고 직접 입력만 채운다.
  const draftTextarea = page.getByTestId('draft-editor-textarea');
  await draftTextarea.fill('작은 범위로 먼저 시작하고 결과를 확인한 뒤 넓히면 좋겠습니다.');
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 선택지 버튼 대신 직접 답하기를 키보드로 열고 입력한다.
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  const openEditor = page.getByTestId('followup-open-editor');
  const followupTextarea = page.getByTestId('followup-textarea');
  await expect(followupTextarea).toBeHidden();
  await openEditor.focus();
  await page.keyboard.press('Enter');
  await expect(followupTextarea).toBeFocused();
  await followupTextarea.fill('제 의견을 유지하되 진행 상황만 계속 공유해 주세요.');
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  // MOTION: 확정된 조건으로 표결을 건다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  // VOTE: 찬성을 선택하고 확정한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  // RESULT: 5석 카드가 모두 보인다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-CEO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CFO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
});

test('PILOT+MEASURE 조건에 찬성하면, 이사회 한 장 요약에서 내 표의 결정력과 CFO만 바뀐 표가 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // PILOT(한 게시판에서 시범) + MEASURE(운영 효과 측정 후 확대)만 확정한다.
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P4').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 앞선 의견을 유지해 SCREEN 조건을 추가하지 않는다.
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('followup-option-2').click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  // PILOT+MEASURE만 있으면 임원 표는 YES/YES/NO/NO라 참가자 표에 따라 가결/부결/보류가
  // 갈린다(SCENARIO_AI_ASSISTANT.md "대표 경로") — 내 한 표가 결과를 정한다.
  await expect(page.getByTestId('result-summary-decisive')).toContainText(
    '이사님의 한 표가 결과를 정했습니다',
  );
  // 조건 없는 baseline 대비 CFO만 표가 바뀐다(HOLD→YES).
  await expect(
    page.getByTestId('result-summary-row-CFO').getByTestId('result-summary-changed'),
  ).toBeVisible();
  await expect(
    page.getByTestId('result-summary-row-CEO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('result-summary-row-CAIO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('result-summary-row-CISO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
});
