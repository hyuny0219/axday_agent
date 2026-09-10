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
  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
}

test('DISCUSS에서 ACCESS 확정 후 REACTIONS에서 OPEN_ALL을 함께 확정하려 하면 전달이 막힌다', async ({
  page,
}) => {
  await reachReactionsWithAccessConfirmed(page);

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

test('후속 질문에서 새로 제안된 조건 칩을 해제하면 최종 안건에서 빠진다', async ({ page }) => {
  await reachReactionsWithAccessConfirmed(page);

  // REVIEW는 이 후속 질문에서 새로 제안된 조건이라 해제하면 어떤 의견에도
  // 확정된 적이 없어 최종 안건에 남지 않는다. (DISCUSS에서 이미 확정된 ACCESS를
  // 여기서 해제하는 경우는 다르다 — findings 참고: 후속에서 칩을 풀어도 이전
  // 의견의 확정 기록은 그대로 남아 MotionScreen의 누적 목록에서 계속 보인다.)
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('condition-chip-REVIEW').click();
  await expect(page.getByTestId('condition-chip-REVIEW')).toHaveAttribute('aria-pressed', 'false');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  // ACCESS는 DISCUSS에서 이미 확정돼 그대로 남고, 해제한 REVIEW만 빠진다.
  await expect(conditions).toContainText('권한·공유 범위 확인');
  await expect(conditions).not.toContainText('출처·기준일 표시 후 담당자 검토');
});
