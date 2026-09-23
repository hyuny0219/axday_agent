// 화면 맞춤 축소(T51, DESIGN_SPEC.md v1.0 6절 보강). 설계 크기(1200×700)보다 조금 작은
// 뷰포트(노트북 창 모드)에서 조종석 배치를 유지한 채 transform: scale()로 줄이는지
// 검수한다. 실측 사례(2026-09-22): 맥 availHeight 863px → Edge 창 모드 뷰포트 698px로,
// 기존 무스크롤 잠금 임계값(699px)에서 2px 모자라 세로 1열로 풀렸었다.

import { test, expect, type Page } from './fixtures';

async function expectNoPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(
    overflow.scrollHeight <= overflow.clientHeight + 1,
    `${label}: scrollHeight(${overflow.scrollHeight}) <= clientHeight(${overflow.clientHeight}) + 1`,
  ).toBe(true);
}

async function expectInViewport(page: Page, testId: string, label: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${label}: ${testId}가 존재해야 한다`).not.toBeNull();
  expect(viewport, `${label}: 뷰포트 크기를 읽을 수 있어야 한다`).not.toBeNull();
  if (box && viewport) {
    expect(box.y, `${label}: ${testId} 상단이 뷰포트 안`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${label}: ${testId} 하단이 뷰포트 안`).toBeLessThanOrEqual(
      viewport.height + 1,
    );
    expect(box.x + box.width, `${label}: ${testId} 우측이 뷰포트 안`).toBeLessThanOrEqual(
      viewport.width + 1,
    );
  }
}

test('1272×698(설계 크기보다 살짝 작은 노트북 창 모드)에서 조종석 배치를 축소 유지하며 완주한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1272, height: 698 });
  await page.goto('/?mode=scripted');

  // 2열 조종석 배치가 그대로 유지된다(1열로 풀리지 않는다) — 축소 wrapper가
  // data-fit="scale"일 때만 적용되는 상태다.
  const fitMode = await page.locator('.app-scale-wrapper').getAttribute('data-fit');
  expect(fitMode).toBe('scale');

  await expectNoPageScroll(page, 'ATTRACT');
  const startCta = page.getByRole('button', { name: '체험 시작' });
  await expectInViewport(page, 'mode-badge', 'ATTRACT'); // 헤더가 잘리지 않았는지 곁다리 확인
  await startCta.click();

  await expectNoPageScroll(page, 'SELECT');
  await page.getByTestId('scenario-card-ai-assistant').click();
  const enterBoard = page.getByRole('button', { name: '이사회 입장' });
  await expect(enterBoard).toBeInViewport();
  await enterBoard.click();

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expectNoPageScroll(page, 'BRIEFING');
  const hearOpinions = page.getByRole('button', { name: '의견 듣기' });
  await expect(hearOpinions).toBeInViewport();
  await hearOpinions.click();

  await expect(page.getByRole('heading', { name: '임원들의 첫 의견' })).toBeVisible();
  await expectNoPageScroll(page, 'OPINIONS');
  const speakOpinion = page.getByRole('button', { name: '내 의견 말하기' });
  await expect(speakOpinion).toBeInViewport();
  await speakOpinion.click();

  await expectNoPageScroll(page, 'DISCUSS');
  await page.getByTestId('phrase-card-P1').click();

  // 축소 상태에서도 AI 비서실장 드로어가 화면 안(뷰포트 밖으로 잘리지 않음)에 뜬다
  // (드로어는 position:absolute라 축소 컨테이닝 블록의 영향을 받을 수 있다).
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectInViewport(page, 'assistant-panel', 'DISCUSS(비서실장 드로어 열림)');
  await expectNoPageScroll(page, 'DISCUSS(비서실장 드로어 열림)');
  await page.getByTestId('assistant-toggle').click();

  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await expect(submitOpinion).toBeInViewport();
  await submitOpinion.click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS');
  const keepPrevious = page.getByTestId('followup-option-2');
  await expect(keepPrevious).toBeInViewport();
  await keepPrevious.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'MOTION');
  const freezeMotion = page.getByTestId('freeze-motion');
  await expect(freezeMotion).toBeInViewport();
  await freezeMotion.click();

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'VOTE');
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeInViewport();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expectNoPageScroll(page, 'RESULT');
  const endSession = page.getByTestId('end-session');
  await expect(endSession).toBeInViewport();
});

test('1272×698에서 운영 메뉴 패널이 화면 안에 정상 위치한다', async ({ page }) => {
  await page.setViewportSize({ width: 1272, height: 698 });
  await page.goto('/?mode=scripted');

  await page.getByTestId('operator-menu-button').click();
  const panel = page.getByTestId('operator-menu-panel');
  await expect(panel).toBeVisible();
  await expectInViewport(page, 'operator-menu-panel', 'operator-menu');
});

test('1920×1080·1280×720에서는 축소가 걸리지 않는다(natural, scale=1)', async ({ page }) => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/?mode=scripted');
    const fitMode = await page.locator('.app-scale-wrapper').getAttribute('data-fit');
    expect(fitMode, `${size.width}×${size.height}`).toBe('natural');
  }
});
