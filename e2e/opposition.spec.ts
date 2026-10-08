// T92(사용자 지적 "반대 의견을 작성해도 AI 임원들 및 프로그램 진행이 찬성 쪽으로 몰고
// 가는 경향"): 참가자가 반대 입장을 고르고 완주하는 경로가 "찬성으로 몰리지" 않고
// 실제로 다르게 흘러가는지 scripted로 확인한다. 순수 반대(조건 없음)는 부결까지,
// 조건부 반대(조건 1개)는 화면 문구가 "이사님이 요구한 조건"으로 바뀌는지까지 본다.
import { test, expect, type Page } from './fixtures';
import { useAssistantAllFeatures } from './helpers/assistant';
import { aiApprovalScenario } from '../src/content/scenarios/aiApproval';

async function reachDiscuss(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-against').click();
}

test('순수 반대(조건 없음, N4)는 반응 문구가 임원별로 다르고, 부결까지 이어진다', async ({
  page,
}) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-N4').click();
  await useAssistantAllFeatures(page);
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

  // RESULT: 임원 4명 중 CEO만 찬성 기본값이라(안건① voteRules) 조건 없이는 과반에
  // 못 미쳐 부결된다 — "반대 의견을 작성해도 찬성 쪽으로 몰리는" 문제가 scripted
  // 엔진에서는 재현되지 않음을 고정한다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-summary-tally')).toContainText('반대');
  await expect(page.getByTestId('result-summary-decisive')).toContainText(
    '이사님의 반대가 이사회 결론이 되었습니다',
  );
});

test('조건부 반대(N1, REVIEW)는 화면 문구가 "이사님이 요구한 조건"으로 바뀐다', async ({
  page,
}) => {
  await reachDiscuss(page);

  await page.getByTestId('phrase-card-N1').click();
  await useAssistantAllFeatures(page);
  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();

  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('keep-previous-answer').click();

  await expect(page.getByText('이사님이 요구한 조건 1')).toBeVisible();
  await expect(page.getByTestId('motion-card')).toContainText(
    '이사님은 원안에 반대하며, 아래 조건을 요구합니다',
  );
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-conditions')).toContainText('이사님이 요구한 조건');
});
