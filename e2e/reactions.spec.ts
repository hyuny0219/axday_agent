import { test, expect, type Page } from './fixtures';

/**
 * REACTIONS 후속 입력에서 이전에 확정한 조건과 새 제안이 충돌할 때 UI가 전달을
 * 막는지 확인한다(T25 만들 것 2: 누적 조건 충돌 재검사).
 */
async function reachReactionsWithAccessConfirmed(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // P3 = ACCESS(권한·공유 범위 확인)를 확정한 채 첫 의견을 전달한다.
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
}

test('DISCUSS에서 ACCESS 확정 후 REACTIONS에서 OPEN_ALL을 함께 확정하려 하면 전달이 막힌다', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);

  await page.getByTestId('followup-open-editor').click();
  const textarea = page.getByTestId('followup-textarea');
  // P5 문장 그대로: OPEN_ALL을 새로 제안한다. ACCESS는 이전 의견에서 이미 확정돼
  // 목록에 남아 있으므로 두 조건이 함께 accepted 상태가 된다.
  await textarea.fill('권한 검토 없이 모든 부서 자료를 바로 연결합시다.');

  const conflicts = page.getByTestId('condition-chips-conflicts');
  await expect(conflicts).toBeVisible();
  await expect(conflicts).toContainText(
    '권한 확인 후 사용 / 권한 검토 없이 연결 중 어떤 의견을 전달할까요?',
  );

  await expect(page.getByTestId('submit-followup')).toBeDisabled();

  // OPEN_ALL 칩을 해제하면 충돌이 사라지고 다시 전달할 수 있다.
  await page.getByTestId('condition-chip-OPEN_ALL').click();
  await expect(conflicts).toBeHidden();
  await expect(page.getByTestId('submit-followup')).toBeEnabled();
});

test('후속 질문에서 이전 조건을 그대로 유지하면 최종 안건에도 함께 남는다', async ({ page }) => {
  await reachReactionsWithAccessConfirmed(page);

  // REVIEW를 새로 제안하는 선택지를 고른다. ACCESS는 DISCUSS에서 이미 확정돼
  // 기본값으로 유지된 채 넘어온다(칩을 건드리지 않는다).
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-ACCESS')).toHaveAttribute('aria-pressed', 'true');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).toContainText('권한·공유 범위 확인');
  await expect(conditions).toContainText('출처·기준일 표시 후 담당자 검토');
});

test('후속 질문에서 이전에 확정한 조건 칩을 해제하면 최종 안건에서 빠진다', async ({ page }) => {
  await reachReactionsWithAccessConfirmed(page);

  // DISCUSS에서 확정한 ACCESS가 후속 질문 칩으로 다시 보인다. 여기서 해제하면
  // 최종 안건의 누적 목록에서도 빠져야 한다(후속 보완은 누적 조건을 유지·해제한다).
  // 새로 제안된 REVIEW는 그대로 두어 최종 안건에 남는다.
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-ACCESS')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('condition-chip-ACCESS').click();
  await expect(page.getByTestId('condition-chip-ACCESS')).toHaveAttribute('aria-pressed', 'false');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).not.toContainText('권한·공유 범위 확인');
  await expect(conditions).toContainText('출처·기준일 표시 후 담당자 검토');
});

test('직접 답하기를 열기 전에는 textarea가 보이지 않고, 빠른 답만으로 MOTION까지 도달한다', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);

  // T40 만들 것 2: 직접 입력은 접어 두고, 빠른 답 3개만으로도 완주할 수 있다.
  await expect(page.getByTestId('followup-textarea')).toBeHidden();

  await page.getByTestId('followup-option-0').click();
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
});
