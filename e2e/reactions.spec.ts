// T78(2026-10-02, 안건 교체): 이 spec은 상충쌍 흐름을 다루므로 안건 ②(experience-first,
// DATA_VETO ↔ EXP_ONLY)로 옮겼다 — 카드 지시대로 옛 "TRACE then ANON_FULL" 의도를
// experience-first의 후속 선택지(DATA_VETO/EXP_ONLY)로 그대로 재현한다.
//
// REACTIONS 후속 입력에서 이전에 확정한 조건과 새 제안이 충돌할 때 UI가 전달을
// 막는지 확인한다(T25 만들 것 2: 누적 조건 충돌 재검사).
import { test, expect, type Page, type Route } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

async function enterExperienceFirstReactions(page: Page) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-experience-first').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
}

/** DATA_VETO(데이터가 경고하면 멈춤)를 확정한 채 첫 의견을 전달한다. T119: 이 조건은 첫 단계
 * 추천 문구에서 빠져 있어(추가 답변에서만 제안) 직접 입력으로 확정한다. */
async function reachReactionsWithDataVetoConfirmed(page: Page) {
  await enterExperienceFirstReactions(page);
  await page.getByTestId('draft-editor-textarea').fill('데이터가 경고하면 결정을 잠시 멈추고 다시 봅시다.');
  // 자유 입력에서 찾은 조건은 칩을 눌러야 확인된다.
  await page.getByTestId('condition-chip-DATA_VETO').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
}

/** P2 = RECORD(판단 근거 기록)를 확정한 채 첫 의견을 전달한다. followUp 체크 카드로
 * DATA_VETO(새 조건, RECORD와 상충하지 않는다)를 더하는 테스트들이 이 상태에서
 * 시작한다. */
async function reachReactionsWithRecordConfirmed(page: Page) {
  await enterExperienceFirstReactions(page);
  await page.getByTestId('phrase-card-P2').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
}

test('DISCUSS에서 DATA_VETO 확정 후 REACTIONS에서 EXP_ONLY를 함께 확정하려 하면 전달이 막힌다', async ({
  page,
}) => {
  await reachReactionsWithDataVetoConfirmed(page);

  // followUp.options[1] = EXP_ONLY(새로 제안). DATA_VETO는 이전 의견에서 이미 확정돼
  // 목록에 남아 있으므로 두 조건이 함께 accepted 상태가 된다.
  await page.getByTestId('followup-option-1').click();

  const conflicts = page.getByTestId('condition-chips-conflicts');
  await expect(conflicts).toBeVisible();
  await expect(conflicts).toContainText(
    "'데이터가 경고하면 멈춤'와 '언제나 경험 먼저' 중 하나만 선택해 주세요.",
  );

  await expect(page.getByTestId('submit-followup')).toBeDisabled();
  // T98: 비활성이어도 화면에 보이는 빈 버튼이고 3칩 안내판이 현재 단계를 알려 준다.
  await expect(page.getByTestId('submit-followup')).toBeVisible();
  await expect(page.getByTestId('submit-followup')).toHaveClass(/cta--outline/);
  await expect(page.getByTestId('step-optional-tag')).toHaveCount(0);
  // T101: "넘어가기"는 720에서도 15px 이상이다.
  const keepPrevious = page.getByTestId('keep-previous-answer');
  await expect(keepPrevious).toHaveText('넘어가기');
  const keepFontSize = await keepPrevious.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(keepFontSize).toBeGreaterThanOrEqual(15);

  // EXP_ONLY 칩을 해제하면 충돌이 사라지고 다시 전달할 수 있다.
  await page.getByTestId('condition-chip-EXP_ONLY').click();
  await expect(conflicts).toBeHidden();
  await expect(page.getByTestId('submit-followup')).toBeEnabled();
});

test('후속 질문에서 이전 조건을 그대로 유지하면 최종 안건에도 함께 남는다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  // DATA_VETO를 새로 제안하는 추천 답변 체크 카드를 고른다. RECORD는 DISCUSS에서 이미
  // 확정돼 기본값으로 유지된 채 넘어온다(칩을 건드리지 않는다).
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-RECORD')).toHaveAttribute('aria-pressed', 'true');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).toContainText('판단 근거 기록');
  await expect(conditions).toContainText('데이터가 경고하면 멈춤');
});

test('후속 질문에서 이전에 확정한 조건 칩을 해제하면 최종 안건에서 빠진다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  // DISCUSS에서 확정한 RECORD가 후속 질문 칩으로 다시 보인다. 여기서 해제하면
  // 최종 안건의 누적 목록에서도 빠져야 한다(후속 보완은 누적 조건을 유지·해제한다).
  // 새로 제안된 DATA_VETO는 그대로 두어 최종 안건에 남는다.
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-RECORD')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('condition-chip-RECORD').click();
  await expect(page.getByTestId('condition-chip-RECORD')).toHaveAttribute('aria-pressed', 'false');

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).not.toContainText('판단 근거 기록');
  await expect(conditions).toContainText('데이터가 경고하면 멈춤');
});

// 후속 직접 답변에서 조건 키워드가 있어도 "-지 않-"으로 거부하면 제안되지 않고, 참가자가
// 거부한 조건이 최종안에 몰래 들어가지 않는다(PR #10 Codex 12차 검토 P1과 같은 의도).
test('후속 직접 답변에서 "-지 않-"으로 거부한 조건은 제안되지 않고 최종 안건에도 들어가지 않는다', async ({
  page,
}) => {
  await enterExperienceFirstReactions(page);
  // P1 = SCOPE만 확정한 채 첫 의견을 전달한다(DATA_VETO는 아직 없다).
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();

  await page
    .getByTestId('followup-textarea')
    .fill('데이터가 경고해도 잠시 멈추지 않겠습니다.');
  await expect(page.getByTestId('condition-chip-SCOPE')).toBeVisible();
  await expect(page.getByTestId('condition-chip-DATA_VETO')).toHaveCount(0);

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).toContainText('처음 겪는 상황에서만');
  await expect(conditions).not.toContainText('데이터가 경고하면 멈춤');
});

test('추천 답변 체크 카드만으로(직접 입력 없이) MOTION까지 도달한다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  // T74: textarea는 항상 보이지만 비어 있고, 체크 카드를 고르기 전에는 이전 의견의
  // 조건(RECORD)을 바꿀 수 없다(PR #4 Codex 검토).
  await expect(page.getByTestId('followup-textarea')).toBeVisible();
  await expect(page.getByTestId('followup-textarea')).toHaveValue('');
  await expect(page.getByTestId('condition-chip-RECORD')).toBeHidden();

  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-RECORD')).toBeVisible();
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
});

// 2026-10-02 2차 검토: 시안에 없는 "내 발언 인용" 상자는 뺐지만(제로 이탈),
// StageBand 전체가 aria-hidden이라 참가자 본인의 이전 의견을 스크린리더로 읽을
// 자리가 없어지면 안 된다 — sr-only 문단으로 화면 모양 변화 없이 되돌렸다.
test('이전 의견이 화면 모양 변화 없이 스크린리더용 sr-only 문단으로 남아 있다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  const prior = page.getByTestId('reactions-prior-opinion');
  await expect(prior).toHaveText('이사님의 이전 의견: 경험으로 결정할 때는 판단 근거를 기록합시다.');
  // sr-only 기법(1px·clip·overflow hidden)을 쓰는지 computed style로 직접 확인한다 —
  // 1×1px라 Playwright의 toBeVisible()은 "보임"으로 셀 수 있어 그 대신 실제 크기를 본다.
  await expect(prior).toHaveCSS('position', 'absolute');
  await expect(prior).toHaveCSS('width', '1px');
  await expect(prior).toHaveCSS('height', '1px');
  await expect(prior).toHaveCSS('overflow', 'hidden');
});

// S4_Reactions 시안: DISCUSS에서 이미 확정한 조건은 cyan "✓", 이번 답변이 새로
// 제안한 조건은 앰버 "+ 새 조건"으로 구분해 보여준다(2026-10-02 2차 검토).
test('CONDITIONS 칩이 기존 확정(cyan "✓")과 이번 답변의 새 조건(앰버 "+ 새 조건")을 구분해 보여준다', async ({
  page,
}) => {
  await reachReactionsWithRecordConfirmed(page);

  // DATA_VETO를 새로 제안하는 체크 카드를 고른다. RECORD는 DISCUSS에서 이미 확정돼
  // 넘어온 조건이다.
  await page.getByTestId('followup-option-0').click();

  const recordChip = page.getByTestId('condition-chip-RECORD');
  await expect(recordChip).toHaveClass(/condition-chip--accepted/);
  await expect(recordChip).not.toHaveClass(/condition-chip--new/);
  await expect(recordChip).toContainText('✓');

  const dataVetoChip = page.getByTestId('condition-chip-DATA_VETO');
  await expect(dataVetoChip).toHaveClass(/condition-chip--new/);
  await expect(dataVetoChip).not.toHaveClass(/condition-chip--accepted/);
  await expect(dataVetoChip).toContainText('+ 새 조건');
});

// PR #12 Codex 1차 검토 P1-a: 추천 답변을 체크한 뒤 그 조건을 부정하는 문장으로
// 직접 고치면, 체크 상태만으로 남아 있던 조건 제안이 사라지고 현재 문장을 키워드
// 규칙으로 다시 찾은 결과만 남아야 한다.
test('추천 답변 체크 뒤 그 조건을 부정하는 문장으로 고치면 조건 제안이 사라진다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('condition-chip-DATA_VETO')).toBeVisible();

  // DATA_VETO 키워드('경고 시'·'잠시 멈추')는 그대로 있지만 '멈추지 않겠습니다'로
  // 부정한다 — proposeFromText의 부정 규칙(NEGATION_MARKERS)에 걸려 더는 제안되지
  // 않아야 한다.
  await page
    .getByTestId('followup-textarea')
    .fill('데이터가 경고해도 잠시 멈추지 않겠습니다.');
  await expect(page.getByTestId('condition-chip-DATA_VETO')).toHaveCount(0);
  // DISCUSS에서 이미 확정한 RECORD는 체크 카드와 무관하므로 그대로 남는다.
  await expect(page.getByTestId('condition-chip-RECORD')).toBeVisible();

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  const conditions = page.getByTestId('motion-conditions');
  await expect(conditions).not.toContainText('데이터가 경고하면 멈춤');
  await expect(conditions).toContainText('판단 근거 기록');
});

// PR #12 Codex 1차 검토 P1-b: 직접 쓴 내용이 있는 상태에서 추천 답변을 체크하면
// DISCUSS와 같은 확인 UI가 뜨고, '직접 쓴 내용 유지'를 고르면 텍스트가 그대로
// 남는다(조용히 덮어쓰지 않는다).
test('직접 쓴 내용이 있을 때 추천 답변을 체크하면 확인 UI가 뜨고 "유지"를 고르면 텍스트가 보존된다', async ({
  page,
}) => {
  await reachReactionsWithRecordConfirmed(page);

  const customText = '제 나름대로 정리한 답변입니다.';
  await page.getByTestId('followup-textarea').fill(customText);
  await expect(page.getByTestId('rebuild-confirm')).toHaveCount(0);

  await page.getByTestId('followup-option-0').click();
  const rebuildConfirm = page.getByTestId('rebuild-confirm');
  await expect(rebuildConfirm).toBeVisible();
  // 확인 UI가 뜬 동안에는 원문이 조용히 바뀌지 않는다.
  await expect(page.getByTestId('followup-textarea')).toHaveValue(customText);
  // PR #12 Codex 2차 검토 1: 확인 UI가 뜬 동안에는 전달 버튼도 막혀 있어야 한다 —
  // 그렇지 않으면 참가자가 요청한 체크 변경을 건너뛰고 조용히 전달될 수 있다.
  await expect(page.getByTestId('submit-followup')).toBeDisabled();

  await page.getByTestId('rebuild-confirm-keep').click();
  await expect(rebuildConfirm).toHaveCount(0);
  // '유지'를 고른 뒤에도 텍스트는 그대로고, 체크 카드만 선택 표시로 바뀐다.
  await expect(page.getByTestId('followup-textarea')).toHaveValue(customText);
  await expect(page.getByTestId('followup-option-0')).toHaveClass(/phrase-card--selected/);
  await expect(page.getByTestId('submit-followup')).toBeEnabled();
});

// 같은 흐름에서 '선택 문구로 다시 구성'을 고르면 체크된 옵션 전체 기준으로 답변을
// 다시 짓는다(DISCUSS의 buildDraftText와 같은 전체 재구성).
test('직접 쓴 내용이 있을 때 추천 답변을 체크한 뒤 "다시 구성"을 고르면 선택 기준으로 다시 짓는다', async ({
  page,
}) => {
  await reachReactionsWithRecordConfirmed(page);

  await page.getByTestId('followup-textarea').fill('제 나름대로 정리한 답변입니다.');
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('rebuild-confirm')).toBeVisible();

  await page.getByTestId('rebuild-confirm-rebuild').click();
  await expect(page.getByTestId('rebuild-confirm')).toHaveCount(0);
  await expect(page.getByTestId('followup-textarea')).toHaveValue(
    '데이터가 경고하면 결정을 잠시 멈추고 다시 봅시다.',
  );
  // 다시 구성한 뒤에는(dirty가 풀렸으므로) 체크한 옵션의 조건이 다시 제안된다.
  await expect(page.getByTestId('condition-chip-DATA_VETO')).toBeVisible();
});

// PR #12 Codex 1차 검토 P2-a: 네이티브 체크박스가 1×1px라 기본 포커스 링이 보이지
// 않았다 — 카드 전체(label)에 :focus-within 테두리를 옮겼는지 확인한다.
test('추천 답변 체크 카드가 키보드 포커스에서 보이는 테두리를 가진다', async ({ page }) => {
  await reachReactionsWithRecordConfirmed(page);

  const checkbox = page.locator('[data-testid="followup-option-0"] input[type="checkbox"]');
  await checkbox.focus();
  const card = page.getByTestId('followup-option-0');
  await expect(card).toHaveCSS('outline-style', 'solid');
  await expect(card).toHaveCSS('outline-width', '2px');
});

test('AI 비서실장 드로어가 열린 동안 REACTIONS 오른쪽 열은 inert라 가려진 버튼에 포커스가 가지 않는다(PR #11 Codex 32차)', async ({
  page,
}) => {
  await reachReactionsWithRecordConfirmed(page);
  const info = page.getByTestId('reactions-info');
  await expect(info).not.toHaveAttribute('inert', '');

  // T74부터 "AI 비서실장에게 맡기기" 버튼은 편집기 토글 없이 늘 보인다.
  await page.getByTestId('followup-option-0').click();
  const openAssistant = page.getByRole('button', { name: 'AI 비서실장에게 맡기기' });
  await openAssistant.click();
  await expect(info).toHaveAttribute('inert', '');
  // inert 안의 요소는 포커스를 받지 못한다.
  const focusedInside = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="reactions-info"] button, [data-testid="reactions-info"] [tabindex="0"]');
    el?.focus();
    return el ? document.activeElement === el : false;
  });
  expect(focusedInside).toBe(false);

  // T89: 드로어 대신 팝업(DialogShell)이 된 뒤로는 팝업 자체의 닫기 버튼으로 닫는다.
  await page.getByTestId('assistant-close').click();
  await expect(info).not.toHaveAttribute('inert', '');
});

// PR #12 Codex 3차 검토 1: 유지/바뀜 배지는 텍스트가 아니라 stance로 가른다 — 같은
// 역할이 OPINIONS·REACTIONS에서 다른 stance로 답하면 "바뀜", 같은 stance로 답하면
// (문장이 완전히 다시 쓰여도) "유지"다.
const REACTION_BADGE_EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
type ReactionBadgeExecRoleId = (typeof REACTION_BADGE_EXEC_ROLE_IDS)[number];

// T82: server/providers/mock.ts와 같은 한국어 표기(영문은 서버 검증에서 거절된다,
// validate.ts의 findStrayLatinRun) — 이 route 가로채기는 서버를 거치지 않지만 실제 mock
// 응답과 모양을 맞춰 둔다.
const STAGE_LABEL_KO: Record<string, string> = {
  OPINIONS: '의견',
  REACTIONS: '반응',
  FOLLOWUP: '후속',
  VOTE: '표결',
};

function reactionBadgeStatementEntry(
  roleId: ReactionBadgeExecRoleId,
  stage: string,
  stance: 'FOR' | 'AGAINST' | 'UNDECIDED',
) {
  return {
    roleId,
    status: 'answered',
    statement: {
      roleId,
      message: `[모의] ${roleId}의 ${STAGE_LABEL_KO[stage] ?? stage} 발언(문구는 매번 다시 씁니다).`,
      evidenceIds: [],
      referencedStatementIds: [],
      concerns: [],
      suggestedConditionIds: [],
      stance,
    },
    latencyMs: 5,
    modelId: 'mock',
    promptVersion: 'mock',
  };
}

/** OPINIONS에서는 CEO만 반대, REACTIONS에서는 전원 찬성으로 돌려준다 — CEO는 stance가
 * 바뀌고(반대→찬성), 나머지는 그대로(찬성 유지)인 조합을 결정적으로 재현한다. */
async function mockOpinionsAgainstThenReactionsFor(page: Page): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      stage: string;
      roleIds?: ReactionBadgeExecRoleId[];
    };
    const targets = body.roleIds ?? REACTION_BADGE_EXEC_ROLE_IDS;
    const json = targets.map((roleId) => {
      const stance = body.stage === 'OPINIONS' && roleId === 'CEO' ? 'AGAINST' : 'FOR';
      return reactionBadgeStatementEntry(roleId, body.stage, stance);
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

test('REACTIONS 반응 카드는 stance가 바뀐 임원만 "바뀜"으로, 같은 stance면 문장이 달라도 "유지"로 표시한다(PR #12 Codex 3차 검토 1)', async ({
  page,
}) => {
  await mockOpinionsAgainstThenReactionsFor(page);
  await page.goto('/?coach=off');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다
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

  // CEO는 OPINIONS(반대)→REACTIONS(찬성)로 stance가 바뀌었으므로 "유지" 클래스가 없다.
  await expect(page.getByTestId('live-role-CEO')).not.toHaveClass(/live-statement--maintained/);
  // CFO는 두 단계 모두 찬성(stance 동일, 문장은 매번 다시 씀)이므로 "유지"다.
  await expect(page.getByTestId('live-role-CFO')).toHaveClass(/live-statement--maintained/);
});
