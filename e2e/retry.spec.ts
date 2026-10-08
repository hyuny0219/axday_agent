// "다시 요청"(T65) E2E: REACTIONS에서 CFO만 실패 → "다시 물어보기" → 카드·표정
// 갱신, VOTE에서 CAIO 미표결 → "다시 물어보기" → 결과에 반영. live.spec.ts와 같은
// mock 서버(8787, MODEL_PROVIDER=mock)를 쓰고, page.route로 /api/board/round·/api/board/vote
// 응답만 가로챈다(e2e/live.spec.ts의 mockRoleFailure와 같은 방식, 허용 경로가 e2e/뿐이라
// 서버·클라이언트 코드는 건드리지 않는다).

import { test, expect, type Page, type Route } from './fixtures';
import { useAssistantAllFeatures } from './helpers/assistant';

const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
type ExecRoleId = (typeof EXEC_ROLE_IDS)[number];

async function enterAiAssistant(page: Page): Promise<void> {
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
}

// T82: server/providers/mock.ts와 같은 한국어 표기(영문은 서버 검증에서 거절된다,
// validate.ts의 findStrayLatinRun) — 이 route 가로채기는 서버를 거치지 않지만 실제 mock
// 응답과 모양을 맞춰 둔다.
const STAGE_LABEL_KO: Record<string, string> = {
  OPINIONS: '의견',
  REACTIONS: '반응',
  FOLLOWUP: '후속',
  VOTE: '표결',
};

function answeredStatementEntry(roleId: ExecRoleId, stage: string) {
  return {
    roleId,
    status: 'answered',
    statement: {
      roleId,
      message: `[모의] ${roleId}의 ${STAGE_LABEL_KO[stage] ?? stage} 발언입니다.`,
      evidenceIds: ['E1'],
      referencedStatementIds: [],
      concerns: [],
      suggestedConditionIds: [],
      stance: 'FOR',
    },
    latencyMs: 10,
    modelId: 'mock',
    promptVersion: 'mock',
  };
}

/** REACTIONS의 최초(전체) 호출에서만 failingRoleId를 실패로 되돌린다. roleIds가 실린
 * 요청(=재요청)은 항상 성공으로 돌려줘 "다시 요청" 성공 경로를 결정적으로 재현한다. */
async function mockReactionsFailureThenRetrySucceeds(page: Page, failingRoleId: ExecRoleId): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string; roleIds?: ExecRoleId[] };
    const targets = body.roleIds ?? EXEC_ROLE_IDS;
    const isInitialReactionsCall = body.stage === 'REACTIONS' && !body.roleIds;
    const json = targets.map((roleId) =>
      isInitialReactionsCall && roleId === failingRoleId
        ? { roleId, status: 'failed', failReason: 'timeout', latencyMs: 0, modelId: 'mock', promptVersion: 'mock' }
        : answeredStatementEntry(roleId, body.stage),
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

/** OPINIONS·REACTIONS는 항상 성공시키고, FOLLOWUP의 최초(전체) 호출에서만 failingRoleId를
 * 실패로 되돌린다. roleIds가 실린 요청(=재요청)은 항상 성공으로 돌려준다. */
async function mockFollowupFailureThenRetrySucceeds(page: Page, failingRoleId: ExecRoleId): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string; roleIds?: ExecRoleId[] };
    const targets = body.roleIds ?? EXEC_ROLE_IDS;
    const isInitialFollowupCall = body.stage === 'FOLLOWUP' && !body.roleIds;
    const json = targets.map((roleId) =>
      isInitialFollowupCall && roleId === failingRoleId
        ? { roleId, status: 'failed', failReason: 'timeout', latencyMs: 0, modelId: 'mock', promptVersion: 'mock' }
        : answeredStatementEntry(roleId, body.stage),
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

/** VOTE의 최초(전체) 호출에서만 failingRoleId를 실패로 되돌린다. roleIds가 실린 요청
 * (="미표결 임원 다시 요청")은 answered로 돌려준다. */
async function mockVoteFailureThenRetrySucceeds(page: Page, failingRoleId: ExecRoleId): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string; roleIds?: ExecRoleId[] };
    const targets = body.roleIds ?? EXEC_ROLE_IDS;
    const json = targets.map((roleId) => answeredStatementEntry(roleId, body.stage));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await page.route('**/api/board/vote', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      motion: { id: string; hash: string };
      roleIds?: ExecRoleId[];
    };
    const targets = body.roleIds ?? EXEC_ROLE_IDS;
    const isInitialVoteCall = !body.roleIds;
    const json = targets.map((roleId) =>
      isInitialVoteCall && roleId === failingRoleId
        ? { roleId, status: 'failed', failReason: 'timeout', modelId: 'mock', promptVersion: 'mock' }
        : {
            roleId,
            status: 'answered',
            ballot: {
              motionId: body.motion.id,
              motionHash: body.motion.hash,
              vote: 'YES',
              reason: `[모의] ${roleId}의 판단 근거입니다.`,
              evidenceIds: ['E1'],
              remainingConcerns: [],
            },
            modelId: 'mock',
            promptVersion: 'mock',
          },
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

/** REACTIONS의 최초(전체) 호출에서 임원 4명 모두 실패로 되돌린다. roleIds가 실린
 * 요청(=재요청)은 항상 성공으로 돌려준다(PR #12 Codex 1차 검토 P2-b: 실패가 여럿이어도
 * 재요청 버튼이 하나만 그려지고 720에서 잘리지 않는지 확인하는 데 쓴다). */
async function mockAllReactionsFail(page: Page): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string; roleIds?: ExecRoleId[] };
    const targets = body.roleIds ?? EXEC_ROLE_IDS;
    const isInitialReactionsCall = body.stage === 'REACTIONS' && !body.roleIds;
    const json = targets.map((roleId) =>
      isInitialReactionsCall
        ? { roleId, status: 'failed', failReason: 'timeout', latencyMs: 0, modelId: 'mock', promptVersion: 'mock' }
        : answeredStatementEntry(roleId, body.stage),
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

test('REACTIONS에서 임원 4명이 모두 실패해도 재요청 버튼은 하나만 그려지고 720에서 잘리지 않는다(PR #12 Codex 1차 검토 P2-b)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockAllReactionsFail(page);

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

  await enterAiAssistant(page);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await useAssistantAllFeatures(page);
  await page.getByTestId('submit-opinion').click();

  // 4명 모두 실패 카드다.
  for (const roleId of EXEC_ROLE_IDS) {
    await expect(page.getByTestId(`statement-failed-${roleId}`)).toBeVisible({ timeout: 10_000 });
  }

  // 같은 testid가 여러 번 생기면 strict 모드 단언이 먼저 깨지므로, 버튼이 정확히
  // 하나뿐인지부터 확인한다(고정 순서상 CEO 카드 안에 있다).
  await expect(page.locator('[data-testid="retry-failed-roles"]')).toHaveCount(1);
  const retryButton = page.getByTestId('retry-failed-roles');
  await expect(retryButton).toBeVisible();

  // 버튼이 자기 카드(CEO) 테두리 안에 완전히 들어오는지 — 실측(픽셀) 기준으로 확인한다.
  const buttonBox = await retryButton.boundingBox();
  const cardBox = await page.getByTestId('live-role-CEO').boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  if (buttonBox && cardBox) {
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
  }
  // 페이지 자체도 스크롤이 생기지 않는다(T45 무스크롤 규칙).
  const hasPageScroll = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(hasPageScroll).toBe(false);
});

test('REACTIONS에서 CFO가 실패하면 "응답 없는 임원 다시 요청"으로 카드·표정이 갱신된다', async ({ page }) => {
  await mockReactionsFailureThenRetrySucceeds(page, 'CFO');

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

  await enterAiAssistant(page);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await useAssistantAllFeatures(page);
  await page.getByTestId('submit-opinion').click();

  // REACTIONS: CFO만 실패, 나머지 3명은 정상 응답.
  await expect(page.getByTestId('statement-failed-CFO')).toBeVisible({ timeout: 10_000 });
  const retryButton = page.getByTestId('retry-failed-roles');
  await expect(retryButton).toBeVisible();
  await expect(retryButton).toHaveText('다시 물어보기');

  await retryButton.click();

  // 재요청이 성공하면 CFO도 발언 카드로 바뀌고(표정도 함께), 실패 카드는 사라진다.
  await expect(page.getByTestId('statement-card-CFO')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('statement-failed-CFO')).toHaveCount(0);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4);
  await expect(page.getByTestId('exec-mood-label-CFO')).not.toHaveText('미정');

  // 재요청 성공 후에는 실패한 역할이 없어 버튼 자체가 사라진다.
  await expect(page.getByTestId('retry-failed-roles')).toHaveCount(0);
});

test('VOTE에서 CAIO가 미표결이면 "미표결 임원 다시 요청"으로 결과에 실제 표가 반영된다', async ({ page }) => {
  await mockVoteFailureThenRetrySucceeds(page, 'CAIO');

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

  await enterAiAssistant(page);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await useAssistantAllFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await page.getByTestId('keep-previous-answer').click();
  await expect(page.getByTestId('freeze-motion')).toBeEnabled();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  const retryButton = page.getByTestId('retry-failed-roles');
  await expect(retryButton).toBeVisible({ timeout: 10_000 });
  await expect(retryButton).toHaveText('다시 물어보기');
  await retryButton.click();

  // 재요청이 성공하면 CAIO도 실제 표(YES)로 집계돼 미표결 안내가 뜨지 않는다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('result-limited-notice')).toHaveCount(0);
  await expect(page.locator('[data-testid^="result-seat-reason-"]')).toHaveCount(4);
});

test('FOLLOWUP에서 CFO가 실패해도 표결로 진행할 수 있고, "응답 없는 임원 다시 요청"으로 회의록·표정이 갱신된다', async ({
  page,
}) => {
  await mockFollowupFailureThenRetrySucceeds(page, 'CFO');

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveCount(0); // T86: live에서는 '실시간' 배지 자체를 그리지 않는다

  await enterAiAssistant(page);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await useAssistantAllFeatures(page);
  await page.getByTestId('submit-opinion').click();

  // REACTIONS: 정상 4명. 조건 제안(옵션 0)을 골라 후속 답을 보내 opinions가 2건이 되게
  // 해서 FOLLOWUP 라운드를 트리거한다(KEEP_PREVIOUS는 라운드가 돌지 않는다).
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();

  // 후속 대기 게이트가 풀려 표결로 진행할 수 있다 — CFO가 실패해도 막히지 않는다.
  await expect(page.getByTestId('freeze-motion')).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId('motion-waiting-followup')).toHaveCount(0);

  // 실패한 CFO가 있으므로 재요청 버튼이 최종 안건 화면 오른쪽 열에 남아 있다.
  const retryButton = page.getByTestId('retry-failed-roles');
  await expect(retryButton).toBeVisible();
  await expect(retryButton).toHaveText('다시 물어보기');
  await expect(page.getByTestId('minutes-entry-followup-CFO')).toContainText('이번에는 답을 받지 못했습니다');

  await retryButton.click();

  // 재요청이 성공하면 회의록·표정이 갱신되고 버튼은 사라진다. 표결 진행은 그대로 가능하다.
  await expect(page.getByTestId('minutes-entry-followup-CFO')).not.toContainText(
    '이번에는 답을 받지 못했습니다',
    { timeout: 10_000 },
  );
  await expect(page.getByTestId('exec-mood-label-CFO')).not.toHaveText('미정');
  await expect(page.getByTestId('retry-failed-roles')).toHaveCount(0);
  await expect(page.getByTestId('freeze-motion')).toBeEnabled();

  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
});
