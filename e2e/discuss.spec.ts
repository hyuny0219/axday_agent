import { test, expect, type Page } from './fixtures';
import { aiApprovalScenario } from '../src/content/scenarios/aiApproval';
import { buildDraftText } from '../src/domain/draft';

async function reachDiscuss(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
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
  await expect(textarea).toHaveValue(buildDraftText(aiApprovalScenario, ['P1', 'P2']));

  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
});

test('문구를 고르지 않고 직접 입력만으로도 의견을 전달할 수 있다', async ({ page }) => {
  await reachDiscuss(page);

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill('작은 범위로 먼저 시작하고 결과를 확인한 뒤 넓히면 좋겠습니다.');

  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
});

test('"근거 자료 보기" 버튼이 BRIEFING과 같은 팝업을 열고, Esc로 닫으면 버튼으로 포커스가 돌아온다', async ({
  page,
}) => {
  await reachDiscuss(page);

  await expect(page.getByTestId('evidence-card-E1')).toHaveCount(0);
  const openEvidence = page.getByTestId('open-evidence');
  await expect(openEvidence).toBeVisible();

  await openEvidence.click();
  const dialog = page.getByTestId('evidence-dialog');
  await expect(dialog).toBeVisible();
  for (const id of ['E1', 'E2', 'E3', 'E4']) {
    await expect(dialog.getByTestId(`evidence-card-${id}`)).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();
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
