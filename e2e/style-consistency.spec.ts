// T101: 스타일·집계 일관성. 비서실장 팝업 버튼이 줄 안 .cta 규칙에 키워지지 않는지,
// 입장을 고르기 전 현황판이 찬성을 목표로 가정하지 않는지, 720에서 "넘어가기"가 읽히는지
// 확인한다.
import { test, expect, type Page } from './fixtures';

async function reachDiscuss(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
}

async function width(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  return box?.width ?? 0;
}

test('입장을 고르기 전에는 설득 현황판이 한 줄 안내만 보이고, 고르면 설득 숫자가 보인다', async ({ page }) => {
  await reachDiscuss(page);
  await expect(page.getByTestId('persuasion-board-pending')).toContainText('입장을 고르면 설득 목표가 보입니다');
  await expect(page.getByTestId('persuasion-board-count')).toHaveCount(0);

  await page.getByTestId('discuss-side-for').click();
  await expect(page.getByTestId('persuasion-board-pending')).toHaveCount(0);
  // 안건① 찬성: CEO가 처음부터 같은 편이라 분모는 3이다.
  await expect(page.getByTestId('persuasion-board-count')).toHaveText('설득한 임원 0/3');
});

test('비서실장 팝업의 닫기 버튼은 근거 자료 팝업 닫기와 같은 크기이고, 열기 토글은 줄 안 CTA보다 작다', async ({ page }) => {
  await reachDiscuss(page);
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();

  const toggleWidth = await width(page, 'assistant-toggle');
  const submitWidth = await width(page, 'submit-opinion');
  expect(toggleWidth).toBeLessThan(submitWidth);

  await page.getByTestId('open-evidence').click();
  const evidenceCloseWidth = await width(page, 'evidence-dialog-close');
  await page.keyboard.press('Escape');

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  const assistantCloseWidth = await width(page, 'assistant-close');
  expect(Math.abs(assistantCloseWidth - evidenceCloseWidth)).toBeLessThanOrEqual(2);
});
