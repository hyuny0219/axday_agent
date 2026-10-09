// 임원 표정 배지("지금 기울어 있는 쪽")와 "설득 도장" e2e(T63). scripted에서는 조건을
// 모두 확정하는 경로와 조건 없이 진행하는 경로를 비교해 REACTIONS 표정 전환이 다르게
// 보이는지 확인하고, RESULT에서는 표정 배지 대신 표결 배지만 보이며 설득 도장 여부가
// 실제 표 집계(같은 표 3석 이상)와 일치하는지 단언한다. live는 mock 서버(8787)의 고정
// stance로 무대·본문 표정이 채워지는지만 확인한다 — 라운드 응답이 배열 하나로
// 한꺼번에 오므로(server/handlers/round.ts, Promise.allSettled 뒤 단일 응답) 실제
// 네트워크 도착이 임원별로 갈라지지 않는다(라운드 계약: /api/board/round가 4명 응답을 한 번에
// 돌려준다 — DESIGN_SPEC v1.0 5절 표정 배지 항목, Codex 11차 P2로 명세를 이 구조에 맞춤). 갱신 단위는 라운드이며 아래는 라운드가 바뀔
// 때마다(OPINIONS → REACTIONS) 값이 갱신되는 것으로 확인한다.

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

async function enterOpinions(page: Page) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
}

function moodBadge(page: Page, memberId: string) {
  return page.getByTestId(`stage-mood-${memberId}`);
}

test.describe('scripted: 무대 표정과 설득 도장', () => {
  test('추천 문구를 모두 고르고 추가 질문에 답하면 고민 중을 거쳐 전원 찬성이 되고 RESULT에서 성공 도장을 얻는다', async ({
    page,
  }) => {
    await enterOpinions(page);

    // OPINIONS 진입 즉시 넷 다 표정이 채워진다(안건 문서의 첫 stance,
    // initialOpinions[].openingStance — PR #13 Codex 3차 검토. CAIO는 "미정"이다).
    await expect(moodBadge(page, 'CEO')).toHaveClass(/stage-band__mood--for/);
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--against/);
    await expect(moodBadge(page, 'CAIO')).toHaveClass(/stage-band__mood--undecided/);
    await expect(moodBadge(page, 'CISO')).toHaveClass(/stage-band__mood--against/);
    // 본문 카드(임원 카드의 상태 칩 옆)에도 같은 문구가 접근 가능한 텍스트로 있다.
    await expect(page.getByTestId('exec-mood-label-CEO')).toHaveText('찬성 쪽');
    await expect(page.getByTestId('exec-mood-label-CFO')).toHaveText('반대 쪽');
    await expect(page.getByTestId('exec-mood-label-CAIO')).toHaveText('고민 중');

    await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
    await page.getByTestId('discuss-side-for').click();
    // LIMIT·LOG·REVIEW·OWNER 네 조건을 모두 제안하는 문구 4개를 고른다.
    await page.getByTestId('phrase-card-P1').click();
    await page.getByTestId('phrase-card-P2').click();
    await page.getByTestId('phrase-card-P3').click();
    await page.getByTestId('phrase-card-P4').click();
    await tryAllAssistantFeatures(page);
    const submitOpinion = page.getByTestId('submit-opinion');
    await expect(submitOpinion).toBeEnabled();
    await submitOpinion.click();

    // REACTIONS 1/2(T110·T118, 두 단계 설득): 네 조건이 모두 확정돼도 CFO·CAIO·CISO는 확정 전이라
    // "찬성 쪽"으로 기울기만 한다(점선 표정). 처음부터 같은 편인 CEO는 찬성 그대로다.
    await expect(moodBadge(page, 'CEO')).toHaveClass(/stage-band__mood--for/);
    for (const id of ['CFO', 'CAIO', 'CISO']) {
      await expect(moodBadge(page, id)).toHaveClass(/stage-band__mood--for/);
      await expect(moodBadge(page, id)).toHaveClass(/stage-band__mood--leaning/);
      await expect(page.getByTestId(`reaction-card-${id}`)).toContainText('하나만 더 묻겠습니다');
      await expect(page.getByTestId(`reaction-card-${id}`)).toContainText('답변하면 확정됩니다');
      await expect(page.getByTestId(`exec-mood-label-${id}`)).toHaveText('찬성 쪽');
    }
    await expect(page.getByTestId('reaction-card-CEO')).not.toContainText('하나만 더 묻겠습니다');
    await expect(page.getByTestId('reaction-card-badge-CFO')).toHaveText('반대 → 찬성 쪽');
    await expect(page.getByTestId('reaction-card-badge-CAIO')).toHaveText('고민 중 → 찬성 쪽');

    // 현황판: 기울어진 방향('반대 → 찬성 쪽')과 답변하면 확정된다는 안내를 보인다.
    // 1280 이하에서는 접혀 있고 넓은 화면에서는 펼쳐져 있다 — 펼친 상태로 맞춘다.
    const boardToggle = page.getByTestId('persuasion-board-toggle');
    if ((await boardToggle.getAttribute('aria-expanded')) !== 'true') {
      await boardToggle.click();
    }
    await expect(page.getByTestId('persuasion-board-stance-CFO')).toContainText('반대 → 찬성 쪽');
    await expect(page.getByTestId('persuasion-board-note-CFO')).toContainText('답변하면 확정');
    await expect(page.getByTestId('persuasion-board-count')).toContainText('(기울음 3)');

    // 추가 질문에 답을 전달하면(책임자를 정하는 추천 답변) 조건이 맞은 임원이 찬성으로 바뀐다.
    await page.getByTestId('reactions-advance').click();
    await page.getByTestId('followup-option-0').click();
    await page.getByTestId('submit-followup').click();
    await expect(page.getByTestId('motion-card')).toBeVisible();
    // T114: 답변 뒤에는 임원 방향을 봉인한다 — 네 명 모두 중립 표정이고 본문은 "입장 봉인"이다.
    for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      await expect(moodBadge(page, id)).toHaveClass(/stage-band__mood--undecided/);
      await expect(page.getByTestId(`exec-mood-label-${id}`)).toContainText('입장 봉인');
    }
    await page.getByTestId('freeze-motion').click();

    // VOTE: 봉인은 표결까지 이어진다.
    await expect(page.getByTestId('vote-motion-card')).toBeVisible();
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--undecided/);

    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();

    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    // RESULT에서는 표정 배지 대신 표결 배지만 보인다.
    await expect(page.locator('[data-testid^="stage-mood-"]')).toHaveCount(0);
    await expect(page.getByTestId('stage-vote-badge-CEO')).toBeVisible();

    // 임원 4명 + 참가자 모두 찬성이므로(YES 5) 참가자 표와 같은 표가 5석 → 3석 이상,
    // 설득 도장을 얻는다. tally와 일치함을 함께 단언한다.
    await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 5');
    await expect(page.getByTestId('persuasion-stamp')).toBeVisible();
    await expect(page.getByTestId('result-tally-caption')).toContainText(
      '찬성 · 나를 포함해 같은 표 5석 · 설득한 임원 3/3 · 처음부터 같은 편 1명은 세지 않음 — 성공 도장을 받았습니다',
    );
  });

  test('추천 문구를 모두 고르고 답하지 않고 넘어가면 고민 중이던 임원이 반대표를 던져 실패 도장을 받는다(T110)', async ({
    page,
  }) => {
    await enterOpinions(page);
    await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
    await page.getByTestId('discuss-side-for').click();
    await page.getByTestId('phrase-card-P1').click();
    await page.getByTestId('phrase-card-P2').click();
    await page.getByTestId('phrase-card-P3').click();
    await page.getByTestId('phrase-card-P4').click();
    await tryAllAssistantFeatures(page);
    await page.getByTestId('submit-opinion').click();

    // 1차 반응: 조건이 모두 맞아도 기울음까지만이다(전원 설득으로 끝나지 않는다).
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--leaning/);

    // 추가 질문에 답하지 않고 넘어간다 — 기울었던 세 임원은 반대 쪽으로 확정된다.
    await page.getByTestId('keep-previous-answer').click();
    await expect(page.getByTestId('motion-card')).toBeVisible();
    // T114: 답하지 않고 넘어간 뒤에도 방향은 봉인이다 — 표정은 모두 중립이다.
    for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      await expect(moodBadge(page, id)).toHaveClass(/stage-band__mood--undecided/);
    }
    await page.getByTestId('freeze-motion').click();

    await expect(page.getByTestId('vote-motion-card')).toBeVisible();
    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();

    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    // CEO와 나만 찬성(2석) — 부결이고 같은 표 3석에 못 미쳐 실패 도장이다.
    await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 2');
    await expect(page.getByTestId('persuasion-stamp')).toHaveCount(0);
    await expect(page.getByTestId('persuasion-stamp-missed')).toBeVisible();
    await expect(page.getByTestId('result-persuasion-summary')).toContainText('추가 질문에 답하지 않아');
    await expect(page.getByTestId('result-seat-reason-CFO')).toContainText('추가 질문에 답이 없어');
    await expect(page.getByTestId('result-near-miss-CFO')).toContainText('추가 질문에 답했다면 찬성');
  });

  test('조건 없이 진행하면 REACTIONS 표정이 그대로 유지되고 RESULT에서 설득 도장을 얻지 못한다', async ({
    page,
  }) => {
    await enterOpinions(page);
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--against/);
    // CAIO의 첫 stance는 "미정"이다(openingStance) — 참가자가 조건 없이 말한 뒤
    // REACTIONS에서는 voteRules의 always 분기(AGAINST)로 넘어간다(아래).
    await expect(moodBadge(page, 'CAIO')).toHaveClass(/stage-band__mood--undecided/);

    await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
    await page.getByTestId('discuss-side-for').click();
    // 조건 키워드가 전혀 없는 문장(어떤 조건도 제안하지 않는다).
    await page.getByTestId('draft-editor-textarea').fill('이 안건을 검토했습니다.');
    await tryAllAssistantFeatures(page);
    const submitOpinion = page.getByTestId('submit-opinion');
    await expect(submitOpinion).toBeEnabled();
    await submitOpinion.click();

    // REACTIONS: 확정된 조건이 없어 CEO·CFO·CISO는 OPINIONS와 같게 유지된다(조건 붙일
    // 때와 다르게 보인다 — 위 테스트에서는 이 시점에 전원 찬성 쪽으로 바뀌었다). CAIO는
    // "첫 반응(미정)"에서 "참가자가 조건 없이 말을 마친 뒤의 판단(반대)"으로 넘어간다
    // (PR #13 Codex 3차 검토 — 참가자가 실제로 의견을 전달한 뒤에는 voteRules의 always
    // 분기를 쓴다).
    await expect(moodBadge(page, 'CEO')).toHaveClass(/stage-band__mood--for/);
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--against/);
    await expect(moodBadge(page, 'CAIO')).toHaveClass(/stage-band__mood--against/);
    await expect(moodBadge(page, 'CISO')).toHaveClass(/stage-band__mood--against/);

    // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
    await page.getByTestId('reactions-advance').click();
    // 조건을 제안하지 않는 빠른 답을 고른다(T89: 입장과 무관한 BOTH 옵션, 6번 인덱스).
    await page.getByTestId('followup-option-6').click();
    await page.getByTestId('submit-followup').click();
    await expect(page.getByTestId('motion-card')).toBeVisible();
    await page.getByTestId('freeze-motion').click();

    await expect(page.getByTestId('vote-motion-card')).toBeVisible();
    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();

    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    await expect(page.locator('[data-testid^="stage-mood-"]')).toHaveCount(0);

    // CEO+참가자만 찬성(2석) — 3석에 못 미쳐 도장을 얻지 못한다. tally와 일치한다.
    await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 2');
    await expect(page.getByTestId('persuasion-stamp')).toHaveCount(0);
    await expect(page.getByTestId('result-tally-caption')).toContainText(
      '찬성 · 나를 포함해 같은 표 2석 · 설득한 임원 0/3 · 처음부터 같은 편 1명은 세지 않음 — 실패 도장 · 3석부터 성공입니다',
    );
  });
});

test('MOTION·VOTE에서도 임원 입장이 접근 가능한 텍스트로 남는다(sr-only)', async ({ page }) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('keep-previous-answer').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  // 무대는 aria-hidden이므로 본문에 같은 값을 텍스트로 둔다(PR #11 Codex 13차). T114: 답변 뒤에는 "입장 봉인".
  for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
    await expect(page.getByTestId(`exec-mood-label-${id}`)).toContainText('입장 봉인');
  }
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
    await expect(page.getByTestId(`exec-mood-label-${id}`)).toContainText('입장 봉인');
  }
});

test.describe('live mock: 무대 표정', () => {
  test('라운드가 도착하면 표정 배지가 채워지고 RESULT까지 고정되며 표 집계와 도장 여부가 일치한다', async ({
    page,
  }) => {
    await page.goto('/?coach=off');
    await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

    await page.getByRole('button', { name: '체험 시작' }).click();
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await page.getByTestId('scenario-card-ai-approval').click();
    await page.getByTestId('open-evidence').click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '의견 듣기' }).click();

    // OPINIONS의 stance는 mock 제공자가 안건의 roleLenses.opening을 쓴다(PR #13 Codex
    // 3차 검토, server/providers/mock.ts scenarioAwareOpeningStance) — 안건①(ai-approval)
    // 문서 기준 CEO FOR·CFO AGAINST·CAIO UNDECIDED·CISO AGAINST.
    await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
    await expect(moodBadge(page, 'CEO')).toHaveClass(/stage-band__mood--for/);
    await expect(moodBadge(page, 'CAIO')).toHaveClass(/stage-band__mood--undecided/);
    await expect(moodBadge(page, 'CFO')).toHaveClass(/stage-band__mood--against/);
    await expect(moodBadge(page, 'CISO')).toHaveClass(/stage-band__mood--against/);
    await expect(page.getByTestId('exec-mood-label-CEO')).toHaveText('찬성 쪽');
    await expect(page.getByTestId('exec-mood-label-CAIO')).toHaveText('고민 중');

    await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
    await page.getByTestId('discuss-side-for').click();
    await page.getByTestId('phrase-card-P1').click();
    await tryAllAssistantFeatures(page);
    const submitOpinion = page.getByTestId('submit-opinion');
    await expect(submitOpinion).toBeEnabled();
    await submitOpinion.click();

    // REACTIONS 라운드가 새로 도착해도 mock은 같은 고정값을 돌려주므로 표정은 그대로다.
    await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
    await expect(moodBadge(page, 'CEO')).toHaveClass(/stage-band__mood--for/);

    // v12(T110)·T118: live는 모델 stance가 미정이어도 규칙표로 조건이 충족돼야 기울음으로 본다.
    // 이 흐름은 추천 문구 하나(P1)만 골라 CAIO의 조건이 모자라므로 기울음 없이 고민 중 그대로다.
    await expect(moodBadge(page, 'CAIO')).toHaveClass(/stage-band__mood--undecided/);
    await expect(moodBadge(page, 'CAIO')).not.toHaveClass(/stage-band__mood--leaning/);

    // 추가 질문에 답을 전달하면(FOLLOWUP 라운드) mock 최종표가 그대로 나온다.
    await page.getByTestId('reactions-advance').click();
    await page.getByTestId('followup-option-0').click();
    await page.getByTestId('submit-followup').click();
    await expect(page.getByTestId('motion-card')).toBeVisible();
    await expect(page.getByTestId('freeze-motion')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('freeze-motion').click();

    await expect(page.getByTestId('vote-motion-card')).toBeVisible();
    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();

    await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="stage-mood-"]')).toHaveCount(0);

    // mock 최종표(server/providers/mock.ts ROLE_VOTE): CEO·CAIO YES, CFO·CISO NO. 참가자
    // YES를 더하면 찬성 3석 → 참가자 표와 같은 표 3석(경계), 도장을 얻는다.
    await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 3');
    await expect(page.getByTestId('persuasion-stamp')).toBeVisible();
    // live 첫 의견(mock)에 따라 "처음부터 같은 편" 수가 달라 분모는 고정하지 않는다(T101).
    await expect(page.getByTestId('result-tally-caption')).toContainText('찬성 · 나를 포함해 같은 표 3석');
    await expect(page.getByTestId('result-tally-caption')).toContainText(/설득한 임원 \d\/\d|모두 처음부터 같은 편/);
    await expect(page.getByTestId('result-tally-caption')).toContainText('성공 도장을 받았습니다');
  });
  test('추가 질문에 답하지 않고 넘어가면 mock에서도 CAIO가 반대표로 돌아가 찬성 2석·실패 도장이다(v12)', async ({
    page,
  }) => {
    await page.goto('/?coach=off');
    await page.getByRole('button', { name: '체험 시작' }).click();
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await page.getByTestId('scenario-card-ai-approval').click();
    await page.getByTestId('open-evidence').click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '의견 듣기' }).click();
    await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
    await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
    await page.getByTestId('discuss-side-for').click();
    await page.getByTestId('phrase-card-P1').click();
    await tryAllAssistantFeatures(page);
    await page.getByTestId('submit-opinion').click();
    await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

    await page.getByTestId('keep-previous-answer').click();
    await expect(page.getByTestId('motion-card')).toBeVisible();
    await page.getByTestId('freeze-motion').click();
    await expect(page.getByTestId('vote-motion-card')).toBeVisible();
    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();

    await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 2');
    await expect(page.getByTestId('persuasion-stamp-missed')).toBeVisible();
  });
});
