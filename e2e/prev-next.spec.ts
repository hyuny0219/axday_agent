// T126: '◀ 이전'·'다음 ▶' 지난 화면 보기(읽기 전용). 세션은 그대로 두고 화면만 지난 단계로 돌려 본다.
// 핵심 불변식: 보기 모드에서 입력·제출이 막히고, 세션 단계가 바뀌지 않고, live 요청이 새로 나가지
// 않으며, RESULT에서는 버튼이 없다. 720에서도 페이지 스크롤이 생기지 않는다.

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

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

async function toDiscuss(page: Page, query: string) {
  await page.goto(query);
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
}

const OPINION_TEXT = '작은 범위로 먼저 시작하고 결과를 확인한 뒤 넓히면 좋겠습니다.';

test('의견 전달 뒤 이전으로 BRIEFING·OPINIONS·DISCUSS를 읽기 전용으로 보고, 다음으로 복귀한다', async ({
  page,
}) => {
  await toDiscuss(page, '/?mode=scripted&coach=off');
  // 지금 화면(DISCUSS)에서는 다음이 비활성이다 — 건너뛰기 금지.
  await expect(page.getByTestId('view-next')).toBeDisabled();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('draft-editor-textarea').fill(OPINION_TEXT);
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();

  // REACTIONS 반응 듣기(지금 화면).
  await expect(page.getByTestId('reactions-advance')).toBeVisible();
  await expect(page.getByTestId('view-banner')).toHaveCount(0);
  await expect(page.getByTestId('view-next')).toBeDisabled();
  await expect(page.getByTestId('view-prev')).toBeEnabled();

  // ◀ 이전 → DISCUSS: 전달한 의견이 그대로 보이고, 입력·제출은 막힌다.
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('view-banner')).toBeVisible();
  await expect(page.getByTestId('draft-editor-textarea')).toHaveValue(OPINION_TEXT);
  await expect(page.getByTestId('submit-opinion')).toBeDisabled();
  await expect(page.locator('[data-past-screen] .app-body__actions')).toHaveAttribute('inert', '');
  // 오른쪽 열은 '근거 자료 보기'만 열려 있고 나머지(입장·문구 카드)는 막혀 있다.
  await expect(
    page.getByTestId('discuss-side-for').evaluate((element) => element.closest('[inert]') !== null),
  ).resolves.toBe(true);
  await expect(
    page.getByTestId('open-evidence').evaluate((element) => element.closest('[inert]') === null),
  ).resolves.toBe(true);
  await expect(page.getByTestId('discuss-side-for')).toHaveAttribute('aria-pressed', 'true');
  await expectNoPageScroll(page, 'DISCUSS 보기');
  await page.screenshot({ path: 'test-results/prev-next-discuss-view.png' });
  // 입력을 시도해도 값이 바뀌지 않는다(inert).
  await page.getByTestId('draft-editor-textarea').click({ force: true }).catch(() => undefined);
  await page.keyboard.type('수정 시도');
  await expect(page.getByTestId('draft-editor-textarea')).toHaveValue(OPINION_TEXT);

  // ◀ 이전 → OPINIONS: 임원 카드 4장이 한꺼번에 보인다.
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('opinions-next')).toBeVisible();
  await expect(page.locator('.opinions-screen__cards > *')).toHaveCount(4);
  await expectNoPageScroll(page, 'OPINIONS 보기');

  // ◀ 이전 → BRIEFING, 그 앞은 없다(SELECT로 가지 않는다).
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('view-prev')).toBeDisabled();
  await expectNoPageScroll(page, 'BRIEFING 보기');

  // ▶ 다음 ×2 → DISCUSS, 한 번 더 → 지금 화면으로 복귀(띠가 사라진다).
  await page.getByTestId('view-next').click();
  await page.getByTestId('view-next').click();
  await expect(page.getByTestId('draft-editor-textarea')).toHaveValue(OPINION_TEXT);
  await page.getByTestId('view-next').click();
  await expect(page.getByTestId('view-banner')).toHaveCount(0);
  await expect(page.getByTestId('reactions-advance')).toBeEnabled();
  await expect(page.locator('[data-past-screen]')).toHaveCount(0);

  // '지금 화면으로' 버튼도 같은 복귀다.
  await page.getByTestId('view-prev').click();
  await page.getByTestId('view-exit').click();
  await expect(page.getByTestId('view-banner')).toHaveCount(0);

  // 이어서 정상 진행: 답하고 MOTION → 이전으로 다시 답하기·반응 듣기를 본다.
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-textarea').fill('진행 상황을 계속 공유해 주세요.');
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();

  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('followup-textarea')).toHaveValue('진행 상황을 계속 공유해 주세요.');
  await expect(page.getByTestId('submit-followup')).toBeDisabled();
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('reactions-advance')).toBeVisible();
  await expectNoPageScroll(page, 'REACTIONS 반응 듣기 보기');
  await page.getByTestId('view-exit').click();

  // 보기 중에는 세션이 그대로라 MOTION 표결을 그대로 이어 갈 수 있다.
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('freeze-motion')).toBeVisible();
  await page.getByTestId('view-exit').click();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();

  // RESULT: 이전·다음 버튼이 없다(공개 연출 보호).
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('view-prev')).toHaveCount(0);
  await expect(page.getByTestId('view-next')).toHaveCount(0);
});

test('live: 지난 화면을 보는 동안 /api 요청이 새로 나가지 않고, 돌아와 표결이 이어진다', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') {
      requests.push(new URL(request.url()).pathname);
    }
  });
  await toDiscuss(page, '/?coach=off');
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await expect(page.locator('[data-testid^="statement-card-"]')).toHaveCount(4, { timeout: 10_000 });
  await page.getByTestId('keep-previous-answer').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('freeze-motion')).toBeEnabled();
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  // 표결 요청이 settle될 시간을 준 뒤 기준선을 잡는다.
  await page.waitForTimeout(1500);
  const before = requests.length;

  // VOTE에서 끝까지 거슬러 올라갔다 돌아온다. 화면마다 읽기 전용이다.
  for (let step = 0; step < 6; step += 1) {
    if (await page.getByTestId('view-prev').isDisabled()) break;
    await page.getByTestId('view-prev').click();
  }
  await expect(page.getByTestId('view-banner')).toBeVisible();
  await expect(page.locator('[data-past-screen] .app-body__actions').first()).toHaveAttribute('inert', '');
  for (let step = 0; step < 8; step += 1) {
    if (await page.getByTestId('view-banner').count() === 0) break;
    await page.getByTestId('view-next').click();
  }
  await expect(page.getByTestId('view-banner')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(requests.length).toBe(before);

  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('view-prev')).toHaveCount(0);
});

test('현재 화면에서 쓰던 글·고른 문구·조건 칩은 이전을 갔다 와도 남고, 지난 화면에서도 근거 자료를 열 수 있다', async ({
  page,
}) => {
  await toDiscuss(page, '/?mode=scripted&coach=off');
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  const textarea = page.getByTestId('draft-editor-textarea');
  const original = await textarea.inputValue();
  await textarea.fill(`${original} 덧붙인 문장입니다.`);
  const written = await textarea.inputValue();
  const chips = await page.locator('[data-testid^="condition-chip-"]').count();
  expect(chips).toBeGreaterThan(0);

  // ◀ ◀ → BRIEFING. 지난 화면의 근거 자료 팝업은 열 수 있다.
  await page.getByTestId('view-prev').click();
  await page.getByTestId('view-prev').click();
  await page.locator('[data-past-screen]').getByTestId('open-evidence').click();
  await expect(page.getByTestId('evidence-dialog')).toBeVisible();
  await expect(page.getByTestId('evidence-card-E1')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('evidence-dialog')).toHaveCount(0);
  await expectNoPageScroll(page, 'BRIEFING 보기(근거 자료 닫은 뒤)');

  // ▶ ▶ → 지금 화면: 글·입장·조건 칩이 그대로다.
  await page.getByTestId('view-next').click();
  await page.getByTestId('view-next').click();
  await expect(page.getByTestId('view-banner')).toHaveCount(0);
  await expect(page.getByTestId('draft-editor-textarea')).toHaveValue(written);
  await expect(page.getByTestId('discuss-side-for')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid^="condition-chip-"]')).toHaveCount(chips);

  // 다시 답하기에서 쓰던 글도 같다.
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-textarea').fill('쓰던 답변입니다.');
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('reactions-advance')).toBeVisible();
  await page.getByTestId('view-next').click();
  await expect(page.getByTestId('followup-textarea')).toHaveValue('쓰던 답변입니다.');
});
