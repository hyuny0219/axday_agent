import { test, expect, type Page } from '@playwright/test';
import { aiAssistantScenario } from '../src/content/scenarios/aiAssistant';
import { buildDraftText } from '../src/domain/draft';

async function reachDiscuss(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
}

test('문구 2개를 선택하면 textarea에 조합되고, 의견 전달로 다음 단계로 넘어간다', async ({
  page,
}) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();

  const textarea = page.getByTestId('draft-editor-textarea');
  await expect(textarea).toHaveValue(buildDraftText(aiAssistantScenario, ['P1', 'P2']));

  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
});

test('문구를 고르지 않고 직접 입력만으로도 의견을 전달할 수 있다', async ({ page }) => {
  await reachDiscuss(page);

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill('작은 범위로 먼저 시작하고 결과를 확인한 뒤 넓히면 좋겠습니다.');

  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
});

test('직접 수정 후 체크를 바꾸면 유지/재구성 확인 UI가 뜨고, 유지를 고르면 입력을 보존한다', async ({
  page,
}) => {
  await reachDiscuss(page);

  const textarea = page.getByTestId('draft-editor-textarea');
  const myOwnText = '제가 직접 정리한 의견입니다.';
  await textarea.fill(myOwnText);

  await page.getByTestId('phrase-card-P1').click();

  const rebuildConfirm = page.getByTestId('rebuild-confirm');
  await expect(rebuildConfirm).toBeVisible();

  await page.getByTestId('rebuild-confirm-keep').click();
  await expect(rebuildConfirm).toBeHidden();
  await expect(textarea).toHaveValue(myOwnText);
});
