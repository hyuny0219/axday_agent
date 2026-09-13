// 운영 규칙 E2E: 240초 만료 시 원안 자동 고정 안내, 무입력 75초 안내→계속, 90초→대기
// 화면 복귀, 운영자 새 체험 확인, 최종 투표 확정 이중 클릭 방지를 검증한다.
// `?testClock=1`은 window.__boardroom.advance(ms)로 실제로 기다리지 않고 시간을
// 앞당긴다(CLAUDE_IMPLEMENTATION.md 3장 "시간 만료·리셋"·"현장 운영").

import { test, expect, type Page } from './fixtures';

async function advanceClock(page: Page, ms: number): Promise<void> {
  await page.evaluate((advanceMs) => {
    (
      window as unknown as { __boardroom?: { advance(ms: number): void } }
    ).__boardroom?.advance(advanceMs);
  }, ms);
}

/** IDLE_RESET(90초) 기준보다 짧은 간격으로 쪼개 진행하며, 각 간격 사이 키 입력으로
 * 무입력 시계만 갱신한다. 240초 deadline은 touch로 늘어나지 않으므로 만료 판정은
 * 그대로 유지된다. */
async function advanceClockWithoutIdling(page: Page, totalMs: number, stepMs = 60_000): Promise<void> {
  let left = totalMs;
  while (left > 0) {
    const step = Math.min(stepMs, left);
    await advanceClock(page, step);
    left -= step;
    if (left > 0) {
      await page.keyboard.press('Shift');
    }
  }
}

async function enterScenario(page: Page): Promise<void> {
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
}

test('240초 만료 시 결과 화면에 원안 자동 고정 안내가 보인다', async ({ page }) => {
  await page.goto('/?testClock=1&mode=scripted');
  await enterScenario(page);

  await expect(page.getByTestId('briefing-issues')).toBeVisible();

  await advanceClockWithoutIdling(page, 240_000);

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('expired-without-motion-notice')).toBeVisible();
  await expect(page.getByTestId('expired-without-motion-notice')).toContainText(
    '시간 종료로 원안을 집계합니다',
  );
});

test('무입력 75초 안내에서 계속 체험을 누르면 세션이 유지된다', async ({ page }) => {
  await page.goto('/?testClock=1&mode=scripted');
  await enterScenario(page);

  await advanceClock(page, 75_000);

  const idleNotice = page.getByTestId('idle-notice');
  await expect(idleNotice).toBeVisible();
  await expect(idleNotice).toContainText('15초 뒤 처음 화면으로 돌아갑니다');

  await page.getByTestId('idle-notice-continue').click();

  await expect(idleNotice).toBeHidden();
  await expect(page.getByRole('button', { name: '의견 듣기' })).toBeVisible();
});

test('무입력 90초가 지나면 대기 화면으로 복귀한다', async ({ page }) => {
  await page.goto('/?testClock=1&mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();

  await advanceClock(page, 90_000);

  await expect(page.getByRole('button', { name: '체험 시작' })).toBeVisible();
});

test('운영자 메뉴의 새 체험은 확인 후에만 세션을 초기화한다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await enterScenario(page);
  await expect(page.getByTestId('briefing-issues')).toBeVisible();

  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-new-session').click();

  const confirmDialog = page.getByTestId('operator-confirm-new-session');
  await expect(confirmDialog).toBeVisible();

  // 취소하면 세션이 그대로 유지된다.
  await page.getByTestId('operator-confirm-new-session-cancel').click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByTestId('briefing-issues')).toBeVisible();

  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-new-session').click();
  await page.getByTestId('operator-confirm-new-session-yes').click();

  await expect(page.getByRole('button', { name: '체험 시작' })).toBeVisible();
});

test('표만 선택하고 확정하지 않은 채 240초가 지나면 내 표가 UNCAST로 집계된다', async ({
  page,
}) => {
  await page.goto('/?testClock=1&mode=scripted');
  await enterScenario(page);
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('submit-opinion').click();

  await page.getByTestId('followup-option-2').click();
  await page.getByTestId('freeze-motion').click();

  // 표만 선택하고 확정 버튼은 누르지 않는다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();

  await advanceClockWithoutIdling(page, 240_000);

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toContainText('미표결');
  await expect(page.getByTestId('result-seat-unavailable-PARTICIPANT')).toBeVisible();
});

test('새로고침하면 이전 진행 상황이 남지 않고 새 세션으로 시작한다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await enterScenario(page);
  await expect(page.getByTestId('briefing-issues')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: '체험 시작' })).toBeVisible();
  await expect(page.getByTestId('briefing-issues')).toHaveCount(0);
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
