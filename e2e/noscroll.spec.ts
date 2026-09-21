// 무스크롤 검수(DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙", T45). 게임
// 화면처럼 ATTRACT~RESULT 모든 단계에서 document.scrollingElement이 스크롤되지
// 않아야 한다 — 넘치는 내용은 지정된 패널 하나만 안에서 스크롤한다. playwright.config.ts의
// 두 프로젝트(desktop-1080·desktop-720)가 각각 1920×1080·1280×720 뷰포트를 이미
// 고정하므로 이 스펙은 뷰포트를 직접 지정하지 않고 두 프로젝트 모두에서 그대로 돈다.
// DISCUSS는 추천 문구 4개(조건 4개, 실제 시나리오 최대치)를 선택하고 비서실장 드로어까지
// 열어 가장 내용이 많은 상태에서 단언한다(card "비서실장 드로어 열린 상태 포함").

import { test, expect, type Page, type Route } from './fixtures';

async function expectNoPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(
    overflow.scrollHeight <= overflow.clientHeight + 1,
    `${label}: scrollHeight(${overflow.scrollHeight}) <= clientHeight(${overflow.clientHeight}) + 1`,
  ).toBe(true);
}

test('ATTRACT부터 RESULT까지 모든 단계가 페이지 스크롤 없이 한 화면에 보인다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await expectNoPageScroll(page, 'ATTRACT');

  await page.getByRole('button', { name: '체험 시작' }).click();
  await expectNoPageScroll(page, 'SELECT');
  // 사건 헤드라인(T47): 카드 안에서 잘리지 않고 보인다.
  await expect(
    page.getByTestId('scenario-card-ai-assistant').locator('.scenario-card__title'),
  ).toBeInViewport();

  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expectNoPageScroll(page, 'BRIEFING');
  // 사건 표기 eyebrow(T47): 안건 제목 위 한 줄이 잘리지 않고 보인다.
  await expect(page.getByTestId('briefing-incident')).toBeInViewport();
  // 회의록 패널(v1.0 7절, T41): BRIEFING·OPINIONS·MOTION·VOTE에서만 보이고, 왼쪽 열
  // (무대·행동·회의록)이 잘리지 않는다.
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'BRIEFING');
  // 근거 카드를 펼쳐도 잘리지 않고, 한 번에 한 장만 펼쳐진다(PR #6 Codex 3차 검토).
  await page.getByTestId('evidence-card-E1').locator('summary').click();
  await expect(page.getByTestId('evidence-card-E1')).toHaveAttribute('open', '');
  await expectNoPageScroll(page, 'BRIEFING(E1 펼침)');
  await expectNoClip(page, '.app-body__content', 'BRIEFING(E1 펼침)');
  await page.getByTestId('evidence-card-E2').locator('summary').click();
  await expect(page.getByTestId('evidence-card-E2')).toHaveAttribute('open', '');
  await expect(page.getByTestId('evidence-card-E1')).not.toHaveAttribute('open', '');
  await expectNoClip(page, '.app-body__content', 'BRIEFING(E2 펼침)');
  await expect(page.getByTestId('condition-preview')).toBeInViewport();
  await page.getByTestId('evidence-card-E2').locator('summary').click();

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.getByRole('heading', { name: '임원들의 첫 의견' })).toBeVisible();
  await expectNoPageScroll(page, 'OPINIONS');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'OPINIONS');

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  // 추천 문구 4개(조건 4개, 시나리오 최대치)를 선택해 가장 내용이 많은 상태를 만든다.
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await expectNoPageScroll(page, 'DISCUSS(조건 4개 선택)');
  await page.getByTestId('evidence-card-E4').locator('summary').click();
  await expectNoClip(page, '.app-body__content', 'DISCUSS(E4 펼침)');
  await page.getByTestId('evidence-card-E4').locator('summary').click();

  // 비서실장 드로어를 연 상태도 스크롤이 없어야 한다(오른쪽 열 위에 겹치는 드로어).
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'DISCUSS(비서실장 드로어 열림)');
  await page.getByTestId('assistant-toggle').click();

  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS');

  // 직접 답하기(가장 내용이 많은 경로)를 열고 조건 칩까지 노출한 상태도 확인한다.
  await page.getByTestId('followup-open-editor').click();
  await page.getByTestId('followup-textarea').fill('출처와 기준일 차이를 표시하고 공유 전 담당자 확인 절차를 정합니다.');
  await expectNoPageScroll(page, 'REACTIONS(직접 답하기 + 조건 칩)');

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS(비서실장 드로어 열림)');
  await page.getByTestId('assistant-toggle').click();

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'MOTION');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'MOTION');

  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'VOTE');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'VOTE');

  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expectNoPageScroll(page, 'RESULT');
  // "6개월 뒤" 에필로그(T47): 왼쪽 열 게이지 아래·CTA 위, 잘리지 않고 보인다.
  await expect(page.getByTestId('result-epilogue')).toBeInViewport();
  // "이사회 한 장 요약"(T48): 기록 영역 2/3 패널과 보조 패널의 'AI가 도운 일'이 모두
  // 뷰포트 안에 있다(페이지 스크롤 없음은 위 expectNoPageScroll로 이미 확인했다).
  await expect(page.getByTestId('result-summary')).toBeInViewport();
  await expect(page.getByTestId('result-ai-help')).toBeInViewport();
});

// live 모드 최악 경로(PR #6 Codex 검토): 임원 4명 모두 120자 발언 + 근거 칩 + 인용을
// 돌려주면 답글 카드가 세로로 쌓여 오른쪽 열(overflow:hidden)이 아래 카드와 CAIO
// 질문을 잘라냈다. mock 서버의 짧은 문장으로는 재현되지 않으므로 라운드 응답을
// 가로채 최대 길이로 채우고, 페이지 스크롤과 오른쪽 열 내부 잘림이 모두 없는지 본다.
const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
const LONG_STATEMENT =
  '출처와 기준일을 표시하고 담당자가 확인한 뒤에만 공유해야 합니다. 권한이 확인되지 않은 부서 자료는 파일럿 범위에서 제외하고 준비시간과 수정량을 매주 기록해 확대 여부를 다음 이사회에서 판단하겠습니다.';

const LONG_REASON =
  '출처·기준일 표시와 담당자 검토, 권한 확인이 조건으로 들어갔으므로 찬성합니다. 다만 파일럿 기간의 준비시간과 수정량 기록이 실제로 쌓이는지, 확대 판단 전에 이사회가 그 수치를 직접 확인하는지가 남은 관건입니다. 그 절차가 빠지면 재검토가 필요합니다.';
const LONG_CONCERNS = ['권한 확인 절차의 실제 운영 주체', '검토 담당자 부재 시 대체 절차', '파일럿 성과 측정 기준의 합의'];

async function mockLongStatements(page: Page): Promise<void> {
  // 표결 응답도 최대 길이로 채운다: reason 160자 상한(server/validate.ts) + 남은 우려 3개.
  await page.route('**/api/board/vote', async (route: Route) => {
    const body = route.request().postDataJSON() as { motion: { id: string; hash: string } };
    const json = EXEC_ROLE_IDS.map((roleId) => ({
      roleId,
      status: 'answered',
      ballot: {
        motionId: body.motion.id,
        motionHash: body.motion.hash,
        vote: 'YES',
        reason: LONG_REASON.slice(0, 160),
        evidenceIds: ['E1', 'E2'],
        remainingConcerns: LONG_CONCERNS,
      },
      modelId: 'mock',
      promptVersion: 'mock',
    }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.route('**/api/board/round', async (route: Route) => {
    const json = EXEC_ROLE_IDS.map((roleId, index) => ({
      roleId,
      status: 'answered',
      statement: {
        roleId,
        message: LONG_STATEMENT.slice(0, 120),
        evidenceIds: ['E1', 'E2', 'E3', 'E4'],
        referencedStatementIds: index === 0 ? [] : [`ref-${index}`],
        concerns: [],
        suggestedConditionIds: [],
      },
      latencyMs: 10,
      modelId: 'mock',
      promptVersion: 'mock',
    }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

async function expectNoClip(page: Page, selector: string, label: string) {
  const box = await page.locator(selector).first().evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(
    box.scrollHeight <= box.clientHeight + 1,
    `${label}: ${selector} scrollHeight(${box.scrollHeight}) <= clientHeight(${box.clientHeight}) + 1`,
  ).toBe(true);
}

test('live 모드에서 임원 4명이 120자 발언을 해도 REACTIONS·VOTE가 잘리지 않고 스크롤도 없다', async ({ page }) => {
  await mockLongStatements(page);
  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE');

  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await expectNoPageScroll(page, 'OPINIONS(live)');
  await expectNoClip(page, '.app-body__content', 'OPINIONS(live)');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'OPINIONS(live)');

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  // 조건 4개(P1~P4, 시나리오 최대치)를 모두 골라 RESULT 요약의 "이사님이 붙인 조건"
  // 줄이 720에서 두 줄로 감기는 최악 조합을 만든다(PR #9 Codex 1차 검토).
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await page.getByTestId('submit-opinion').click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await expectNoPageScroll(page, 'REACTIONS(live)');
  await expectNoClip(page, '.app-body__content', 'REACTIONS(live)');
  // CAIO 후속 질문이 답글 카드 아래에서 잘리지 않고 보인다.
  await expect(page.getByTestId('followup-question')).toBeInViewport();

  await page.getByTestId('followup-option-2').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'VOTE(live)');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'VOTE(live)');
  // VOTE에서는 무대(aria-hidden)에 말풍선이 없다 — 대기 상태는 본문이 전담한다.
  await expect(page.locator('[data-testid^="stage-bubble-"]')).toHaveCount(0);

  // RESULT: 임원 4명 모두 160자 판단 근거 + 남은 우려 3개를 달아도 5석 카드·기록
  // 패널·체험 종료 CTA가 잘리지 않는다(PR #6 Codex 2차 검토).
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid^="result-seat-reason-"]')).toHaveCount(4);
  await expectNoPageScroll(page, 'RESULT(live)');
  await expectNoClip(page, '.app-body__content', 'RESULT(live)');
  await expect(page.getByTestId('end-session')).toBeInViewport();
  await expect(page.getByTestId('result-summary')).toBeInViewport();
  await expect(page.getByTestId('result-ai-help')).toBeInViewport();
  // 요약 패널은 overflow:hidden이라 바깥 컨테이너 검사만으로는 안쪽 잘림을 못 잡는다.
  // 조건 4개(두 줄) + 160자 판단 근거 4행 + 내 행 + 원문이 패널 자체 높이 안에 있고,
  // 마지막 블록(내 의견 원문)이 실제로 보이는지 단언한다(PR #9 Codex 1차 검토).
  await expectNoClip(page, '[data-testid="result-summary"]', 'RESULT(live, 조건 4개)');
  await expect(page.getByTestId('result-mine')).toBeInViewport();
  await expect(page.getByTestId('result-summary-row-PARTICIPANT')).toBeInViewport();
});
