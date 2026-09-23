// 운영 규칙 E2E: 운영자 새 체험 확인, 최종 투표 확정 이중 클릭 방지, 시계가 화면에
// 영향을 주지 않는다는 것을 검증한다. T50(2026-09-22 사용자 결정)에서 240초 만료와
// 75/90초 무입력 복귀를 제거했다 — 체험은 더 이상 시간으로 끝나지 않는다. 세션을
// 끝내는 경로는 결과 화면의 "체험 종료"와 운영 메뉴의 "새 체험"·"scripted로 새
// 체험"뿐이다. `?testClock=1`은 window.__boardroom.advance(ms)로 실제로 기다리지 않고
// Clock.now()만 앞당긴다(orchestrator·서버가 지연 측정에 쓰는 것과 같은 주입형 Clock).

import { test, expect, type Page } from './fixtures';

async function advanceClock(page: Page, ms: number): Promise<void> {
  await page.evaluate((advanceMs) => {
    (
      window as unknown as { __boardroom?: { advance(ms: number): void } }
    ).__boardroom?.advance(advanceMs);
  }, ms);
}

async function enterScenario(page: Page): Promise<void> {
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
}

test('시계를 앞으로 돌려도 화면이 바뀌지 않는다', async ({ page }) => {
  await page.goto('/?testClock=1&mode=scripted');
  await enterScenario(page);
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  // 예전 240초 만료·90초 무입력 복귀 기준을 모두 넉넉히 넘기는 시간을 한 번에
  // 앞당긴다. advanceClock 자체는 orchestrator·서버 지연 측정용 Clock.now()만 옮길
  // 뿐, 세션 상태를 바꾸는 어떤 대체 액션도 함께 보내지 않는다 — 시간 경과만으로는
  // ATTRACT 복귀도 결과 종료도 일어나지 않아야 한다.
  await advanceClock(page, 10 * 60_000);

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByRole('button', { name: '체험 시작' })).toHaveCount(0);
  await expect(page.getByTestId('result-conclusion')).toHaveCount(0);

  // 화면 어디에도 카운트다운이 없다(헤더 타이머·무대 벽시계·무입력 안내 모두 제거).
  await expect(page.getByTestId('timer-slot')).toHaveCount(0);
  await expect(page.getByTestId('stage-clock')).toHaveCount(0);
  await expect(page.getByTestId('idle-notice')).toHaveCount(0);
});

test('운영자 메뉴의 새 체험은 확인 후에만 세션을 초기화한다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await enterScenario(page);
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-new-session').click();

  const confirmDialog = page.getByTestId('operator-confirm-new-session');
  await expect(confirmDialog).toBeVisible();

  // 취소하면 세션이 그대로 유지된다.
  await page.getByTestId('operator-confirm-new-session-cancel').click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-new-session').click();
  await page.getByTestId('operator-confirm-new-session-yes').click();

  await expect(page.getByRole('button', { name: '체험 시작' })).toBeVisible();
});

test('새로고침하면 이전 진행 상황이 남지 않고 새 세션으로 시작한다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await enterScenario(page);
  await expect(page.getByTestId('chair-briefing')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: '체험 시작' })).toBeVisible();
  await expect(page.getByTestId('chair-briefing')).toHaveCount(0);
});

test('최종 투표 확정을 빠르게 두 번 눌러도 표는 한 번만 반영된다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await enterScenario(page);
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('submit-opinion').click();

  await page.getByTestId('followup-option-2').click();
  await page.getByTestId('freeze-motion').click();

  await page.getByTestId('vote-radio-YES').check();

  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="confirm-vote"]');
    if (button instanceof HTMLButtonElement) {
      button.click();
      button.click();
    }
  });

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toHaveCount(1);
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toContainText('찬성');
});

/** operator-probe 패널을 열고 결과가 나올 때까지 기다린다. 전역 10초 1회 제한(T49)에
 * 다른 프로젝트(desktop-1080/desktop-720)의 동시 호출과 겹치면 probe_rate_limit으로
 * 실패할 수 있어, 그 경우에만 패널을 닫고 잠깐 기다렸다가 다시 연다. */
async function openProbeUntilSettled(page: Page): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    await page.getByTestId('operator-probe').click();
    await expect(page.getByTestId('operator-probe-panel')).toBeVisible();
    await expect(page.getByTestId('operator-probe-pending')).toBeHidden({ timeout: 10_000 });

    const failLocator = page.getByTestId('operator-probe-fail');
    const failed = (await failLocator.count()) > 0;
    const failText = failed ? await failLocator.textContent() : '';
    if (failed && failText?.includes('probe_rate_limit') && Date.now() < deadline) {
      await page.getByTestId('operator-probe-close').click();
      await page.waitForTimeout(2000);
      await page.getByTestId('operator-menu-button').click();
      await expect(page.getByTestId('operator-menu-panel')).toBeVisible();
      continue;
    }
    return;
  }
}

test('mock 서버 기준 "모델 연결 확인"은 실제 mock 제공자 정보를 보여준다', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('operator-menu-button').click();

  await openProbeUntilSettled(page);

  await expect(page.getByTestId('operator-probe-ok')).toContainText('mock');
});

test('모델 연결 확인이 실패하면 오류 메시지를 보여준다', async ({ page }) => {
  await page.route('**/api/ops/probe', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        provider: 'anthropic',
        modelId: 'claude-sonnet-5',
        latencyMs: 10,
        error: 'anthropic_api_error 401: invalid x-api-key',
      }),
    });
  });

  await page.goto('/?mode=scripted');
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-probe').click();

  await expect(page.getByTestId('operator-probe-fail')).toContainText('401');
});

test('운영자 메뉴의 scripted로 새 체험은 확인 후 URL을 바꾸고 scripted 배지를 보인다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-restart-scripted').click();

  await expect(page.getByTestId('operator-confirm-restart-scripted')).toBeVisible();
  await page.getByTestId('operator-confirm-restart-scripted-yes').click();

  await page.waitForURL(/mode=scripted/);
  await expect(page.getByTestId('mode-badge')).toHaveText('사전 구성 시뮬레이션');
});
