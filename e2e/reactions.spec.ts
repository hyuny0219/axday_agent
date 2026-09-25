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
