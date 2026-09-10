// live 경로 E2E(T30). playwright.config.ts가 mock board 서버(8787, MODEL_PROVIDER=mock)와
// vite preview(4173, /api proxy)를 함께 띄운다. 이 파일의 테스트는 그 서버를 그대로 쓴다
// (다른 e2e spec은 `?mode=scripted`로 이 서버를 무시하고 scripted 경로만 검증한다).
//
// AGENT_BOARDROOM_SPEC.md 6장 "임원 라운드별 최대 8초"를 mock의 timeout 장애 주입으로
// 그대로 겪으므로, 해당 테스트는 라운드마다 최대 8초씩(OPINIONS·REACTIONS·최종표) 실제로
// 기다린다. 기본 30초 테스트 제한을 넉넉히 늘려 잡는다.

import { test, expect, type Page } from '@playwright/test';

async function enterAiAssistant(page: Page): Promise<void> {
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
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
  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });

  await page.getByTestId('followup-option-2').click(); // 이 의견으로 마무리(KEEP_PREVIOUS)
  await expect(page.getByTestId('motion-card')).toBeVisible();
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

test('한 임원이 응답하지 않으면 결과에 UNCAST와 제한 안내가 보인다', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/?mock=timeout:cio');
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE');

  await enterAiAssistant(page);

  // OPINIONS: CIO는 8초 안에 실패로 남는다(서버 쪽 개별 타임아웃과 클라이언트 쪽 전체
  // 요청 타임아웃이 거의 같은 8초라, 드물게 나머지 3명도 같은 요청 안에서 함께 실패로
  // 남을 수 있다 — 이 테스트는 "CIO가 결국 실패로 표시된다"만 검증하고 나머지 인원의
  // 성공 개수는 강제하지 않는다).
  await expect(page.getByTestId('statement-failed-CIO')).toBeVisible({ timeout: 12_000 });

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await expect(page.getByTestId('statement-failed-CIO')).toBeVisible({ timeout: 12_000 });

  await page.getByTestId('followup-option-2').click(); // 후속 라운드 없이 MOTION으로
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 12_000 });
  await expect(page.getByTestId('result-seat-CIO')).toContainText('미표결');
  await expect(page.getByTestId('result-seat-unavailable-CIO')).toBeVisible();
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
