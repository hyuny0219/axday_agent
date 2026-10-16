// T92(사용자 지적 "반대 의견을 작성해도 AI 임원들 및 프로그램 진행이 찬성 쪽으로 몰고
// 가는 경향"): 참가자가 반대 입장을 고르고 완주하는 경로가 "찬성으로 몰리지" 않고
// 실제로 다르게 흘러가는지 scripted로 확인한다. T137: 순수 반대(근거 없음)는 원안대로 가결(찬성 3),
// 반대 근거(N1)는 안건을 바꾸지 않고 "반대 사유"로 적히는지 본다. 반대 근거 전체 경로는 objection.spec.ts.
import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';
import { aiApprovalScenario } from '../src/content/scenarios/aiApproval';

async function reachDiscuss(page: Page) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-against').click();
}

test('순수 반대(조건 없음, N4)는 반응 문구가 임원별로 다르고, 부결까지 이어진다', async ({
  page,
}) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-N4').click();
  await tryAllAssistantFeatures(page);
  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  // REACTIONS "반응 듣기": 임원 4명이 "앞서 말씀드린 입장 그대로입니다"만 반복하지
  // 않고, N4("AI 에이전트에게 맡기는 것 자체에 반대")의 핵심 주장에 한 문장씩 답한다
  // (oppositionReactions, aiApproval.ts).
  for (const memberId of ['CEO', 'CFO', 'CAIO', 'CISO'] as const) {
    const card = page.getByTestId(`reaction-card-${memberId}`);
    await expect(card).not.toContainText('앞서 말씀드린 입장 그대로입니다');
    await expect(card).toContainText(aiApprovalScenario.oppositionReactions?.[memberId] ?? '__missing__');
  }

  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('keep-previous-answer').click();

  // MOTION: 조건이 없으므로 원안 그대로 — "요구한 조건" 문구는 보이지 않는다.
  await expect(page.getByTestId('motion-card')).toContainText(aiApprovalScenario.motionBreakdown.proposal);
  await expect(page.getByText('이사님이 요구한 조건')).toHaveCount(0);
  await page.getByTestId('freeze-motion').click();

  // VOTE: 참가자도 반대(NO)로 완주한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();

  // RESULT(T137): 근거 없이 반대만 하면 고민 중이던 CAIO·CISO가 "반대 근거가 약하다"며 원안대로
  // 찬성해 찬성 3 · 반대 2로 가결된다 — 반대 참가자도 근거를 대야 임원을 설득한다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 3 · 반대 2');
});

test('반대 근거(N1)는 안건 문구를 바꾸지 않고 "반대 사유"로 적힌다(T137)', async ({ page }) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-N1').click();
  await tryAllAssistantFeatures(page);
  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('keep-previous-answer').click();

  await expect(page.getByText('이사님이 요구한 조건')).toHaveCount(0);
  await expect(page.getByTestId('motion-card')).not.toContainText('아래 조건');
  await expect(page.getByTestId('motion-card')).toContainText(aiApprovalScenario.motionBreakdown.proposal);
  await expect(page.getByTestId('motion-objections')).toContainText('승인 이유를 확인할 수 없음');
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-objections')).toContainText('반대 사유');
  await expect(page.getByTestId('vote-motion-conditions')).toHaveCount(0);
});
