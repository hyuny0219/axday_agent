import { test, expect, type Page } from './fixtures';

/**
 * REACTIONS 후속 입력에서 이전에 확정한 조건과 새 제안이 충돌할 때 UI가 전달을
 * 막는지 확인한다(T25 만들 것 2: 누적 조건 충돌 재검사).
 */
async function reachReactionsWithAccessConfirmed(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // P3 = TRACE(문제 발생 시 추적 가능)를 확정한 채 첫 의견을 전달한다.
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
}

test('DISCUSS에서 TRACE 확정 후 REACTIONS에서 ANON_FULL을 함께 확정하려 하면 전달이 막힌다', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);

  await page.getByTestId('followup-open-editor').click();
  const textarea = page.getByTestId('followup-textarea');
  // P5 문장 그대로: ANON_FULL을 새로 제안한다. TRACE는 이전 의견에서 이미 확정돼
  // 목록에 남아 있으므로 두 조건이 함께 accepted 상태가 된다.
  await textarea.fill('작성자를 누구도 추적할 수 없는 완전 익명으로 합시다.');

  const conflicts = page.getByTestId('condition-chips-conflicts');
  await expect(conflicts).toBeVisible();
  await expect(conflicts).toContainText(
    "'문제 발생 시 추적 가능'와 '완전 익명 — 추적 불가' 중 하나만 선택해 주세요.",
  );

  await expect(page.getByTestId('submit-followup')).toBeDisabled();

  // ANON_FULL 칩을 해제하면 충돌이 사라지고 다시 전달할 수 있다.
  await page.getByTestId('condition-chip-ANON_FULL').click();
  await expect(conflicts).toBeHidden();
  await expect(page.getByTestId('submit-followup')).toBeEnabled();

  // 직접 답하기를 다시 닫아도 입력이 남아 있으면 조건 칩은 계속 보인다(PR #4 Codex
  // 2차 검토: 제출이 가능한 동안 조건 확인 UI가 사라지면 안 된다).
  await page.getByTestId('followup-open-editor').click();
  await expect(textarea).toBeHidden();
  await expect(page.getByTestId('condition-chip-TRACE')).toBeVisible();
  await expect(page.getByTestId('submit-followup')).toBeEnabled();
});

test('후속 질문에서 이전 조건을 그대로 유지하면 최종 안건에도 함께 남는다', async ({ page }) => {
  await reachReactionsWithAccessConfirmed(page);

  // SCREEN를 새로 제안하는 선택지를 고른다. TRACE는 DISCUSS에서 이미 확정돼
  // 기본값으로 유지된 채 넘어온다(칩을 건드리지 않는다).
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-TRACE')).toHaveAttribute('aria-pressed', 'true');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).toContainText('문제 발생 시 추적 가능');
  await expect(conditions).toContainText('게시 전 검수');
});

test('후속 질문에서 이전에 확정한 조건 칩을 해제하면 최종 안건에서 빠진다', async ({ page }) => {
  await reachReactionsWithAccessConfirmed(page);

  // DISCUSS에서 확정한 TRACE가 후속 질문 칩으로 다시 보인다. 여기서 해제하면
  // 최종 안건의 누적 목록에서도 빠져야 한다(후속 보완은 누적 조건을 유지·해제한다).
  // 새로 제안된 SCREEN는 그대로 두어 최종 안건에 남는다.
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-TRACE')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('condition-chip-TRACE').click();
  await expect(page.getByTestId('condition-chip-TRACE')).toHaveAttribute('aria-pressed', 'false');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).not.toContainText('문제 발생 시 추적 가능');
  await expect(conditions).toContainText('게시 전 검수');
});

// 후속 직접 답변 "작성자를 확인하지 않겠습니다."가 TRACE 키워드 '작성자를 확인'에 걸려
// 새 제안으로 자동 승인되고, 참가자가 추적을 거부했는데도 최종안에 "문제 발생 시 추적
// 가능"이 들어가 표결까지 바뀌었다(PR #10 Codex 12차 검토 P1).
test('후속 직접 답변에서 "-지 않-"으로 거부한 조건은 제안되지 않고 최종 안건에도 들어가지 않는다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  // P1 = PILOT만 확정한 채 첫 의견을 전달한다(TRACE는 아직 없다).
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('submit-opinion').click();

  await page.getByTestId('followup-open-editor').click();
  await page.getByTestId('followup-textarea').fill('작성자를 확인하지 않겠습니다.');
  await expect(page.getByTestId('condition-chip-PILOT')).toBeVisible();
  await expect(page.getByTestId('condition-chip-TRACE')).toHaveCount(0);

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).toContainText('한 게시판에서 시범');
  await expect(conditions).not.toContainText('문제 발생 시 추적 가능');
});

test('직접 답하기를 열기 전에는 textarea가 보이지 않고, 빠른 답만으로 MOTION까지 도달한다', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);

  // T40 만들 것 2: 직접 입력은 접어 두고, 빠른 답 3개만으로도 완주할 수 있다.
  await expect(page.getByTestId('followup-textarea')).toBeHidden();
  // 답을 시작하기 전에는 이전 의견의 조건(TRACE)을 바꿀 수 없다(PR #4 Codex 검토).
  await expect(page.getByTestId('condition-chip-TRACE')).toBeHidden();

  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-TRACE')).toBeVisible();
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
});

// T67 item7b(2026-09-30 실측, docs/screenshots/desktop-720/reactions.png): 당시
// max-height + overflow:hidden 수치 예산으로 2줄 클램프를 흉내 냈는데, 아래쪽
// 패딩만큼 다음 줄이 클립 경계 안으로 들어와 3번째 줄 일부가 그대로 보였다. PR #11
// Codex 28차 검토(P2)에서 그 예산(패딩·테두리 픽셀 계산)이 틀렸다는 지적을 받아
// 다시 실측해 보니, 이 예산 자체가 글꼴 힌팅에 따라 1px 안팎으로 흔들리는 아주 좁은
// 안전 구간이었다(테두리를 더하거나 빼는 어느 쪽으로도 자칫 2번째 줄이 잘리거나
// 3번째 줄 위쪽이 살짝 드러난다). 그래서 무대 말풍선(stage.css
// `.stage-band__bubble-text`)과 같은 방식인 `-webkit-line-clamp`로 바꿨다 — 줄 수를
// 브라우저가 직접 세어 자르므로 픽셀 예산 계산이 필요 없다. 여기서는 그 전환이
// 실제로 유효한지 두 가지로 확인한다: (1) 300자에 가까운 긴 발언이 실제로 2줄을
// 넘겨 클램프가 걸리는지(overflow), (2) 클램프된 상자의 콘텐츠 높이가 정확히 2줄
// line-height만큼인지(글꼴 힌팅 반올림 오차 1px만 허용) — 이 값이 2줄보다 작으면
// 2번째 줄이 잘린 것이고, 크면 3번째 줄이 새 방식에서도 비집고 들어온 것이다.
const LONG_OPINION_TEXT =
  '한 게시판에서 먼저 시범 운영합시다. 게시 전 검수 절차를 두고 시작합시다. ' +
  '문제가 생기면 작성자를 확인할 수 있게 해 둡시다. 운영 효과를 측정한 뒤 전사로 넓힙시다. ' +
  '시범 기간에는 게시 건수와 신고 처리 결과를 함께 공유해 신뢰를 쌓고, 확대 여부는 이 기록을 근거로 ' +
  '다음 이사회에서 다시 판단하겠습니다. 신고 처리 담당자를 먼저 지정하고, 로그 보관 기간을 정한 뒤 ' +
  '순차로 넓혀가며 결과를 투명하게 공유하겠습니다.';

test('내 발언 인용 상자는 2줄을 넘는 내용이 있어도 정확히 2줄 높이로만 클램프된다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('draft-editor-textarea').fill(LONG_OPINION_TEXT);
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();

  const quote = page.getByTestId('reactions-quote');
  // 실제로 2줄보다 많은 내용이 있어야 이 단언이 의미가 있다(클램프가 걸릴 내용인지 확인).
  const overflowing = await quote.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(overflowing, '테스트 문구가 2줄보다 짧아 클램프가 걸리지 않았다').toBe(true);

  const budget = await quote.evaluate((el) => {
    const cs = getComputedStyle(el);
    const paddingTop = parseFloat(cs.paddingTop);
    const paddingBottom = parseFloat(cs.paddingBottom);
    const lineHeight = parseFloat(cs.lineHeight);
    return { contentHeight: el.clientHeight - paddingTop - paddingBottom, twoLines: 2 * lineHeight };
  });
  // 글꼴 힌팅으로 줄 높이가 소수점 아래에서 반올림되는 여유(최대 1px)만 허용한다 —
  // 이 폭을 넘으면 2번째 줄이 잘렸거나(작은 쪽) 3번째 줄이 드러난 것이다(큰 쪽).
  expect(
    budget.contentHeight,
    `콘텐츠 높이(${budget.contentHeight}px)가 2줄 line-height(${budget.twoLines}px)와 1px 넘게 어긋난다`,
  ).toBeGreaterThanOrEqual(budget.twoLines - 1);
  expect(
    budget.contentHeight,
    `콘텐츠 높이(${budget.contentHeight}px)가 2줄 line-height(${budget.twoLines}px)보다 커 3번째 줄이 드러날 수 있다`,
  ).toBeLessThanOrEqual(budget.twoLines + 1);
});

test('AI 비서실장 드로어가 열린 동안 REACTIONS 오른쪽 열은 inert라 가려진 버튼에 포커스가 가지 않는다(PR #11 Codex 32차)', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);
  const info = page.getByTestId('reactions-info');
  await expect(info).not.toHaveAttribute('inert', '');

  // 드로어는 직접 답하기 안에 있다 — 편집기를 열어야 "AI 비서실장 열기" 버튼이 보인다.
  await page.getByTestId('followup-option-0').click();
  const openAssistant = page.getByRole('button', { name: 'AI 비서실장 열기' });
  if (!(await openAssistant.isVisible())) {
    await page.getByRole('button', { name: '직접 답하기' }).click();
  }
  await openAssistant.click();
  await expect(info).toHaveAttribute('inert', '');
  // inert 안의 요소는 포커스를 받지 못한다.
  const focusedInside = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="reactions-info"] button, [data-testid="reactions-info"] [tabindex="0"]');
    el?.focus();
    return el ? document.activeElement === el : false;
  });
  expect(focusedInside).toBe(false);

  await page.getByRole('button', { name: 'AI 비서실장 숨기기' }).click();
  await expect(info).not.toHaveAttribute('inert', '');
});
