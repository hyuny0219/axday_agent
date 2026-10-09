// T114: 추가 질문에 답한 뒤(MOTION·VOTE)에는 임원 찬반 방향을 어떤 경로로도 알 수 없고,
// 결과 화면에서 임원 표 네 장이 봉인으로 시작해 한 장씩 뒤집힌 뒤 도장이 찍힌다.
// 애니메이션은 CSS animation-delay라, 테스트는 document.getAnimations()를 멈추고
// currentTime을 직접 옮겨 결정적으로 확인한다(실시간 대기 없음).

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

const EXECS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;

async function goToMotion(page: Page) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  for (const id of ['P1', 'P2', 'P3', 'P4']) {
    await page.getByTestId(`phrase-card-${id}`).click();
  }
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
}

async function expandBoard(page: Page) {
  const toggle = page.getByTestId('persuasion-board-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function expectSealedScreen(page: Page) {
  await expandBoard(page);
  const board = page.getByTestId('persuasion-board');
  const text = (await board.textContent()) ?? '';
  expect(text).not.toContain('→');
  expect(text).not.toContain('설득 완료');
  expect(text).not.toMatch(/설득한 임원 \d/);
  await expect(page.getByTestId('persuasion-board-stance-CFO')).toContainText('가림');
  await expect(page.getByTestId('persuasion-board-note-CFO')).toContainText('답변을 들었습니다 · 결과에서 공개');
  for (const id of EXECS) {
    await expect(page.getByTestId(`stage-mood-${id}`)).toHaveClass(/stage-band__mood--undecided/);
    await expect(page.getByTestId(`exec-mood-label-${id}`)).toContainText('입장 봉인');
  }
}

async function opacityOf(page: Page, testId: string): Promise<number> {
  return page.getByTestId(testId).evaluate((el) => Number(getComputedStyle(el).opacity));
}

test('답변 뒤 MOTION·VOTE는 임원 방향을 봉인하고, 결과에서 한 장씩 뒤집힌 뒤 도장이 찍힌다', async ({ page }) => {
  await goToMotion(page);
  await expectSealedScreen(page);

  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectSealedScreen(page);

  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeAttached();

  // 모든 애니메이션을 멈추고 시각을 직접 옮긴다.
  const seek = (ms: number) =>
    page.evaluate((time) => {
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations === Infinity) continue;
        animation.pause();
        animation.currentTime = time;
      }
    }, ms);

  // t=0: 네 장 모두 봉인, 표 배지·도장·결론은 아직 안 보인다.
  await seek(0);
  for (const id of EXECS) {
    expect(await opacityOf(page, `stage-vote-seal-${id}`)).toBe(1);
    expect(await opacityOf(page, `stage-vote-badge-${id}`)).toBe(0);
  }
  expect(await opacityOf(page, 'result-stamp')).toBe(0);
  expect(await opacityOf(page, 'result-conclusion')).toBe(0);

  // 참가자 표는 처음부터 가리지 않는다(봉인 표시 없음, 0.5초 안에 나타남).
  await seek(600);
  expect(await opacityOf(page, 'stage-vote-badge-PARTICIPANT')).toBe(1);
  await expect(page.getByTestId('stage-vote-seal-PARTICIPANT')).toHaveCount(0);

  // t=1.5초: CEO 한 장만 뒤집혔다(0.9초에 시작, 0.5초 걸림).
  await seek(1500);
  expect(await opacityOf(page, 'stage-vote-badge-CEO')).toBe(1);
  expect(await opacityOf(page, 'stage-vote-seal-CEO')).toBe(0);
  expect(await opacityOf(page, 'stage-vote-seal-CFO')).toBe(1);
  expect(await opacityOf(page, 'stage-vote-badge-CFO')).toBe(0);

  // t=2.6초: CEO·CFO가 열렸고 CAIO·CISO는 아직 봉인이다.
  await seek(2600);
  expect(await opacityOf(page, 'stage-vote-badge-CFO')).toBe(1);
  expect(await opacityOf(page, 'stage-vote-seal-CAIO')).toBe(1);
  expect(await opacityOf(page, 'stage-vote-seal-CISO')).toBe(1);
  expect(await opacityOf(page, 'result-stamp')).toBe(0);

  // 마지막 장(CISO)이 열린 직후에도 도장·집계는 아직이고, 그 뒤에 도장이 나온다.
  await seek(4150);
  expect(await opacityOf(page, 'stage-vote-badge-CISO')).toBe(1);
  expect(await opacityOf(page, 'result-stamp')).toBe(0);
  await seek(6000);
  expect(await opacityOf(page, 'result-stamp')).toBeGreaterThan(0.5);
  expect(await opacityOf(page, 'result-conclusion')).toBe(1);
  expect(await opacityOf(page, 'result-summary-tally')).toBe(1);
});

test('운영자가 클릭하면(skip) 임원 표가 지연 없이 모두 공개된다', async ({ page }) => {
  await goToMotion(page);
  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeAttached();
  await page.mouse.click(5, 5);
  await expect(page.locator('html')).toHaveAttribute('data-result-skip', 'true');
  await expect(page.getByTestId('result-stamp')).toBeVisible();
  await expect.poll(() => opacityOf(page, 'result-stamp')).toBeGreaterThan(0.5);
  for (const id of EXECS) {
    expect(await opacityOf(page, `stage-vote-badge-${id}`)).toBe(1);
    expect(await opacityOf(page, `stage-vote-seal-${id}`)).toBe(0);
  }
});

test.describe('동작 줄이기 설정', () => {
  test.use({ reducedMotion: 'reduce' });

  test('prefers-reduced-motion이면 봉인 없이 즉시 전부 공개된다', async ({ page }) => {
    await goToMotion(page);
    await page.getByTestId('freeze-motion').click();
    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();
    await expect(page.getByTestId('result-conclusion')).toBeAttached();
    await expect.poll(() => opacityOf(page, 'result-stamp')).toBeGreaterThan(0.5);
    for (const id of EXECS) {
      expect(await opacityOf(page, `stage-vote-badge-${id}`)).toBe(1);
      expect(await opacityOf(page, `stage-vote-seal-${id}`)).toBe(0);
    }
  });
});
