// T97: DISCUSS는 추천 문구 선택 → AI 비서실장 세 기능 한 번씩 → 의견 전달 순서다.
// 세 기능을 다 쓰기 전에는 '의견 전달'이 닫혀 있고, 닫힌 이유를 힌트(N/3)로 알려 준다.
// 다시 답하기(REACTIONS)는 비서실장 없이도 전달할 수 있다.
import { test, expect, type Page } from './fixtures';

async function reachDiscuss(page: Page, url = '/?mode=scripted') {
  await page.goto(url);
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
}

async function runFeature(page: Page, feature: 'summary' | 'compare' | 'refine') {
  await page.getByTestId(`assistant-action-${feature}`).click();
  await expect(page.getByTestId(`assistant-done-${feature}`)).toBeVisible({ timeout: 15_000 });
  if (feature === 'refine') {
    const keep = page.getByTestId('assistant-keep-original');
    if (await keep.isVisible()) {
      await keep.click();
    }
  }
}

test('문구를 고르기 전에는 비서실장 버튼이 잠기고 힌트가 보이며, 문구를 고르면 열린다', async ({ page }) => {
  await reachDiscuss(page);

  await expect(page.getByTestId('assistant-toggle')).toBeDisabled();
  await expect(page.getByTestId('assistant-toggle-hint')).toContainText('먼저 추천 문구를 골라 주세요');

  await page.getByTestId('phrase-card-P1').click();
  await expect(page.getByTestId('assistant-toggle')).toBeEnabled();
  await expect(page.getByTestId('assistant-toggle-hint')).toHaveCount(0);
});

test('문구만 고르면 의견 전달이 닫혀 있고 힌트가 (0/3)이며 하이라이트는 비서실장 버튼에 있다', async ({ page }) => {
  await reachDiscuss(page);

  await expect(page.getByTestId('submit-opinion')).toBeDisabled();
  await expect(page.getByTestId('discuss-cta-hint')).toContainText('추천 문구를 고르거나 직접 써 주세요');
  // T98: 안내판 현재 칩은 ② 추천 문구이고 문구 목록에도 같은 강조가 걸린다.
  await expect(page.getByTestId('step-chip-phrase')).toHaveAttribute('data-status', 'current');
  await expect(page.getByTestId('step-guide-say')).toContainText('마음에 드는 문구를 눌러 담으세요');

  await page.getByTestId('phrase-card-P1').click();
  await expect(page.getByTestId('step-chip-assistant')).toHaveAttribute('data-status', 'current');
  await expect(page.getByTestId('step-guide-say')).toContainText('AI 비서실장에게 맡기기');
  await expect(page.getByTestId('submit-opinion')).toBeDisabled();
  await expect(page.getByTestId('discuss-cta-hint')).toContainText('AI 비서실장을 먼저 써 보세요 (0/3)');
  await expect(page.getByTestId('assistant-toggle')).toHaveAttribute('data-guide', 'next');
  await expect(page.getByTestId('submit-opinion')).not.toHaveAttribute('data-guide', 'next');
});

test('두 개만 써도 (2/3)이고, 세 개를 다 쓰면 의견 전달이 열리고 하이라이트가 옮겨 간다', async ({ page }) => {
  await reachDiscuss(page);
  await page.getByTestId('phrase-card-P1').click();

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-intro')).toBeVisible();
  await expect(page.getByTestId('assistant-action-summary')).toHaveAttribute('data-guide', 'next');
  await runFeature(page, 'summary');
  await runFeature(page, 'compare');
  await expect(page.getByTestId('assistant-action-refine')).toHaveAttribute('data-guide', 'next');
  await expect(page.getByTestId('assistant-intro-done')).toHaveCount(0);
  await page.getByTestId('assistant-close').click();

  await expect(page.getByTestId('discuss-cta-hint')).toContainText('(2/3)');
  await expect(page.getByTestId('submit-opinion')).toBeDisabled();
  // T98: 안내판 ③ 칩의 체크가 팝업 체크와 같은 상태를 보여 준다.
  await expect(page.getByTestId('step-check-summary')).toHaveAttribute('data-checked', 'true');
  await expect(page.getByTestId('step-check-compare')).toHaveAttribute('data-checked', 'true');
  await expect(page.getByTestId('step-check-refine')).toHaveAttribute('data-checked', 'false');

  await page.getByTestId('assistant-toggle').click();
  await runFeature(page, 'refine');
  await expect(page.getByTestId('assistant-intro-done')).toContainText('이제 팝업을 닫고 의견을 전달하세요');
  await expect(page.getByTestId('assistant-close')).toHaveAttribute('data-guide', 'next');
  await page.getByTestId('assistant-close').click();

  await expect(page.getByTestId('submit-opinion')).toBeEnabled();
  await expect(page.getByTestId('submit-opinion')).toHaveAttribute('data-guide', 'next');
  await expect(page.getByTestId('step-chip-submit')).toHaveAttribute('data-status', 'current');
  await expect(page.getByTestId('step-guide-say')).toContainText('의견 전달');
  await expect(page.getByTestId('discuss-cta-hint')).toHaveCount(0);
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
});

test('팝업 첫 화면은 소개와 체크가 스크롤 없이 화면 안에 들어온다', async ({ page }) => {
  await reachDiscuss(page);
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('assistant-toggle').click();

  const intro = page.getByTestId('assistant-intro');
  await expect(intro).toBeVisible();
  await expect(page.getByTestId('assistant-check-summary')).toHaveText('☐');

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const testId of ['assistant-panel', 'assistant-intro', 'assistant-action-refine', 'assistant-close']) {
    // 팝업 등장 애니메이션(8px 이동)이 끝난 뒤의 위치를 잰다.
    await page.getByTestId(testId).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} 위치를 알 수 없다`).not.toBeNull();
    if (box && viewport) {
      expect(box.y, `${testId} 위쪽이 잘렸다`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${testId} 아래쪽이 잘렸다`).toBeLessThanOrEqual(viewport.height + 1);
    }
  }
  const body = page.locator('.dialog-shell__body');
  const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(overflow, '팝업 본문이 첫 화면에서 스크롤된다').toBeLessThanOrEqual(1);
});

test('live(mock)에서 내 발언 정리가 실패해도 사용으로 세어져 의견 전달이 열린다', async ({ page }) => {
  await page.route('**/api/assistant/refine', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' }),
  );
  await reachDiscuss(page, '/');
  await page.getByTestId('phrase-card-P1').click();

  await page.getByTestId('assistant-toggle').click();
  await runFeature(page, 'summary');
  await runFeature(page, 'compare');
  await page.getByTestId('assistant-action-refine').click();
  await expect(page.getByTestId('assistant-error')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('assistant-done-refine')).toBeVisible();
  await page.getByTestId('assistant-close').click();

  await expect(page.getByTestId('submit-opinion')).toBeEnabled();
});

test('다시 답하기(REACTIONS)는 비서실장을 쓰지 않아도 전달할 수 있다', async ({ page }) => {
  await reachDiscuss(page);
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('assistant-toggle').click();
  await runFeature(page, 'summary');
  await runFeature(page, 'compare');
  await runFeature(page, 'refine');
  await page.getByTestId('assistant-close').click();
  await page.getByTestId('submit-opinion').click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  await expect(page.getByTestId('submit-followup')).toBeEnabled();
  await expect(page.getByTestId('discuss-cta-hint')).toHaveCount(0);
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
});
