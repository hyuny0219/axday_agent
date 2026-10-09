// 무스크롤 검수(DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙", T45). 게임
// 화면처럼 ATTRACT~RESULT 모든 단계에서 document.scrollingElement이 스크롤되지
// 않아야 한다 — 넘치는 내용은 지정된 패널 하나만 안에서 스크롤한다. playwright.config.ts의
// 두 프로젝트(desktop-1080·desktop-720)가 각각 1920×1080·1280×720 뷰포트를 이미
// 고정하므로 이 스펙은 뷰포트를 직접 지정하지 않고 두 프로젝트 모두에서 그대로 돈다.
// DISCUSS는 추천 문구 4개(조건 4개, 실제 시나리오 최대치)를 선택하고 비서실장 드로어까지
// 열어 가장 내용이 많은 상태에서 단언한다(card "비서실장 드로어 열린 상태 포함").

import { test, expect, type Page, type Route } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

/**
 * 문서 스크롤이 없어도 패널 안에서 내용이 잘릴 수 있다(T56: 회의록 최신 항목이 아래로
 * 넘쳐 잘리고, 오른쪽 열 제목이 flex-shrink로 줄어 글자가 잘렸다). 그래서 스크롤
 * 여부와 별개로 "이 요소가 잘리지 않고 다 보이는가"를 함께 단언한다.
 */
async function expectFullyVisible(page: Page, testId: string, label: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${label}: ${testId} 요소를 찾지 못했다`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, `${label}: viewport 크기를 알 수 없다`).not.toBeNull();
  if (!box || !viewport) {
    return;
  }
  expect(
    box.y >= -1 && box.y + box.height <= viewport.height + 1,
    `${label}: ${testId}가 뷰포트를 벗어났다(top=${box.y}, bottom=${box.y + box.height}, viewport=${viewport.height})`,
  ).toBe(true);
  // 패널 자체가 안에서 잘리는 경우(자식이 넘침)도 잡는다.
  // T111: 버튼(.cta)은 바깥으로 나온 꺾쇠(::before, 장식)가 scrollHeight를 늘리므로 제외한다.
  const clipped = await page
    .getByTestId(testId)
    .evaluate((el) => (el.classList.contains('cta') ? 0 : el.scrollHeight - el.clientHeight));
  expect(clipped <= 1, `${label}: ${testId} 내부 내용이 ${clipped}px 넘쳐 잘린다`).toBe(true);
}

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
  await page.goto('/?mode=scripted&coach=off');
  await expectNoPageScroll(page, 'ATTRACT');

  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expectNoPageScroll(page, 'SELECT');
  // 사건 헤드라인(T47): 카드 안에서 잘리지 않고 보인다.
  await expect(
    page.getByTestId('scenario-card-ai-approval').locator('.scenario-card__title'),
  ).toBeInViewport();

  await page.getByTestId('scenario-card-ai-approval').click();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expectNoPageScroll(page, 'BRIEFING');
  // 사건 표기 eyebrow(T47): 안건 제목 위 한 줄이 잘리지 않고 보인다.
  await expect(page.getByTestId('briefing-incident')).toBeInViewport();
  // T102: BRIEFING에는 발언 흐름 패널이 없다(패널이 있는 화면은 MOTION·VOTE뿐).
  await expect(page.getByTestId('minutes-panel')).toHaveCount(0);
  // T68: 자료 4장은 더 이상 상시 노출되지 않는다 — "근거 자료 보기" 버튼만 있고, 남는
  // 세로 여유로 오른쪽 열의 나머지 카드(현재 상황·제안·미정·할 일)가 잘리지 않는다.
  await expect(page.getByTestId('open-evidence')).toBeVisible();
  await expectNoPageScroll(page, 'BRIEFING(자료 버튼)');
  await expectNoClip(page, '.app-body__content', 'BRIEFING(자료 버튼)');

  // 팝업을 열어도 페이지 스크롤은 생기지 않는다(팝업은 position:fixed 오버레이,
  // 내부 스크롤은 팝업 카드 안에서만 허용된다 — DESIGN_SPEC.md v1.2 BRIEFING 절).
  await page.getByTestId('open-evidence').click();
  const evidenceDialog = page.getByTestId('evidence-dialog');
  await expect(evidenceDialog).toBeVisible();
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await expect(evidenceDialog.getByTestId(`evidence-card-${id}`)).toBeVisible();
  }
  await expectNoPageScroll(page, 'BRIEFING(자료 팝업 열림)');
  const dialogBox = await evidenceDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox, 'BRIEFING(자료 팝업 열림): 팝업 위치를 읽을 수 있어야 한다').not.toBeNull();
  expect(viewport, 'BRIEFING(자료 팝업 열림): viewport 크기를 알 수 없다').not.toBeNull();
  if (dialogBox && viewport) {
    expect(
      dialogBox.y >= -1 && dialogBox.y + dialogBox.height <= viewport.height + 1,
      `BRIEFING(자료 팝업 열림): 팝업이 뷰포트를 벗어났다(top=${dialogBox.y}, bottom=${dialogBox.y + dialogBox.height}, viewport=${viewport.height})`,
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(evidenceDialog).toHaveCount(0);

  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.getByRole('heading', { name: '임원 의견 듣기' })).toBeVisible();
  await expectNoPageScroll(page, 'OPINIONS');
  // T102: 임원 의견 전문은 오른쪽 종이에서만 읽는다 — 발언 흐름 패널은 없고 안내 한 줄이 있다.
  await expect(page.getByTestId('minutes-panel')).toHaveCount(0);
  await expectFullyVisible(page, 'opinions-read-hint', 'OPINIONS');

  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  // 추천 문구 4개(조건 4개, 시나리오 최대치)를 선택해 가장 내용이 많은 상태를 만든다.
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await expectNoPageScroll(page, 'DISCUSS(조건 4개 선택)');
  // T69: 자료 4장은 더 이상 상시 노출되지 않는다 — "근거 자료 보기" 버튼만 있다
  // (BRIEFING과 같은 동작). 팝업은 position:fixed 전체 화면 오버레이라 비서실장
  // 드로어(오른쪽 열 위에 겹치는 절대 위치 드로어, z-index 6)보다 위(evidence-dialog
  // z-index 40)에 뜬다 — 드로어가 열려 오른쪽 열을 덮은 동안은 이 버튼도 함께 덮이므로
  // (오른쪽 열의 다른 카드와 같은 규칙) 드로어를 닫은 이 시점에 먼저 확인한다.
  const discussOpenEvidence = page.getByTestId('open-evidence');
  await expect(discussOpenEvidence).toBeVisible();
  await expectNoClip(page, '.app-body__content', 'DISCUSS(조건 4개 선택)');

  await discussOpenEvidence.click();
  const discussEvidenceDialog = page.getByTestId('evidence-dialog');
  await expect(discussEvidenceDialog).toBeVisible();
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await expect(discussEvidenceDialog.getByTestId(`evidence-card-${id}`)).toBeVisible();
  }
  await expectNoPageScroll(page, 'DISCUSS(자료 팝업 열림)');
  await page.keyboard.press('Escape');
  await expect(discussEvidenceDialog).toHaveCount(0);
  await expect(discussOpenEvidence).toBeFocused();

  // 비서실장 드로어를 연 상태도 스크롤이 없어야 한다(오른쪽 열 위에 겹치는 드로어).
  // 문구를 고르기 전에는 비서실장 버튼이 잠겨 있으므로 먼저 추천 문구를 하나 고른다.
  await page.locator('[data-testid^="phrase-card-"]').first().click();
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'DISCUSS(비서실장 팝업 열림)');
  // T89: 드로어 대신 팝업(DialogShell)이 된 뒤로는 팝업 자체의 닫기 버튼으로 닫는다.
  await page.getByTestId('assistant-close').click();

  // 2026-10-08 팀리드 지시: 설득 현황판(T96)이 더해지며 왼쪽 열이 세로로 넘쳐 하단
  // CTA가 뷰포트 밖으로 밀렸는데도 문서 스크롤 자체는 없어(.app-body__actions가
  // overflow:visible이라 안쪽 scrollHeight 검사로는 못 잡는다) expectNoPageScroll이
  // 못 잡았다 — CTA 자체가 뷰포트 안에 보이는지 직접 단언한다.
  await expectFullyVisible(page, 'submit-opinion', 'DISCUSS(CTA)');
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS(반응 듣기)');

  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  await expectNoPageScroll(page, 'REACTIONS(다시 답하기)');

  // 직접 입력(가장 내용이 많은 경로)으로 조건 칩까지 노출한 상태도 확인한다.
  await page.getByTestId('followup-textarea').fill('잘못된 승인이 나오면 책임자가 확인할 수 있게 절차를 정합니다.');
  await expectNoPageScroll(page, 'REACTIONS(직접 입력 + 조건 칩)');

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS(비서실장 팝업 열림)');
  await page.getByTestId('assistant-close').click();

  // T96: DISCUSS와 같은 이유로 REACTIONS(다시 답하기)도 CTA가 뷰포트 안에 보이는지
  // 직접 확인한다.
  await expectFullyVisible(page, 'submit-followup', 'REACTIONS(다시 답하기 CTA)');
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'MOTION');
  await expectFullyVisible(page, 'minutes-panel', 'MOTION');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'MOTION');
  // T96: MOTION 왼쪽 열도 같은 공용 설득 현황판을 쓰므로 함께 확인한다.
  await expectFullyVisible(page, 'freeze-motion', 'MOTION(CTA)');

  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'VOTE');
  await expectFullyVisible(page, 'minutes-panel', 'VOTE');
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await expectNoClip(page, '.app-body__minutes', 'VOTE');
  // T96: VOTE도 함께 확인한다 — 찬성 라디오가 왼쪽 열(BALLOTS) 바로 아래 오른쪽
  // 종이가 아니라 오른쪽 열 안에 있어 왼쪽 열 넘침과는 무관하지만, 왼쪽 열 자체
  // (PersuasionBoard + BALLOTS)가 뷰포트를 넘지 않는지는 vote-ballots로 확인한다.
  await expectFullyVisible(page, 'vote-ballots', 'VOTE(왼쪽 열)');

  // VOTE의 "발언 흐름" 항목 수를 기억해 둔다 — RESULT의 회의록 전문(T58 흡수)이
  // 같은 buildMinutes 계산을 쓰므로 항목 수가 같아야 한다(카드 완료 확인).
  const minutesCountAtVote = await page.locator('[data-testid^="minutes-entry-"]').count();

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

  // "회의록 전문 보기"(T58 흡수, T64 item 7): 토글로 전문 패널이 열리고, 항목 수가
  // 위 VOTE의 "발언 흐름"과 같으며, 페이지 스크롤 없이 다시 요약으로 돌아온다.
  const transcriptToggle = page.getByTestId('result-transcript-toggle');
  await expect(transcriptToggle).toHaveAttribute('aria-pressed', 'false');
  await transcriptToggle.click();
  await expect(transcriptToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('result-transcript')).toBeVisible();
  await expect(page.getByTestId('result-summary')).toHaveCount(0);
  await expect(page.locator('[data-testid^="minutes-entry-"]')).toHaveCount(minutesCountAtVote);
  await expectNoPageScroll(page, 'RESULT(회의록 전문)');

  await transcriptToggle.click();
  await expect(transcriptToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('result-summary')).toBeVisible();
  await expect(page.getByTestId('result-transcript')).toHaveCount(0);
  await expectNoPageScroll(page, 'RESULT(요약으로 복귀)');
});

// live 모드 최악 경로(PR #6 Codex 검토): 임원 4명 모두 120자 발언 + 근거 칩 + 인용을
// 돌려주면 답글 카드가 세로로 쌓여 오른쪽 열(overflow:hidden)이 아래 카드와 CAIO
// 질문을 잘라냈다. mock 서버의 짧은 문장으로는 재현되지 않으므로 라운드 응답을
// 가로채 최대 길이로 채우고, 페이지 스크롤과 오른쪽 열 내부 잘림이 모두 없는지 본다.
const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
const LONG_STATEMENT =
  '금액 한도를 정한 뒤에만 자동 승인해야 합니다. 승인 사유는 매번 기록하게 하고, 표본 재검토 결과와 오승인 건수를 매주 기록해 확대 여부를 다음 이사회에서 판단하겠습니다. 책임자도 함께 지정해 주십시오.';

const LONG_REASON =
  '금액 한도·승인 사유 기록·표본 재검토가 조건으로 들어갔으므로 찬성합니다. 다만 시범 기간의 처리 건수와 오승인 기록이 실제로 쌓이는지, 확대 판단 전에 이사회가 그 수치를 직접 확인하는지가 남은 관건입니다. 그 절차가 빠지면 재검토가 필요합니다.';
const LONG_CONCERNS = ['책임자 지정 절차의 실제 운영 주체', '검토 담당자 부재 시 대체 절차', '시범 성과 측정 기준의 합의'];

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
        stance: 'FOR',
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
  await page.goto('/?coach=off');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await expectNoPageScroll(page, 'OPINIONS(live)');
  await expectNoClip(page, '.app-body__content', 'OPINIONS(live)');
  await expect(page.getByTestId('minutes-panel')).toHaveCount(0);
  await expectFullyVisible(page, 'opinions-read-hint', 'OPINIONS(live)');

  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await expectNoPageScroll(page, 'DISCUSS(live, 120자 발언)');
  await expectNoClip(page, '.app-body__content', 'DISCUSS(live, 120자 발언)');
  // 근거 자료 팝업은 자료 4장만 보인다(T105: 임원 발언 열을 없앴다). 120자 발언이
  // 있어도 팝업 안에 발언이 새지 않고 페이지 스크롤도 없어야 한다.
  const discussOpenEvidence = page.getByTestId('open-evidence');
  await discussOpenEvidence.click();
  await expect(page.getByTestId('evidence-card-E1')).toBeVisible();
  await expect(page.getByTestId('evidence-dialog').locator('[data-testid^="statement-card-"]')).toHaveCount(0);
  await expectNoPageScroll(page, 'DISCUSS(live, 120자 발언, 팝업 열림)');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('evidence-dialog')).toHaveCount(0);
  // 조건 4개(P1~P4, 시나리오 최대치)를 모두 골라 RESULT 요약의 "이사님이 붙인 조건"
  // 줄이 720에서 두 줄로 감기는 최악 조합을 만든다(PR #9 Codex 1차 검토).
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await expectNoPageScroll(page, 'REACTIONS(live)');
  await expectNoClip(page, '.app-body__content', 'REACTIONS(live)');
  // CAIO 후속 질문이 답글 카드 아래에서 잘리지 않고 보인다.
  await expect(page.getByTestId('followup-question')).toBeInViewport();

  await page.getByTestId('keep-previous-answer').click();
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
  // 참가자 행 testid는 T66에서 result-seat-PARTICIPANT로 통일했다(5석 카드가
  // 빠지며 VERDICTS 행이 그 자리를 겸한다).
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeInViewport();
});

// T116: 조건 칩이 붙고 답변이 길어져도 입력 상자는 고정이고 아래 버튼 줄(제출 줄)이 밀리지
// 않는다. 시나리오 조건은 최대 5개라(칩 6개는 만들 수 없다) 다섯 개를 모두 붙이고, 서로 충돌하는
// 두 조건(충돌 안내 줄 포함)과 600자 입력(300자 초과 오류 줄 포함)을 함께 건다.
const ALL_CONDITIONS_TEXT =
  '금액 한도를 정합니다. 승인 사유를 기록합니다. 일부를 다시 보도록 합니다. 책임자를 지정합니다. 전부 자동 승인도 합니다. ';

function longDraft(): string {
  return ALL_CONDITIONS_TEXT.repeat(10).slice(0, 600);
}

async function expectSubmitRowFixed(
  page: Page,
  label: string,
  textareaId: string,
  submitIds: string[],
  fill: (text: string) => Promise<void>,
) {
  const readYs = async () => {
    const ys: number[] = [];
    for (const id of submitIds) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${label}: ${id} 요소를 찾지 못했다`).not.toBeNull();
      ys.push(Math.round(box?.y ?? -1));
    }
    return ys;
  };
  const textareaHeight = async () =>
    Math.round((await page.getByTestId(textareaId).boundingBox())?.height ?? -1);

  const emptyYs = await readYs();
  const emptyHeight = await textareaHeight();
  await fill(longDraft());
  await expect(page.getByTestId('condition-chips')).toBeVisible();
  await expect(page.locator('[data-testid^="condition-chip-"]')).toHaveCount(5);
  await expectNoPageScroll(page, `${label}(칩 5개 + 600자)`);
  expect(await readYs(), `${label}: 제출 줄 y가 빈 상태와 같아야 한다`).toEqual(emptyYs);
  // 충돌하는 두 조건(검토·전부 자동)을 모두 확정하면 충돌 안내가 뜬다 — 안내가 잘리지 않고
  // 읽히며(칸 안에 다 들어온다) 제출 줄도 움직이지 않는다.
  for (const id of ['REVIEW', 'FULL_AUTO']) {
    const chip = page.getByTestId(`condition-chip-${id}`);
    if ((await chip.getAttribute('aria-pressed')) !== 'true') {
      await chip.click();
    }
  }
  const conflicts = page.getByTestId('condition-chips-conflicts');
  await expect(conflicts).toBeVisible();
  const conflictFit = await conflicts.evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  expect(conflictFit.clientHeight, `${label}: 충돌 안내가 최소 한 줄 높이를 가져야 한다`).toBeGreaterThanOrEqual(15);
  expect(conflictFit.scrollHeight, `${label}: 충돌 안내가 잘리지 않아야 한다`).toBeLessThanOrEqual(
    conflictFit.clientHeight + 1,
  );
  expect(await readYs(), `${label}: 충돌 안내가 떠도 제출 줄 y가 같아야 한다`).toEqual(emptyYs);
  expect(await textareaHeight(), `${label}: 입력 상자 높이가 고정이어야 한다`).toBe(emptyHeight);
  // 600자는 입력 상자 안에서 스크롤된다(상자가 늘어나지 않는다).
  const scrolls = await page
    .getByTestId(textareaId)
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls, `${label}: 긴 글은 입력 상자 안쪽에서 스크롤돼야 한다`).toBe(true);
  await expectFullyVisible(page, submitIds[submitIds.length - 1], `${label}(제출 버튼)`);
}

test('내 의견·내 답변 HUD: 조건 칩 5개와 600자 입력에도 제출 줄 위치와 입력 상자 높이가 변하지 않는다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();

  const draft = page.getByTestId('draft-editor-textarea');
  await expectSubmitRowFixed(
    page,
    'DISCUSS',
    'draft-editor-textarea',
    ['assistant-toggle', 'submit-opinion'],
    (text) => draft.fill(text),
  );

  await draft.fill('');
  await page.getByTestId('phrase-card-P1').click();
  // 직접 쓴 글이 있었으므로 문구로 다시 구성할지 묻는다.
  await page.getByRole('button', { name: '선택 문구로 다시 구성' }).click();
  await page.getByTestId('phrase-card-P2').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('reactions-advance').click();

  const followup = page.getByTestId('followup-textarea');
  await expectSubmitRowFixed(
    page,
    'REACTIONS(다시 답하기)',
    'followup-textarea',
    ['assistant-toggle', 'keep-previous-answer', 'submit-followup'],
    (text) => followup.fill(text),
  );
});

// T117: 사용자가 "반응에 답하기에서 버튼이 여전히 잘린다"고 보고했다(뷰포트 미확정). 화면 맞춤
// 축소는 1200×700 이상이면 'natural'이라 켜지지 않으므로, 1366×768·1440×900·1536×864처럼
// 1080/720 사이 크기는 1080용 치수 그대로 세로가 모자랐다. 여섯 크기 모두에서 조건 5개 + 300자 +
// 충돌 안내 상태의 제출 줄이 캔버스(축소 모드면 축소된 wrapper) 안에 들어오고, 조건 칩은 한 줄
// (모든 칩의 top이 같고 칩 줄 높이가 칩 두 줄 미만)이며 충돌 안내가 말줄임 없이 읽혀야 한다.
const HUD_VIEWPORTS: Array<[number, number]> = [
  [1920, 1080],
  [1680, 1050],
  [1536, 864],
  [1440, 900],
  [1366, 768],
  [1600, 900],
  [1280, 720],
];

async function expectHudFits(
  page: Page,
  label: string,
  textareaId: string,
  submitIds: string[],
  [width, height]: [number, number],
) {
  {
    await page.setViewportSize({ width, height });
    const where = `${label} ${width}×${height}`;
    // 리사이즈 직후 레이아웃·맞춤 배율이 반영될 때까지 기다린다(시간 의존 아님: 제출 줄이 안정될 때까지 폴링).
    await expect
      .poll(async () => {
        const data = await page.evaluate((ids) => {
          const wrapper = document.querySelector('.app-scale-wrapper');
          const canvasBottom = wrapper ? wrapper.getBoundingClientRect().bottom : innerHeight;
          const limit = Math.min(canvasBottom, innerHeight);
          return ids.map((id) => {
            const el = document.querySelector(`[data-testid="${id}"]`);
            return el ? el.getBoundingClientRect().bottom - limit : Number.POSITIVE_INFINITY;
          });
        }, submitIds);
        return Math.max(...data) <= 1;
      }, { message: `${where}: 제출 줄이 캔버스(뷰포트) 안에 들어와야 한다` })
      .toBe(true);
    const hud = await page.evaluate(
      ({ ids, textarea }) => {
        const chips = document.querySelector('[data-testid="condition-chips"]');
        const list = chips?.querySelector('.condition-chips__list');
        const chipEls = [...(chips?.querySelectorAll('.condition-chip') ?? [])];
        const tops = chipEls.map((chip) => Math.round(chip.getBoundingClientRect().top));
        const conflicts = document.querySelector('[data-testid="condition-chips-conflicts"]');
        const area = document.querySelector(`[data-testid="${textarea}"]`);
        return {
          more: document.querySelector('[data-testid="condition-chips-more"]')?.textContent ?? null,
          listMore: list?.getAttribute('data-more') ?? null,
          listScrollWidth: list?.scrollWidth ?? 0,
          listClientWidth: list?.clientWidth ?? 0,
          chipCount: chipEls.length,
          chipHeight: chipEls[0]?.getBoundingClientRect().height ?? 0,
          sameRow: new Set(tops).size === 1,
          listHeight: list?.getBoundingClientRect().height ?? 0,
          conflictTruncated: conflicts ? conflicts.scrollWidth > conflicts.clientWidth + 1 : true,
          textareaHeight: area?.getBoundingClientRect().height ?? 0,
          geometry: (() => {
            const hudEl = area?.closest('.discuss-screen__hud, .reactions-screen__hud');
            const editor = area?.closest('.draft-editor');
            const head = editor?.querySelector('.draft-editor__head');
            const slot = hudEl?.querySelector('.hud-conditions-slot');
            if (!area || !hudEl || !editor || !head || !slot) {
              return null;
            }
            const r = (el: Element) => el.getBoundingClientRect();
            const submitTops = ids.map((id) => {
              const el = document.querySelector(`[data-testid="${id}"]`);
              return el ? r(el).top : Number.NEGATIVE_INFINITY;
            });
            return {
              textareaBottom: r(area).bottom,
              textareaTop: r(area).top,
              headBottom: r(head).bottom,
              editorHeight: r(editor).height,
              headHeight: r(head).height,
              slotTop: r(slot).top,
              slotBottom: r(slot).bottom,
              hudTop: r(hudEl).top,
              hudBottom: r(hudEl).bottom,
              chipTop: chipEls[0] ? r(chipEls[0]).top : 0,
              chipBottom: chipEls[0] ? r(chipEls[0]).bottom : 0,
              minSubmitTop: Math.min(...submitTops),
            };
          })(),
          submitCount: ids.filter((id) => document.querySelector(`[data-testid="${id}"]`)).length,
        };
      },
      { ids: submitIds, textarea: textareaId },
    );
    expect(hud.chipCount, `${where}: 조건 칩 5개`).toBe(5);
    // 가려진 칩 표시("+N")와 페이드는 칩 줄이 실제로 넘칠 때만 켜진다(칩이 전부 보이면 둘 다 없음,
    // 넘치면 +N과 페이드가 있음). 칩 줄 안의 위치가 아니라 화면 좌표로 센 값이어야 한다.
    if (hud.listScrollWidth <= hud.listClientWidth + 1) {
      expect(hud.more, `${where}: 칩이 전부 보이는데 +N이 떠 있다`).toBe('');
      expect(hud.listMore, `${where}: 칩이 전부 보이는데 페이드가 켜져 있다`).toBe('false');
    } else {
      expect(hud.more, `${where}: 칩이 넘치는데 +N이 없다`).toMatch(/^\+[1-5]$/);
      expect(hud.listMore, `${where}: 칩이 넘치는데 페이드가 없다`).toBe('true');
    }
    if (width === 1920 && label === 'DISCUSS') {
      // 1920 DISCUSS는 칩 5개가 전부 보인다(회귀 방지: 목록 왼쪽 오프셋이 +N을 부풀렸었다).
      expect(hud.listScrollWidth, `${where}: 칩이 전부 보여야 한다`).toBeLessThanOrEqual(hud.listClientWidth + 1);
    }
    expect(hud.sameRow, `${where}: 조건 칩이 한 줄에 있어야 한다`).toBe(true);
    expect(hud.listHeight, `${where}: 칩 컨테이너 높이가 칩 한 줄(두 줄 미만)`).toBeLessThan(hud.chipHeight * 2);
    expect(hud.conflictTruncated, `${where}: 충돌 안내가 말줄임 없이 읽혀야 한다`).toBe(false);
    expect(hud.textareaHeight, `${where}: 입력 상자 최소 44px`).toBeGreaterThanOrEqual(43);
    expect(hud.submitCount, `${where}: 제출 줄 버튼`).toBe(submitIds.length);
    // T117 검토: 입력 상자가 조건 칩 줄 위로 겹치거나 HUD 박스 밖으로 나가지 않아야 한다.
    const g = hud.geometry;
    expect(g, `${where}: HUD 구조를 찾지 못했다`).not.toBeNull();
    if (g) {
      expect(g.textareaBottom, `${where}: 입력 상자 아래 끝이 조건 칸 위 끝 이하`).toBeLessThanOrEqual(g.slotTop + 1);
      expect(g.textareaTop, `${where}: 입력 상자가 머리줄 아래에서 시작`).toBeGreaterThanOrEqual(g.headBottom - 1);
      expect(g.editorHeight, `${where}: 편집기 높이 ≥ 머리줄 + 입력 상자`).toBeGreaterThanOrEqual(
        g.headHeight + hud.textareaHeight - 1,
      );
      expect(g.slotBottom, `${where}: 조건 칸이 HUD 박스 안`).toBeLessThanOrEqual(g.hudBottom + 1);
      expect(g.chipTop, `${where}: 칩이 조건 칸 안`).toBeGreaterThanOrEqual(g.slotTop - 1);
      expect(g.chipBottom, `${where}: 칩이 조건 칸 안`).toBeLessThanOrEqual(g.slotBottom + 1);
      expect(g.minSubmitTop, `${where}: 제출 줄이 HUD 박스 아래`).toBeGreaterThanOrEqual(g.hudBottom - 1);
    }
    await expectNoPageScroll(page, where);
  }
}

// 글을 쓴 직후에는 "새로 제안된 조건 자동 확정" 효과가 한 번 더 돌아 곧바로 누른 칩의 선택을
// 되돌리는 경합이 있다(제품 쪽 별도 사안) — 충돌 안내가 보일 때까지 눌러 보는 재시도로 우회한다.
async function makeFiveConditionsWithConflict(page: Page, fill: (text: string) => Promise<void>) {
  await fill(longDraft().slice(0, 300));
  await expect(page.locator('[data-testid^="condition-chip-"]')).toHaveCount(5);
  // 글을 쓴 직후에는 자동 확정 효과가 한 번 더 돌 수 있어 충돌이 보일 때까지 눌러 본다.
  await expect(async () => {
    for (const id of ['REVIEW', 'FULL_AUTO']) {
      const chip = page.getByTestId(`condition-chip-${id}`);
      if ((await chip.getAttribute('aria-pressed')) !== 'true') {
        await chip.click();
      }
    }
    await expect(page.getByTestId('condition-chips-conflicts')).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

test('내 의견·내 답변 HUD: 일곱 뷰포트에서 조건 5개 + 300자 + 충돌 안내에도 제출 줄이 잘리지 않고 조건 칩은 한 줄이다', async ({
  page,
}) => {
  // 크기마다 새로 연다: 설득 현황판 기본 펼침/접힘(높이 ≤800은 접힘)과 무대 열 폭은 첫 렌더 크기로
  // 정해지므로, 1920에서 연 뒤 크기만 바꾸면 낮은 화면의 시작 상태를 못 본다.
  test.setTimeout(300_000);
  for (const viewport of HUD_VIEWPORTS) {
    await page.setViewportSize({ width: viewport[0], height: viewport[1] });
    await runHudCheck(page, viewport);
  }
});

async function runHudCheck(page: Page, viewport: [number, number]) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();

  const draft = page.getByTestId('draft-editor-textarea');
  await makeFiveConditionsWithConflict(page, (text) => draft.fill(text));
  await expectHudFits(page, 'DISCUSS', 'draft-editor-textarea', ['assistant-toggle', 'submit-opinion'], viewport);

  await draft.fill('');
  await page.getByTestId('phrase-card-P1').click();
  await page.getByRole('button', { name: '선택 문구로 다시 구성' }).click();
  await page.getByTestId('phrase-card-P2').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('reactions-advance').click();

  const followup = page.getByTestId('followup-textarea');
  await makeFiveConditionsWithConflict(page, (text) => followup.fill(text));
  await expectHudFits(
    page,
    'REACTIONS(다시 답하기)',
    'followup-textarea',
    ['assistant-toggle', 'keep-previous-answer', 'submit-followup'],
    viewport,
  );
}
