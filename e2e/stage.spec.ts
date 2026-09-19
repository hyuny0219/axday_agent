// 무대 띠(StageBand, T43) e2e. docs/design/DESIGN_SPEC.md v1.0 1절 "무대 띠"를
// 기준으로 1920×1080에서 무대가 온전히 보이는지, REACTIONS에서 내 말풍선 텍스트가
// 실제 내 발언 첫 문장과 일치하는지, 1280×720에서 56px 좌석 띠로 접히고 펼치기
// 토글·CTA가 함께 보이는지를 확인한다.

import { test, expect } from './fixtures';

const MY_OPINION_TEXT = '작은 범위로 시작해 결과를 확인한 뒤 확대합시다.';

test.describe('1920×1080에서 무대 띠', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('BRIEFING부터 무대 띠가 펼쳐진 상태로 렌더된다', async ({ page }) => {
    await page.goto('/?mode=scripted');
    await page.getByRole('button', { name: '체험 시작' }).click();

    // SELECT는 무대 띠 렌더 대상이 아니다(진입 전, DESIGN_SPEC.md v1.0 1절).
    await expect(page.getByTestId('stage-band')).toHaveCount(0);

    await page.getByTestId('scenario-card-ai-assistant').click();
    await page.getByRole('button', { name: '이사회 입장' }).click();

    const stageBand = page.getByTestId('stage-band');
    await expect(stageBand).toBeVisible();
    await expect(stageBand).toHaveAttribute('aria-hidden', 'true');
    // 1080에서는 접힌 좌석 띠가 아니라 무대 전체가 보인다.
    await expect(page.getByTestId('stage-band-full')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CEO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CFO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CAIO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-CISO')).toBeVisible();
    await expect(page.getByTestId('stage-seat-PARTICIPANT')).toBeVisible();
    // 브리핑에서는 의장(CEO) 말풍선만 있고, 무대 띠는 읽어야 할 정보를 스스로
    // 담지 않는다(장식, aria-hidden).
    await expect(page.getByTestId('stage-bubble-CEO')).toBeVisible();
  });

  test('REACTIONS에서 내 말풍선 텍스트가 내 발언 첫 문장과 일치한다', async ({ page }) => {
    await page.goto('/?mode=scripted');
    await page.getByRole('button', { name: '체험 시작' }).click();
    await page.getByTestId('scenario-card-ai-assistant').click();
    await page.getByRole('button', { name: '이사회 입장' }).click();
    await page.getByRole('button', { name: '의견 듣기' }).click();
    await page.getByRole('button', { name: '내 의견 말하기' }).click();

    await page.getByTestId('draft-editor-textarea').fill(MY_OPINION_TEXT);
    const submitOpinion = page.getByTestId('submit-opinion');
    await expect(submitOpinion).toBeEnabled();
    await submitOpinion.click();

    await expect(
      page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
    ).toBeVisible();
    // 본문 인용문(읽어야 할 정보)이 실제 제출한 전문이다.
    await expect(page.getByTestId('reactions-quote')).toHaveText(MY_OPINION_TEXT);
    // 무대 띠의 내 말풍선(장식)은 그 첫 문장과 같다 — MY_OPINION_TEXT 자체가 40자
    // 이내 한 문장이라 자르지 않고 그대로 나온다.
    await expect(page.getByTestId('stage-bubble-PARTICIPANT')).toHaveText(MY_OPINION_TEXT);
  });
});

test.describe('1280×720에서 좌석 띠로 접힘', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('무대가 56px 좌석 띠로 접히고, 펼치기 토글과 CTA가 함께 보인다', async ({ page }) => {
    await page.goto('/?mode=scripted');
    await page.getByRole('button', { name: '체험 시작' }).click();
    await page.getByTestId('scenario-card-ai-assistant').click();
    await page.getByRole('button', { name: '이사회 입장' }).click();

    const stageBand = page.getByTestId('stage-band');
    await expect(stageBand).toBeVisible();
    // 720에서는 무대 전체가 아니라 좌석 띠만 보인다.
    await expect(page.getByTestId('stage-band-full')).toBeHidden();
    const strip = page.getByTestId('stage-band-strip');
    await expect(strip).toBeVisible();
    const stripBox = await strip.boundingBox();
    expect(stripBox?.height).toBeLessThanOrEqual(56);

    // 하단 CTA는 좌석 띠가 접힌 상태에서 스크롤로 닿을 수 있고 가려지지 않는다
    // (BRIEFING처럼 내용이 길어 스크롤이 필요한 화면도 다른 화면과 같은 규칙을
    // 따른다 — sticky footer가 없는 화면은 원래도 스크롤 후 도달한다).
    const cta = page.getByRole('button', { name: '의견 듣기' });
    await expect(cta).toBeVisible();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();

    // "무대 펼치기"를 누르면 무대 전체가 나타난다. 문서 흐름을 밀어내지 않는 절대
    // 위치라서(top: 100%) 펼친 상태에서도 스크롤해 닿은 CTA는 그대로 보인다(세션
    // 활동으로 세지 않는 로컬 상태이므로 화면 흐름 자체는 바뀌지 않는다).
    const expandButton = page.getByTestId('stage-expand');
    await expect(expandButton).toBeVisible();
    const expandBox = await expandButton.boundingBox();
    expect(expandBox?.height).toBeGreaterThanOrEqual(56);

    await expandButton.click();
    await expect(stageBand).toHaveAttribute('data-expanded', 'true');
    await expect(page.getByTestId('stage-band-full')).toBeVisible();
    await expect(cta).toBeVisible();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();

    // 다시 누르면 접힌다.
    await expandButton.click();
    await expect(stageBand).toHaveAttribute('data-expanded', 'false');
    await expect(page.getByTestId('stage-band-full')).toBeHidden();
  });
});
