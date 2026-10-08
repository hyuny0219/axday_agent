// "발언 흐름" 패널(옛 회의록)의 전체 표시·내부 스크롤(2026-09-28 사용자 결정). 창 고정(최근
// N건)과 한 줄 말줄임을 없앴으므로: 모든 항목이 DOM에 보이고(sr-only 숨김 없음), 문장이
// 가로로 잘리지 않으며, 항목이 패널 높이를 넘으면 목록만 스크롤하고 페이지는 스크롤하지
// 않는다. 새 항목이 오면 최신 항목이 보이도록 목록이 맨 아래에 있다.

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

async function reachVote(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}×${viewport.height}: 발언 흐름은 전문을 다 보여주고 목록만 스크롤한다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await reachVote(page);

    const panel = page.getByTestId('minutes-panel');
    const list = page.getByTestId('minutes-list');
    await expect(panel).toBeVisible();

    // 1) 항목을 하나도 숨기지 않는다 — 건수 배지와 DOM 항목 수가 같고 sr-only 숨김 클래스가 없다.
    const count = Number((await page.getByTestId('minutes-count').innerText()).replace(/\D/g, ''));
    expect(count).toBeGreaterThanOrEqual(9);
    await expect(list.locator('.minutes__entry')).toHaveCount(count);
    await expect(list.locator('.minutes__entry--hidden')).toHaveCount(0);

    // 2) 문장이 가로로 잘리지 않는다(말줄임 없음, 줄바꿈).
    const clippedTexts = await list.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('.minutes__text')].filter(
        (t) => t.scrollWidth > t.clientWidth + 1 || getComputedStyle(t).whiteSpace === 'nowrap',
      ).length,
    );
    expect(clippedTexts).toBe(0);

    // 3) 넘치면 목록만 스크롤하고, 페이지는 스크롤하지 않는다.
    const metrics = await list.evaluate((el) => ({
      listOverflow: el.scrollHeight - el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      atBottom: Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) <= 1,
    }));
    expect(metrics.overflowY).toBe('auto');
    if (metrics.listOverflow > 1) {
      // 4) 새 항목이 온 뒤이므로 최신 항목이 보이도록 맨 아래에 있다.
      expect(metrics.atBottom).toBe(true);
    }
    const pageOverflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollHeight - el.clientHeight;
    });
    expect(pageOverflow).toBeLessThanOrEqual(1);

    // 5) 마지막 항목이 패널 안에 온전히 보인다.
    const lastClipped = await list.evaluate((el) => {
      const entries = el.querySelectorAll('.minutes__entry');
      const last = entries[entries.length - 1]!;
      return Math.round(last.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom);
    });
    expect(lastClipped).toBeLessThanOrEqual(1);
  });
}
