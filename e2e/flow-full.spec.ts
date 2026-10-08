import { test, expect } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

test('추천 문구만으로 ATTRACT부터 RESULT까지 완주하고, 결과에 VERDICTS 5행과 결론이 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // DISCUSS 화면에는 (실제 표결용) 찬성/반대 버튼이 없어야 한다 — T87의 "찬성/반대
  // 쪽에서 말하기" 입장 선택 버튼은 이름이 그 단어를 포함하므로 exact로 가른다.
  await expect(page.getByRole('button', { name: '찬성', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '반대', exact: true })).toHaveCount(0);

  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 추천 선택지 중 '앞선 의견 유지'로 후속 없이 바로 마무리한다.
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('keep-previous-answer').click();

  // MOTION: 확정된 조건으로 표결을 건다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  // VOTE: 찬성을 선택하고 확정한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  // RESULT: 결론과 VERDICTS 5행(임원 4명 + 나)이 보인다(T66, 5석 카드는 폐기).
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-CEO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CFO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();

  await page.getByTestId('end-session').click();
  await page.getByTestId('end-session-confirm-ok').click();
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
});

test('추천 문구를 하나도 고르지 않고 직접 입력만으로 ATTRACT부터 RESULT까지 완주한다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // DISCUSS: 추천 문구 카드를 클릭하지 않고 직접 입력만 채운다.
  const draftTextarea = page.getByTestId('draft-editor-textarea');
  await draftTextarea.fill('작은 범위로 먼저 시작하고 결과를 확인한 뒤 넓히면 좋겠습니다.');
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 추천 답변 체크 카드 대신 textarea에 직접 입력한다(T74부터 늘 보인다).
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  const followupTextarea = page.getByTestId('followup-textarea');
  await expect(followupTextarea).toBeVisible();
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

  // RESULT: VERDICTS 5행이 모두 보인다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-CEO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CFO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
});

test('LIMIT+REVIEW 조건에 찬성하면, 이사회 한 장 요약에서 내 표의 결정력과 CFO만 바뀐 표가 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // LIMIT(결재 금액 한도) + REVIEW(사람이 일부 다시 보기)만 확정한다.
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P3').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 앞선 의견을 유지해 OWNER 조건을 추가하지 않는다.
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('keep-previous-answer').click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  // LIMIT+REVIEW만 있으면 임원 표는 YES/YES/NO/NO라 참가자 표에 따라 가결/부결이
  // 갈린다(docs/SCENARIO_AI_APPROVAL.md "표결 우선순위") — 내 한 표가 결과를 정한다.
  await expect(page.getByTestId('result-summary-decisive')).toContainText(
    '이사님의 한 표가 결과를 정했습니다',
  );
  // 조건 없는 baseline 대비 CFO만 표가 바뀐다(NO→YES). 행 testid는 T66에서
  // result-seat-<id>로 통일했다(5석 카드가 빠지며 VERDICTS 행이 그 자리를 겸한다).
  await expect(
    page.getByTestId('result-seat-CFO').getByTestId('result-summary-changed'),
  ).toBeVisible();
  await expect(
    page.getByTestId('result-seat-CEO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('result-seat-CAIO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('result-seat-CISO').getByTestId('result-summary-changed'),
  ).toHaveCount(0);
});

// T78: 안건 ②(experience-first)도 scripted로 전 구간 완주하는지 각각 확인한다(카드
// "두 안건 모두 scripted 완주 e2e 1개씩").
test('안건 ②(데이터보다 경험)도 추천 문구만으로 ATTRACT부터 RESULT까지 완주한다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-experience-first').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();

  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('keep-previous-answer').click(); // 앞선 의견 유지(KEEP_PREVIOUS)

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-CEO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CFO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-seat-CISO')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();

  await page.getByTestId('end-session').click();
  await page.getByTestId('end-session-confirm-ok').click();
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
});

// T87(사용자 — "찬성/반대를 고르면 추천 문구가 뜨도록"): 반대 쪽 문구(N4, 조건과
// 연결되지 않은 순수 반대)만 골라도 ATTRACT부터 RESULT까지 완주하고, 확정한 조건이
// 없으니 MOTION이 원안 그대로 표결로 이어지는지 본다.
test('반대 쪽 추천 문구만 골라도 완주하고, 조건이 없어 원안 그대로 표결로 이어진다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  await page.getByTestId('discuss-side-against').click();
  // 반대 쪽을 고르면 찬성 쪽 문구(P1~P5)는 보이지 않고, 반대 문구(N1~N4) + 요청형
  // (P6, BOTH)만 보인다.
  await expect(page.getByTestId('phrase-card-P1')).toHaveCount(0);
  await expect(page.getByTestId('phrase-card-N4')).toBeVisible();
  await expect(page.getByTestId('phrase-card-P6')).toBeVisible();

  await page.getByTestId('phrase-card-N4').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion2 = page.getByTestId('submit-opinion');
  await expect(submitOpinion2).toBeEnabled();
  await submitOpinion2.click();

  // REACTIONS: 조건을 더 붙이지 않고 그대로 넘어간다.
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('keep-previous-answer').click();

  // MOTION: N4는 조건과 연결되지 않아 반영된 조건이 없다 — 원안 그대로 표결한다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('motion-conditions')).toHaveCount(0);
  await expect(page.getByText('확정한 수정 조건이 없어 원안 그대로 표결합니다.')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  // VOTE: 내 표는 입장 선택과 무관하게 따로 고른다(표결은 마지막에 따로 한다).
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-NO').check();
  const confirmVote2 = page.getByTestId('confirm-vote');
  await expect(confirmVote2).toBeEnabled();
  await confirmVote2.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
});
