// 부스 자동 진행(T143~T146): 자동이 켜진 채 참가자 클릭만으로 RESULT 성공 엔딩까지 가는지 확인한다.
// 두 안건 × 찬성·반대. 자동 동작은 testClock(?testClock=1)으로 시계를 앞으로 돌려 기다리지 않고 넘긴다.
// 참가자 클릭: 시작 · 안내 확인 · 안건 카드 · 의견 듣기 · 내 의견 쓰러 가기 · 찬성/반대 · 의견 전달 ·
// 답변 전달 · 이 안건으로 표결 · 표결 도장 · 표결 확정 · 마무리.
import { test, expect, type Page } from './fixtures';

type Side = 'for' | 'against';
type ScenarioId = 'ai-approval' | 'experience-first';

/** 자동 동작을 가짜 시계로 조금씩 앞으로 돌려 끝낸다(동작마다 화면이 반응할 틈을 주려고 한 번에 건너뛰지 않는다). 참가자 차례(CLICK 알약)까지. */
async function skipAuto(page: Page) {
  await page.waitForFunction(() => document.body.hasAttribute('data-auto-running'));
  const pill = page.getByTestId('auto-pill');
  for (let i = 0; i < 200 && !(await pill.isVisible()); i += 1) {
    await page.evaluate(() => {
      (window as unknown as { __boardroom: { advance(ms: number): void } }).__boardroom.advance(700);
    });
    await page.waitForTimeout(120);
  }
  await expect(pill).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-auto-running', '');
}

async function expectNoPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(overflow.scrollHeight, label).toBeLessThanOrEqual(overflow.clientHeight + 1);
}

// 코치(진행 도우미)는 끄지 않는다 — 자동이 켜져 있으면 겹치지 않게 뜨지 않아야 한다.
async function startAuto(page: Page, scenarioId: ScenarioId, query = 'testClock=1&auto=on') {
  await page.goto(`/?${query}`);
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId(`scenario-card-${scenarioId}`).click();
}

async function playAutoToResult(page: Page, scenarioId: ScenarioId, side: Side) {
  await startAuto(page, scenarioId);

  // BRIEFING: 근거 자료 열기는 자동. 참가자는 '의견 듣기'만 누른다.
  await skipAuto(page);
  await expect(page.getByTestId('auto-pill')).toContainText('CLICK 눌러서');
  await page.getByRole('button', { name: '의견 듣기' }).click();

  // OPINIONS: 임원 의견 강조는 자동.
  await skipAuto(page);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();

  // DISCUSS: 입장만 고르면 추천 문구·비서실장 ①②③이 자동. 코치·체크리스트는 뜨지 않는다.
  await expect(page.getByTestId('auto-pill')).toContainText('찬성이나 반대');
  await page.getByTestId(`discuss-side-${side}`).click();
  await skipAuto(page);
  await expect(page.getByTestId('auto-pill')).toContainText('의견 전달');
  await page.getByTestId('submit-opinion').click();

  // REACTIONS: 1/2 → 2/2 이동과 추가 답변 담기는 자동. 참가자는 '답변 전달'만 누른다.
  await skipAuto(page);
  await expect(page.getByTestId('auto-pill')).toContainText('답변 전달');
  await page.getByTestId('submit-followup').click();

  // MOTION: 조건이 안건에 반영되는 모습은 자동.
  await skipAuto(page);
  await page.getByTestId('freeze-motion').click();

  // VOTE: 자동 없음. 도장과 확정은 참가자가 누른다.
  await expect(page.getByTestId('auto-pill')).toContainText('도장');
  await page.getByTestId(side === 'for' ? 'vote-radio-YES' : 'vote-radio-NO').check();
  await expect(page.getByTestId('auto-pill')).toContainText('표결 확정');
  await page.getByTestId('confirm-vote').click();

  // RESULT: 표 공개 연출 뒤 '마무리'. 내 쪽 같은 표가 3석 이상이면 성공.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-finish')).toBeVisible({ timeout: 20_000 });
  const tally = await page.getByTestId('result-summary-tally').innerText();
  const match = tally.match(/찬성\s*(\d+)\s*·\s*반대\s*(\d+)/);
  expect(match, `표 요약: ${tally}`).not.toBeNull();
  const mine = Number(side === 'for' ? match?.[1] : match?.[2]);
  expect(mine, `표 요약: ${tally}`).toBeGreaterThanOrEqual(3);
  await page.getByTestId('result-finish').click();
  await expect(page.getByTestId('ending-stamp')).toHaveText('성공');
}

for (const [scenarioId, side] of [
  ['ai-approval', 'for'],
  ['ai-approval', 'against'],
  ['experience-first', 'for'],
  ['experience-first', 'against'],
] as const) {
  test(`자동 진행: 안건 ${scenarioId} ${side === 'for' ? '찬성' : '반대'} — 참가자 클릭만으로 RESULT 성공`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await playAutoToResult(page, scenarioId, side);
  });
}

test('자동 중에는 자막 띠가 보이고 화면 조작이 막히며, 코치와 DISCUSS 체크리스트는 뜨지 않는다', async ({ page }) => {
  await startAuto(page, 'ai-approval');
  await page.waitForFunction(() => document.body.hasAttribute('data-auto-running'));
  await page.evaluate(() => {
    (window as unknown as { __boardroom: { advance(ms: number): void } }).__boardroom.advance(1_500);
  });
  await expect(page.getByTestId('auto-bar')).toContainText('AI 비서실장 진행 중');
  await expect(page.locator('[data-live-screen]')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expectNoPageScroll(page, 'BRIEFING(자동 중)');
});

test('운영 메뉴에서 자동 진행을 끄면 지금처럼 직접 진행한다(자막 띠·알약 없음)', async ({ page }) => {
  await startAuto(page, 'ai-approval', 'testClock=1&auto=on&coach=off');
  await page.waitForFunction(() => document.body.hasAttribute('data-auto-running'));
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-toggle-auto').click();

  await expect(page.getByTestId('auto-bar')).toHaveCount(0);
  await expect(page.getByTestId('auto-pill')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-auto-running', '');
  // 직접 진행: 자료를 직접 열어 닫아야 '의견 듣기'가 열린다.
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.getByTestId('auto-bar')).toHaveCount(0);
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await page.getByTestId('operator-menu-button').click();
  await expect(page.getByTestId('operator-toggle-auto')).toContainText('자동 진행 켜기');
});
