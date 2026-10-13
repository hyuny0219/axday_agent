// T113 다음 할 일 점선. 화면마다 지금 눌러야 할 것 하나에만 `data-next-step`이 붙고(동시에 1개
// 이하), 아무것도 안 누르면 6초 뒤에, 무언가 누르면 즉시 다음 할 일로 옮겨 간다.
// `?focus=off`면 한 번도 붙지 않는다.
import { test, expect, type Page } from './fixtures';

const RING = '[data-next-step]';

async function toBriefing(page: Page, query: string) {
  await page.goto(`/?mode=scripted&coach=off${query}`);
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
}

async function toDiscuss(page: Page, query = '') {
  await toBriefing(page, query);
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
}

test('BRIEFING: 아무것도 안 누르면 6초 뒤 근거 자료 버튼에 점선이 붙는다', async ({ page }) => {
  await toBriefing(page, '');
  await expect(page.getByTestId('open-evidence')).toBeVisible();
  await expect(page.locator(RING)).toHaveCount(0);
  await expect(page.locator(RING)).toHaveCount(1, { timeout: 9000 });
  await expect(page.getByTestId('open-evidence')).toHaveAttribute('data-next-step', '');
});

test('DISCUSS: 입장 → 문구 → 비서실장 → 의견 전달 순서로 점선이 옮겨 가고 전달 뒤에는 0개다', async ({ page }) => {
  await toDiscuss(page);
  await expect(page.getByTestId('discuss-side-select')).toBeVisible();

  // 지금까지 이 화면에서는 아무것도 안 눌렀다 — 6초 힌트로 입장 선택 묶음이 먼저 나온다.
  await expect(page.locator(RING)).toHaveCount(1, { timeout: 9000 });
  await expect(page.getByTestId('discuss-side-select')).toHaveAttribute('data-next-step', '');

  await page.getByTestId('discuss-side-for').click();
  await expect(page.locator(RING)).toHaveCount(1);
  await expect(page.locator('[data-testid^="phrase-card-"][data-next-step]')).toHaveCount(1);

  await page.getByTestId('phrase-card-P1').click();
  await expect(page.locator(RING)).toHaveCount(1);
  await expect(page.getByTestId('assistant-toggle')).toHaveAttribute('data-next-step', '');

  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  // 팝업 안에서는 첫 기능 버튼 하나뿐.
  await expect(page.locator(RING)).toHaveCount(1);
  await expect(page.getByTestId('assistant-action-summary')).toHaveAttribute('data-next-step', '');

  await page.getByTestId('assistant-action-summary').click();
  await expect(page.getByTestId('assistant-done-summary')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('assistant-close').click();
  await expect(page.getByTestId('assistant-panel')).toHaveCount(0);

  await expect(page.locator(RING)).toHaveCount(1);
  await expect(page.getByTestId('submit-opinion')).toHaveAttribute('data-next-step', '');

  await page.getByTestId('submit-opinion').click();
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expect(page.locator(RING)).toHaveCount(0);
});

test('?focus=off면 눌러도 기다려도 점선이 0개다', async ({ page }) => {
  await toDiscuss(page, '&focus=off');
  await page.getByTestId('discuss-side-for').click();
  await expect(page.getByTestId('phrase-card-P1')).toBeVisible();
  await expect(page.locator(RING)).toHaveCount(0);
  await page.waitForTimeout(7000);
  await expect(page.locator(RING)).toHaveCount(0);
});
