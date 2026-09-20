// live 경로 E2E(T30). playwright.config.ts가 mock board 서버(8787, MODEL_PROVIDER=mock)와
// vite preview(4173, /api proxy)를 함께 띄운다. 이 파일의 테스트는 그 서버를 그대로 쓴다
// (다른 e2e spec은 `?mode=scripted`로 이 서버를 무시하고 scripted 경로만 검증한다).
//
// "한 임원이 응답하지 않는" 경로는 서버/클라이언트 쪽 장애 주입 배선 없이, 이 spec 안에서
// Playwright의 page.route로 /api/board/round·/api/board/vote 응답 자체를 가로채 특정
// 역할만 status:'failed'로 되돌려주는 방식으로 만든다(허용 경로가 e2e/뿐이라 다른 파일은
// 건드리지 않는다 — docs/TASKS.md T36 참고).

import { test, expect, type Page, type Route } from './fixtures';

const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
type ExecRoleId = (typeof EXEC_ROLE_IDS)[number];

async function enterAiAssistant(page: Page): Promise<void> {
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
}

/** roleId가 실패한 것처럼 보이게 /api/board/round·/api/board/vote 응답을 가로챈다.
 * 나머지 역할은 정상 응답으로 채워 RESULT의 "일부 미표결" 경로만 결정적으로 재현한다. */
async function mockRoleFailure(page: Page, failingRoleId: ExecRoleId): Promise<void> {
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string };
    const json = EXEC_ROLE_IDS.map((roleId) =>
      roleId === failingRoleId
        ? { roleId, status: 'failed', failReason: 'timeout', latencyMs: 0, modelId: 'mock', promptVersion: 'mock' }
        : {
            roleId,
            status: 'answered',
            statement: {
              roleId,
              message: `[mock] ${roleId}의 ${body.stage} 발언입니다.`,
              evidenceIds: ['E1'],
              referencedStatementIds: [],
              concerns: [],
              suggestedConditionIds: [],
            },
            latencyMs: 10,
            modelId: 'mock',
            promptVersion: 'mock',
          },
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await page.route('**/api/board/vote', async (route: Route) => {
    const body = route.request().postDataJSON() as { motion: { id: string; hash: string } };
    const json = EXEC_ROLE_IDS.map((roleId) =>
      roleId === failingRoleId
        ? { roleId, status: 'failed', failReason: 'timeout', modelId: 'mock', promptVersion: 'mock' }
        : {
            roleId,
            status: 'answered',
            ballot: {
              motionId: body.motion.id,
              motionHash: body.motion.hash,
              vote: 'YES',
              reason: `[mock] ${roleId}의 판단 근거입니다.`,
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

test('mock 서버가 떠 있으면 live로 완주하고 발언 카드·판단 근거를 보여준다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE');

  await enterAiAssistant(page);

  // OPINIONS: 임원 4명의 실제 발언 카드가 모두 나온다.
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // REACTIONS: 참가자 의견 전달 뒤 새 라운드가 자동으로 돈다.
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByTestId('followup-option-2').click(); // 이 의견으로 마무리(KEEP_PREVIOUS)
  await expect(page.getByTestId('motion-card')).toBeVisible();
  // 후속 라운드가 없는 경로(T46)이므로 후속 대기 게이트 없이 곧바로 활성이다.
  await expect(page.getByTestId('freeze-motion')).toBeEnabled();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('result-mode-notice')).toContainText('LIVE');
  // 임원 4명 모두 응답했으므로 판단 근거가 4개 모두 보인다.
  await expect(page.locator('[data-testid^="result-seat-reason-"]')).toHaveCount(4);
  await expect(page.getByTestId('result-limited-notice')).toHaveCount(0);
});

test('live에서 후속 제출 직후 표결 CTA가 잠기고 FOLLOWUP 라운드 도착 후 열린다(T46)', async ({ page }) => {
  // FOLLOWUP 라운드만 1.5초 지연시켜 runRound('FOLLOWUP') promise가 settle되기 전
  // 구간을 결정적으로 재현한다(OPINIONS·REACTIONS는 그대로 즉시 응답).
  await page.route('**/api/board/round', async (route: Route) => {
    const body = route.request().postDataJSON() as { stage: string };
    if (body.stage === 'FOLLOWUP') {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE');

  await enterAiAssistant(page);

  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  // 조건 제안(followup-option-0)을 골라 후속 답을 전달한다 — opinions가 2건이 되어
  // FOLLOWUP 라운드가 트리거된다.
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();

  const freezeButton = page.getByTestId('freeze-motion');
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(freezeButton).toBeDisabled();
  await expect(page.getByTestId('motion-waiting-followup')).toBeVisible();

  // FOLLOWUP 라운드(1.5초 지연)가 도착하면 CTA가 열리고 대기 문구는 사라진다.
  await expect(freezeButton).toBeEnabled({ timeout: 5_000 });
  await expect(page.getByTestId('motion-waiting-followup')).toHaveCount(0);

  await freezeButton.click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid^="result-seat-reason-"]')).toHaveCount(4);
});

test('한 임원이 응답하지 않으면 결과에 UNCAST와 제한 안내가 보인다', async ({ page }) => {
  await mockRoleFailure(page, 'CAIO');

  await page.goto('/');
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE');

  await enterAiAssistant(page);

  // OPINIONS: CAIO만 failed, 나머지 3명은 정상 응답으로 남는다.
  await expect(page.getByTestId('statement-failed-CAIO')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expect(page.getByTestId('statement-failed-CAIO')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('followup-option-2').click(); // 후속 라운드 없이 MOTION으로
  await expect(page.getByTestId('motion-card')).toBeVisible();
  // 회의록 패널(v1.0 7절, T41): OPINIONS 라운드에서 실패한 CAIO 항목이 뒤 라운드
  // (REACTIONS)가 roleStatus를 덮어써도 "응답 없음"으로 남는다(roundLog 기준).
  await expect(page.getByTestId('minutes-entry-opinion-CAIO')).toContainText('응답 없음');
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('result-seat-CAIO')).toContainText('미표결');
  await expect(page.getByTestId('result-seat-unavailable-CAIO')).toBeVisible();
  await expect(page.getByTestId('result-limited-notice')).toBeVisible();
});

test('서버 상태 확인이 실패하면 scripted 배지와 기존 흐름을 그대로 쓴다', async ({ page }) => {
  // /api/health만 끊어 "서버 없이 기동"과 같은 상황을 만든다(mode.ts의 안전한 폴백 경로).
  await page.route('**/api/health', (route) => route.abort());

  await page.goto('/');

  await expect(page.getByTestId('mode-badge')).toHaveText('사전 구성 시뮬레이션');
  await expect(page.getByTestId('attract-mode-badge')).toHaveText('사전 구성 시뮬레이션');

  await enterAiAssistant(page);

  // scripted 경로는 사전 구성된 임원 4열 카드를 그대로 보여준다(live 발언 카드가 아니다).
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(0);
});
