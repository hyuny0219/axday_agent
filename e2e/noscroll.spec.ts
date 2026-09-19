// 무스크롤 검수(DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙", T45). 게임
// 화면처럼 ATTRACT~RESULT 모든 단계에서 document.scrollingElement이 스크롤되지
// 않아야 한다 — 넘치는 내용은 지정된 패널 하나만 안에서 스크롤한다. playwright.config.ts의
// 두 프로젝트(desktop-1080·desktop-720)가 각각 1920×1080·1280×720 뷰포트를 이미
// 고정하므로 이 스펙은 뷰포트를 직접 지정하지 않고 두 프로젝트 모두에서 그대로 돈다.
// DISCUSS는 추천 문구 4개(조건 4개, 실제 시나리오 최대치)를 선택하고 비서실장 드로어까지
// 열어 가장 내용이 많은 상태에서 단언한다(card "비서실장 드로어 열린 상태 포함").

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

test('ATTRACT부터 RESULT까지 모든 단계가 페이지 스크롤 없이 한 화면에 보인다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await expectNoPageScroll(page, 'ATTRACT');

  await page.getByRole('button', { name: '체험 시작' }).click();
  await expectNoPageScroll(page, 'SELECT');

  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expectNoPageScroll(page, 'BRIEFING');

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.getByRole('heading', { name: '임원들의 첫 의견' })).toBeVisible();
  await expectNoPageScroll(page, 'OPINIONS');

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  // 추천 문구 4개(조건 4개, 시나리오 최대치)를 선택해 가장 내용이 많은 상태를 만든다.
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await expectNoPageScroll(page, 'DISCUSS(조건 4개 선택)');

  // 비서실장 드로어를 연 상태도 스크롤이 없어야 한다(오른쪽 열 위에 겹치는 드로어).
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'DISCUSS(비서실장 드로어 열림)');
  await page.getByTestId('assistant-toggle').click();

  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS');

  // 직접 답하기(가장 내용이 많은 경로)를 열고 조건 칩까지 노출한 상태도 확인한다.
  await page.getByTestId('followup-open-editor').click();
  await page.getByTestId('followup-textarea').fill('출처와 기준일 차이를 표시하고 공유 전 담당자 확인 절차를 정합니다.');
  await expectNoPageScroll(page, 'REACTIONS(직접 답하기 + 조건 칩)');

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS(비서실장 드로어 열림)');
  await page.getByTestId('assistant-toggle').click();

  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();

  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'MOTION');

  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectNoPageScroll(page, 'VOTE');

  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expectNoPageScroll(page, 'RESULT');
});
