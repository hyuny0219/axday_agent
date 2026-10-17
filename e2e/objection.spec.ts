// T137(반대 입장 대칭 설계): 반대 참가자가 근거 자료를 짚는 "반대 근거"(빨강)로 임원을 반대로 설득한다.
// 반대 근거는 안건을 수정하지 않고 "반대 사유"로 나란히 적힌다. T138: 반대 쪽에는 함정 카드가 없고, 첫 의견만으로는 임원이 확정되지 않는다(추가 답변 뒤 확정).
// 1080·720 두 프로젝트 모두에서 페이지 스크롤이 없어야 한다.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';
import { aiApprovalScenario } from '../src/content/scenarios/aiApproval';

async function reachDiscussAgainst(page: Page, scenarioId: 'ai-approval' | 'experience-first') {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId(`scenario-card-${scenarioId}`).click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-against').click();
}

async function expectNoPageScroll(page: Page, label: string) {
  // 사용자 지시(T137): 화면 어디에도 "반대 근거"·"반대 사유"라는 말을 쓰지 않는다(반대 쪽 카드도 "조건", 색만 다르다).
  const text = (await page.locator('body').innerText()) + (await page.locator('body').textContent());
  expect(text, `${label}: 금지 표기`).not.toMatch(/반대 근거|반대 사유/);
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(
    overflow.scrollHeight <= overflow.clientHeight + 1,
    `${label}: scrollHeight(${overflow.scrollHeight}) <= clientHeight(${overflow.clientHeight}) + 1`,
  ).toBe(true);
}

async function submitFirstOpinion(page: Page) {
  await tryAllAssistantFeatures(page);
  const submit = page.getByTestId('submit-opinion');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByTestId('reaction-card-CEO')).toBeVisible();
}

test('반대 근거 카드·칩은 빨강이고 자료 이름이 붙는다(안건 ①)', async ({ page }) => {
  await reachDiscussAgainst(page, 'ai-approval');
  await expectNoPageScroll(page, 'DISCUSS(반대 입장, 추천 문구)');

  // 추천 문구 카드에는 조건 표시 라벨이 없다(번호+문장만, 찬성·반대·함정 모두).
  await expect(page.locator('[data-testid^="phrase-tag-"]')).toHaveCount(0);
  await expect(page.getByTestId('phrase-card-N1')).toHaveClass(/phrase-card--objection/);
  await expect(page.getByTestId('phrase-card-N1')).toHaveText(/^자동 승인한 건은.*알 수 없습니다\.$/);

  await page.getByTestId('phrase-card-N1').click();
  await page.getByTestId('phrase-card-N2').click();
  await expect(page.getByTestId('condition-chips-label')).toHaveText('조건');
  const chip = page.getByTestId('condition-chip-AG_AUDIT');
  await expect(chip).toHaveClass(/condition-chip--objection/);
  await expect(chip).toHaveClass(/condition-chip--accepted/);
  await expect(chip).toContainText('승인 이유를 확인할 수 없음');
  // 빨강: 칩 글자색의 빨강 성분이 파랑·초록보다 크다.
  const rgb = await chip.evaluate((el) => getComputedStyle(el).color);
  const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number);
  expect(r, `칩 글자색 ${rgb}`).toBeGreaterThan((g ?? 0) + 40);
  expect(r, `칩 글자색 ${rgb}`).toBeGreaterThan((b ?? 0) + 40);

  // 비서실장 드로어까지 연 가장 내용이 많은 상태에서도 스크롤이 없다.
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expectNoPageScroll(page, 'DISCUSS(비서실장 드로어)');
});

test('반대 근거 둘 + 추가 답변으로 성공한다: 안건은 원안 그대로, 반대 사유로 나란히 적힌다(안건 ①)', async ({ page }) => {
  await reachDiscussAgainst(page, 'ai-approval');
  await page.getByTestId('phrase-card-N1').click();
  await submitFirstOpinion(page);

  // 반응 듣기: 근거가 겨눈 CAIO는 "고민 중 → 반대"로 기울고, 겨누지 않은 CISO는 그대로 고민 중이다.
  await expect(page.getByTestId('reaction-card-badge-CAIO')).toContainText('고민 중 → 반대 · 답하면 확정');
  await expect(page.getByTestId('reaction-card-CAIO')).toContainText('하나만 더 묻겠습니다');
  await expect(page.getByTestId('reaction-card-badge-CISO')).not.toContainText('답하면 확정');
  await expectNoPageScroll(page, 'REACTIONS(듣기, 반대 입장)');

  await page.getByTestId('reactions-advance').click();
  // 추가 질문은 반대 근거를 묻는다. 답변 카드는 반대 근거이고 첫 의견에서 고른 문장은 숨긴다.
  await expect(page.getByTestId('followup-option-5')).toHaveCount(0);
  await expect(page.getByTestId('phrase-tag-6')).toHaveCount(0);
  await expectNoPageScroll(page, 'REACTIONS(답하기, 반대 근거 카드)');
  await page.getByTestId('followup-option-6').click();
  await expect(page.getByTestId('condition-chip-AG_TRUST')).toHaveClass(/condition-chip--objection/);
  await expectNoPageScroll(page, 'REACTIONS(답하기, 칩 선택)');
  await page.getByTestId('submit-followup').click();

  // MOTION: 안건 문장은 원안 그대로("아래 조건을 요구합니다" 없음), 반대 사유가 빨강 목록으로 나란히 적힌다.
  await expect(page.getByTestId('motion-card')).toContainText(aiApprovalScenario.motionBreakdown.proposal);
  await expect(page.getByTestId('motion-card')).not.toContainText('아래 조건');
  await expect(page.getByTestId('motion-card')).toContainText('처음 안');
  await expect(page.getByTestId('motion-objections')).toContainText('승인 이유를 확인할 수 없음');
  await expect(page.getByTestId('motion-objections')).toContainText('믿지 못해 책임이 흐려짐');
  await expect(page.getByTestId('motion-conditions')).toHaveCount(0);
  await expectNoPageScroll(page, 'MOTION(반대 사유)');
  await page.getByTestId('freeze-motion').click();

  await expect(page.getByTestId('vote-motion-objections')).toContainText('이사님이 요구한 조건');
  await expect(page.getByTestId('vote-motion-conditions')).toHaveCount(0);
  await expectNoPageScroll(page, 'VOTE(반대 사유)');
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();

  // RESULT: CAIO·CISO가 반대로 돌아 CEO만 찬성이다(반대 4석 = 성공). 도장은 "조건부 가결"이 아니다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 1 · 반대 4');
  await expect(page.getByTestId('result-summary-objections')).toContainText('이사님이 요구한 조건');
  await expect(page.getByTestId('result-summary-objections')).toContainText('승인 이유를 확인할 수 없음');
  await expect(page.getByTestId('result-summary-conditions')).toContainText('조건 없이 처음 안 그대로 표결');
  await expect(page.getByTestId('result-stamp')).not.toContainText('조건부');
  await expectNoPageScroll(page, 'RESULT(반대 근거)');
});

test('반대 근거를 하나도 고르지 않으면 고민 중 임원이 원안대로 찬성해 실패한다(안건 ①)', async ({ page }) => {
  await reachDiscussAgainst(page, 'ai-approval');
  await page.getByTestId('phrase-card-N4').click();
  await submitFirstOpinion(page);
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('keep-previous-answer').click();
  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();
  // CEO·CAIO·CISO가 찬성(근거가 약하면 원안대로), 반대는 CFO와 나뿐이다.
  await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 3 · 반대 2');
});

test('반대 첫 의견에서 조건을 모두 맞춰도 임원은 기울기만 하고, 넘어가면 처음 입장으로 돌아간다(T138)', async ({ page }) => {
  await reachDiscussAgainst(page, 'ai-approval');
  // 반대 쪽에는 함정 카드가 없다: 조건 카드 둘(N1·N2) + 순수 반대(N4) + 요청(P6)만 있다.
  await expect(page.locator('[data-testid^="phrase-card-"]')).toHaveCount(4);
  await expect(page.getByTestId('phrase-card-N3')).toHaveCount(0);
  await page.getByTestId('phrase-card-N1').click();
  await page.getByTestId('phrase-card-N2').click();
  await submitFirstOpinion(page);
  // 겨눈 CAIO·CISO는 "반대 쪽?" 기울음까지만이고 확정이 아니다. 겨누지 않은 CEO는 찬성 그대로다.
  await expect(page.getByTestId('exec-mood-label-CAIO')).toHaveText('반대 쪽?');
  await expect(page.getByTestId('exec-mood-label-CISO')).toHaveText('반대 쪽?');
  await expect(page.getByTestId('exec-mood-label-CEO')).toHaveText('찬성');
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('keep-previous-answer').click();
  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();
  // 답하지 않고 넘어가면 처음 입장으로 돌아가 찬성 3 · 반대 2다(조건을 잘 맞춰도 첫 의견만으로는 성공하지 않는다).
  await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 3 · 반대 2');
});

test('안건 ②도 같은 구조: 반대 근거 + 추가 답변으로 성공하고 안건은 원안 그대로다', async ({ page }) => {
  await reachDiscussAgainst(page, 'experience-first');
  await page.getByTestId('phrase-card-N1').click();
  await submitFirstOpinion(page);
  await page.getByTestId('reactions-advance').click();
  // options: 0~4 FOR, 5 AG_WARN(첫 의견과 같아 숨김), 6 AG_WHY, 7 AG_SPLIT, 8 BOTH
  await page.getByTestId('followup-option-7').click();
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-objections')).toContainText('경고를 넘길 핑계가 생김');
  await expect(page.getByTestId('motion-objections')).toContainText('반반인데 한쪽만 앞세움');
  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();
  // CEO·CFO·CAIO가 반대, CISO만 설득되지 않아 원안대로 찬성한다.
  await expect(page.getByTestId('result-summary-tally')).toContainText('찬성 1 · 반대 4');
  await expectNoPageScroll(page, 'RESULT(안건 ②, 반대 근거)');
});

// T137 디자인 검수용 스크린샷(UPDATE_SCREENSHOTS=1일 때만 docs/screenshots, 평소엔 test-results).
const OUTPUT_ROOT = process.env.UPDATE_SCREENSHOTS
  ? path.join('docs', 'screenshots')
  : path.join('test-results', 'screenshots');

async function capture(page: Page, projectName: string, screenName: string) {
  const dir = path.join(OUTPUT_ROOT, projectName);
  mkdirSync(dir, { recursive: true });
  await page.locator('.screen').evaluateAll((elements) =>
    Promise.all(elements.flatMap((el) => el.getAnimations().map((a) => a.finished))),
  );
  await page.screenshot({ path: path.join(dir, `${screenName}.png`), animations: 'disabled' });
}

test('반대 근거 경로를 화면별로 캡처한다(DISCUSS·REACTIONS·MOTION·RESULT)', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const project = testInfo.project.name;
  await reachDiscussAgainst(page, 'ai-approval');
  await page.getByTestId('phrase-card-N1').click();
  await page.getByTestId('phrase-card-N2').click();
  await capture(page, project, 't137-discuss-against');
  await submitFirstOpinion(page);
  await capture(page, project, 't137-reactions-listen-against');
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-7').click();
  await capture(page, project, 't137-reactions-answer-against');
  await page.getByTestId('submit-followup').click();
  await capture(page, project, 't137-motion-against');
  await page.getByTestId('freeze-motion').click();
  await capture(page, project, 't137-vote-against');
  await page.getByTestId('vote-radio-NO').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-summary-objections')).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  await capture(page, project, 't137-result-against');
});
