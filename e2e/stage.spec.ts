// 무대 열(StageBand) e2e. docs/design/DESIGN_SPEC.md v1.0 5절(좌우 분할 개정, T44)을
// 기준으로 1920×1080에서 무대가 왼쪽 열에 원본 16:9로 보이는지, REACTIONS에서 내
// 말풍선 텍스트가 실제 내 발언 첫 문장과 일치하는지, REACTIONS·VOTE·RESULT가 두
// 해상도 모두에서 스크롤 없이/CTA가 가려지지 않고 보이는지를 확인한다. T43의 56px
// 좌석 띠·"무대 펼치기" 토글은 T44에서 없앴다 — 1280×720에서도 무대는 항상 전체로
// 보이고 폭만 줄어든다.

import { test, expect, type Page } from './fixtures';

const MY_OPINION_TEXT = '작은 범위로 시작해 결과를 확인한 뒤 확대합시다.';

async function enterBriefing(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
}

async function enterReactions(page: Page) {
  await enterBriefing(page);
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('draft-editor-textarea').fill(MY_OPINION_TEXT);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
}

/** REACTIONS에서 시작해 VOTE까지 이동한다(빠른 답 3번 선택 → 최종안 고정). */
async function enterVote(page: Page) {
  await page.getByTestId('followup-option-2').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
}

test.describe('1920×1080에서 무대 열', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('BRIEFING부터 무대가 왼쪽 열에 원본 16:9로 렌더된다', async ({ page }) => {
    await page.goto('/?mode=scripted');
    await page.getByRole('button', { name: '체험 시작' }).click();

    // SELECT는 무대 렌더 대상이 아니다(진입 전, DESIGN_SPEC.md v1.0 1절).
    await expect(page.getByTestId('stage-band')).toHaveCount(0);

    await page.getByTestId('scenario-card-ai-assistant').click();
    await page.getByRole('button', { name: '이사회 입장' }).click();

    const stageBand = page.getByTestId('stage-band');
    await expect(stageBand).toBeVisible();
    await expect(stageBand).toHaveAttribute('aria-hidden', 'true');
    // 좌석 띠(T43)는 T44에서 없어졌다 — 무대는 항상 전체로 보인다.
    const stage = page.getByTestId('stage-band-full');
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    // 원본 16:9 비율(object-fit 없이 컨테이너 자체가 aspect-ratio: 16/9).
    expect((box!.width / box!.height)).toBeCloseTo(16 / 9, 1);
    await expect(page.getByTestId('stage-seat-CEO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CFO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CAIO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CISO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-PARTICIPANT')).toBeVisible();
    // 브리핑에서는 의장(CEO) 말풍선만 있고, 무대는 읽어야 할 정보를 스스로 담지
    // 않는다(장식, aria-hidden).
    await expect(page.getByTestId('stage-bubble-CEO')).toBeVisible();
  });

  test('REACTIONS에서 내 말풍선 텍스트가 내 발언 첫 문장과 일치한다', async ({ page }) => {
    await enterReactions(page);
    // 본문 인용문(읽어야 할 정보)이 실제 제출한 전문이다.
    await expect(page.getByTestId('reactions-quote')).toHaveText(MY_OPINION_TEXT);
    // 무대의 내 말풍선(장식)은 그 첫 문장과 같다 — MY_OPINION_TEXT 자체가 40자
    // 이내 한 문장이라 자르지 않고 그대로 나온다.
    await expect(page.getByTestId('stage-bubble-PARTICIPANT')).toHaveText(MY_OPINION_TEXT);
  });

  test('REACTIONS·VOTE·RESULT는 스크롤 없이 한 화면에 보인다', async ({ page }) => {
    await enterReactions(page);
    await expect(page.getByTestId('assistant-toggle')).toBeInViewport();
    await expect(page.getByTestId('submit-followup')).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true);

    await enterVote(page);
    await expect(page.getByTestId('confirm-vote')).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true);

    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();
    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    await expect(page.getByTestId('end-session')).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    ).toBe(true);
  });
});

test.describe('1280×720에서 무대 열', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('무대가 왼쪽 열(약 40% 폭)에 그대로 보이고 CTA가 가려지지 않는다', async ({ page }) => {
    await enterBriefing(page);

    const stageBand = page.getByTestId('stage-band');
    await expect(stageBand).toBeVisible();
    // 좌석 띠로 접히지 않는다 — 전체 무대가 항상 보인다(T44에서 접힘 토글을 없앴다).
    const stage = page.getByTestId('stage-band-full');
    await expect(stage).toBeVisible();
    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();
    // 무대 열 폭은 뷰포트의 약 40%다(clamp(420px,42vw,860px), DESIGN_SPEC.md v1.0 5절).
    const widthRatio = stageBox!.width / 1280;
    expect(widthRatio).toBeGreaterThan(0.3);
    expect(widthRatio).toBeLessThan(0.5);

    // BRIEFING만 스크롤을 허용한다(자료 4장 + 쟁점) — CTA는 스크롤로 닿을 수 있고
    // 가려지지 않는다.
    const cta = page.getByRole('button', { name: '의견 듣기' });
    await expect(cta).toBeVisible();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();
    // 스크롤한 뒤에도 무대는 sticky라 계속 보인다.
    await expect(stage).toBeInViewport();
  });

  // 40% 무대 열 때문에 본문 폭이 704px 남짓으로 줄어(v1.0 5절), REACTIONS의 답글형
  // 4장 임원 반응까지 담으면 720px 높이 안에 한 화면으로는 담기지 않는다(무대 상단
  // 300px 띠를 없애 확보한 여유가 720에서는 애초에 크지 않다 — 완료 확인 "1280×720에서
  // 무대 폭 40%·CTA 가시"는 "스크롤 없이"를 요구하지 않는다, 1920만 그렇다). BRIEFING과
  // 같은 규칙으로 스크롤해 닿을 수 있고 가려지지 않는지만 확인한다.
  test('REACTIONS·VOTE·RESULT의 하단 CTA와 비서실장 토글이 스크롤로 가려지지 않게 보인다', async ({
    page,
  }) => {
    await enterReactions(page);
    const assistantToggle = page.getByTestId('assistant-toggle');
    await assistantToggle.scrollIntoViewIfNeeded();
    await expect(assistantToggle).toBeInViewport();
    const submitFollowup = page.getByTestId('submit-followup');
    await submitFollowup.scrollIntoViewIfNeeded();
    await expect(submitFollowup).toBeInViewport();

    await enterVote(page);
    const confirmVote = page.getByTestId('confirm-vote');
    await confirmVote.scrollIntoViewIfNeeded();
    await expect(confirmVote).toBeInViewport();

    await page.getByTestId('vote-radio-YES').check();
    await confirmVote.click();
    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    const endSession = page.getByTestId('end-session');
    await endSession.scrollIntoViewIfNeeded();
    await expect(endSession).toBeInViewport();
  });
});
