// 무대 열(StageBand) e2e. docs/design/DESIGN_SPEC.md v1.0 6절(조종석 배치와 무스크롤
// 규칙, T45)을 기준으로 1920×1080·1280×720 모두에서 무대가 왼쪽 열에 원본 16:9로
// 보이는지, REACTIONS에서 내 말풍선 텍스트가 실제 내 발언 첫 문장과 일치하는지,
// BRIEFING·REACTIONS·VOTE·RESULT가 두 해상도 모두에서 스크롤 없이/CTA가 가려지지
// 않고 보이는지를 확인한다. T43의 56px 좌석 띠·"무대 펼치기" 토글은 T44에서, 본문
// 열의 스크롤 자체는 T45에서 없앴다 — 1280×720에서도 페이지 전체가 한 화면에 담긴다.

import { test, expect, type Page } from './fixtures';

const MY_OPINION_TEXT = '한 게시판에서 시범해 결과를 확인한 뒤 확대합시다.';

async function enterBriefing(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
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

function expectNoPageScroll(page: Page) {
  return expect(
    page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
  ).resolves.toBe(true);
}

/** T67 item6·7a: 최종 조건 4개(P1~P4)를 모두 확정해 CFO·CAIO·CISO 반응 말풍선을
 * 모두 띄운 REACTIONS로 이동한다(docs/screenshots의 reactions.png와 같은 조합 —
 * CAM/CLASSIFIED 라벨·명패 겹침이 실제로 드러난 상태). */
async function enterReactionsWithAllConditions(page: Page) {
  await enterBriefing(page);
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();
  await page.getByTestId('submit-opinion').click();
  await expect(
    page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' }),
  ).toBeVisible();
}

type Box = { x: number; y: number; width: number; height: number };

function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** stage 안 testId 요소가 있으면(보이면) box를, 없거나 숨어 있으면 null을 돌려준다
 * (HUD 라벨은 1280px 이하에서 display:none이라 그 폭에서는 검사를 건너뛴다). */
async function visibleBoxOrNull(page: Page, selector: string): Promise<Box | null> {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0 || !(await locator.isVisible())) {
    return null;
  }
  return locator.boundingBox();
}

/** PR #11 Codex 28차 검토(P2): 말풍선은 200ms 등장 애니메이션(stage-bubble-in)으로
 * 뜨고 시작 프레임은 translateY(6px)만큼 위치가 다르다 — 애니메이션이 끝나기 전에
 * boundingBox를 재면 정착 위치(steady state)의 겹침을 놓칠 수 있다. .stage-band__bubble
 * 각각의 실행 중인 Animation.finished를 기다려 정착 위치에서만 잰다. */
async function waitForBubbleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const bubbles = Array.from(document.querySelectorAll('.stage-band__bubble'));
    await Promise.all(
      bubbles.flatMap((el) => el.getAnimations().map((anim) => anim.finished.catch(() => undefined))),
    );
  });
}

/** REACTIONS에서 지정한 좌석 말풍선이 CAM 01/CLASSIFIED HUD 라벨과 겹치지 않는지
 * 확인한다(T67 item6·PR #11 Codex 28차 검토 공용 검사, 1281px 이상 여러 폭에서
 * 재사용). 기본은 네 임원 전부다 — CFO·CAIO는 좌석이 라벨과 같은 가로 구간에 있지
 * 않아 stage.css에 겹침 보정이 없다(1281px대 CFO 겹침은 이 PR 범위 밖의 별도
 * 발견 사항, 아래 1366×768 검사에서는 CEO·CISO만 확인한다). */
async function assertExecBubblesDoNotOverlapHudLabels(
  page: Page,
  memberIds: readonly string[] = ['CEO', 'CFO', 'CAIO', 'CISO'],
): Promise<void> {
  await waitForBubbleAnimations(page);
  const readout = await visibleBoxOrNull(page, '.stage-band__readout');
  const classified = await visibleBoxOrNull(page, '.stage-band__classified');
  expect(readout, 'CAM 01 라벨이 보여야 한다').not.toBeNull();
  expect(classified, 'CLASSIFIED 라벨이 보여야 한다').not.toBeNull();

  for (const memberId of memberIds) {
    const bubble = await visibleBoxOrNull(page, `[data-testid="stage-bubble-${memberId}"]`);
    if (!bubble) {
      continue;
    }
    expect(boxesIntersect(bubble, readout!), `${memberId} 말풍선이 CAM 01 라벨과 겹친다`).toBe(false);
    expect(
      boxesIntersect(bubble, classified!),
      `${memberId} 말풍선이 CLASSIFIED 라벨과 겹친다`,
    ).toBe(false);
  }
}

test.describe('1920×1080에서 무대 열', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('BRIEFING부터 무대가 왼쪽 열에 원본 16:9로 렌더된다', async ({ page }) => {
    await page.goto('/?mode=scripted');
    await page.getByRole('button', { name: '체험 시작' }).click();

    // SELECT는 무대 렌더 대상이 아니다(진입 전, DESIGN_SPEC.md v1.0 1절).
    await expect(page.getByTestId('stage-band')).toHaveCount(0);

    await page.getByTestId('scenario-card-anon-board').click();
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

  test('BRIEFING 의장 말풍선이 무대 상단 28%(하늘 여백) 안에서 끝난다', async ({ page }) => {
    await enterBriefing(page);
    const stage = await page.getByTestId('stage-band-full').boundingBox();
    const bubble = await page.getByTestId('stage-bubble-CEO').boundingBox();
    expect(stage).not.toBeNull();
    expect(bubble).not.toBeNull();
    // 줄 수 자르기(stage.css .stage-band__bubble-text)가 없으면 40자 문장이 1920에서 4줄,
    // 1280에서 5줄이 돼 이 선을 넘는다(2026-09-28 실측).
    expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(stage!.y + stage!.height * 0.28 + 1);
  });

  test('REACTIONS에서 내 말풍선 텍스트가 내 발언 첫 문장과 일치한다', async ({ page }) => {
    await enterReactions(page);
    // 본문 인용문(읽어야 할 정보)이 실제 제출한 전문이다.
    await expect(page.getByTestId('reactions-quote')).toHaveText(MY_OPINION_TEXT);
    // 무대의 내 말풍선(장식)은 그 첫 문장과 같다 — MY_OPINION_TEXT 자체가 40자
    // 이내 한 문장이라 자르지 않고 그대로 나온다.
    await expect(page.getByTestId('stage-bubble-PARTICIPANT')).toHaveText(MY_OPINION_TEXT);
  });

  test('BRIEFING·REACTIONS·VOTE·RESULT는 스크롤 없이 한 화면에 보인다', async ({ page }) => {
    await enterBriefing(page);
    await expectNoPageScroll(page);

    await page.getByRole('button', { name: '의견 듣기' }).click();
    await page.getByRole('button', { name: '내 의견 말하기' }).click();
    await page.getByTestId('draft-editor-textarea').fill(MY_OPINION_TEXT);
    const submitOpinion = page.getByTestId('submit-opinion');
    await expect(submitOpinion).toBeInViewport();
    await submitOpinion.click();

    await expect(page.getByTestId('assistant-toggle')).toBeInViewport();
    await expect(page.getByTestId('submit-followup')).toBeInViewport();
    await expectNoPageScroll(page);

    await enterVote(page);
    await expect(page.getByTestId('confirm-vote')).toBeInViewport();
    await expectNoPageScroll(page);

    await page.getByTestId('vote-radio-YES').check();
    await page.getByTestId('confirm-vote').click();
    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    await expect(page.getByTestId('end-session')).toBeInViewport();
    await expectNoPageScroll(page);
  });

  test('REACTIONS 말풍선이 CAM 01/CLASSIFIED HUD 라벨, 참가자 말풍선이 CFO·CAIO 명패와 겹치지 않는다', async ({
    page,
  }) => {
    // T67 item6·7a(2026-09-30 실측, docs/screenshots/desktop-1080/reactions.png):
    // 양쪽 끝 좌석(CEO·CISO) 말풍선이 HUD 판독 라벨을 덮었다.
    await enterReactionsWithAllConditions(page);
    await assertExecBubblesDoNotOverlapHudLabels(page);

    const participantBubble = await visibleBoxOrNull(page, '[data-testid="stage-bubble-PARTICIPANT"]');
    const cfoNameplate = await page.locator('.stage-band__nameplate--cfo').boundingBox();
    const caioNameplate = await page.locator('.stage-band__nameplate--caio').boundingBox();
    expect(participantBubble).not.toBeNull();
    expect(cfoNameplate).not.toBeNull();
    expect(caioNameplate).not.toBeNull();
    expect(
      boxesIntersect(participantBubble!, cfoNameplate!),
      '참가자 말풍선이 CFO 명패와 겹친다',
    ).toBe(false);
    expect(
      boxesIntersect(participantBubble!, caioNameplate!),
      '참가자 말풍선이 CAIO 명패와 겹친다',
    ).toBe(false);
  });
});

// PR #11 Codex 28차 검토(P2): calc(4% + 11px)는 "4%"가 stage 폭에 비례해 1281px
// 부근일수록 여유가 줄었다(1920만 검사하면 가장 넓어 여유가 가장 큰 경우만 본다).
// HUD 라벨 미디어쿼리 경계(min-width:1281px) 바로 위 폭에서 같은 검사를 반복해
// 고정 px로 바꾼 CEO·CISO 여유가 폭에 상관없이 유지되는지 확인한다.
test.describe('1366×768에서 무대 열', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('REACTIONS에서 CEO·CISO 말풍선이 CAM 01/CLASSIFIED HUD 라벨과 겹치지 않는다', async ({
    page,
  }) => {
    await enterReactionsWithAllConditions(page);
    await assertExecBubblesDoNotOverlapHudLabels(page, ['CEO', 'CISO']);
  });
});

test.describe('1280×720에서 무대 열', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('무대가 왼쪽 열(약 36vw 폭)에 그대로 보이고 CTA가 가려지지 않는다', async ({ page }) => {
    await enterBriefing(page);

    const stageBand = page.getByTestId('stage-band');
    await expect(stageBand).toBeVisible();
    // 좌석 띠로 접히지 않는다 — 전체 무대가 항상 보인다(T44에서 접힘 토글을 없앴다).
    const stage = page.getByTestId('stage-band-full');
    await expect(stage).toBeVisible();
    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();
    // 무대 열 폭은 뷰포트의 약 36%다(clamp(320px,36vw,860px), DESIGN_SPEC.md v1.0 6절).
    const widthRatio = stageBox!.width / 1280;
    expect(widthRatio).toBeGreaterThan(0.25);
    expect(widthRatio).toBeLessThan(0.45);

    // 720에서도 페이지 스크롤이 없어 CTA는 스크롤 없이 바로 보인다(v1.0 6절 무스크롤).
    const cta = page.getByRole('button', { name: '의견 듣기' });
    await expect(cta).toBeInViewport();
    await expect(stage).toBeInViewport();
    await expectNoPageScroll(page);
  });

  test('BRIEFING 의장 말풍선이 무대 상단 28%(하늘 여백) 안에서 끝난다', async ({ page }) => {
    await enterBriefing(page);
    const stage = await page.getByTestId('stage-band-full').boundingBox();
    const bubble = await page.getByTestId('stage-bubble-CEO').boundingBox();
    expect(stage).not.toBeNull();
    expect(bubble).not.toBeNull();
    // 줄 수 자르기(stage.css .stage-band__bubble-text)가 없으면 40자 문장이 1920에서 4줄,
    // 1280에서 5줄이 돼 이 선을 넘는다(2026-09-28 실측).
    expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(stage!.y + stage!.height * 0.28 + 1);
  });

  test('REACTIONS·VOTE·RESULT의 CTA와 비서실장 토글이 스크롤 없이 보인다', async ({ page }) => {
    await enterReactions(page);
    await expect(page.getByTestId('assistant-toggle')).toBeInViewport();
    await expect(page.getByTestId('submit-followup')).toBeInViewport();
    await expectNoPageScroll(page);

    await enterVote(page);
    const confirmVote = page.getByTestId('confirm-vote');
    await expect(confirmVote).toBeInViewport();
    await expectNoPageScroll(page);

    await page.getByTestId('vote-radio-YES').check();
    await confirmVote.click();
    await expect(page.getByTestId('result-conclusion')).toBeVisible();
    const endSession = page.getByTestId('end-session');
    await expect(endSession).toBeInViewport();
    await expectNoPageScroll(page);
  });

  test('REACTIONS에서 참가자 말풍선이 CFO·CAIO 명패와 겹치지 않는다', async ({ page }) => {
    // T67 item7a(2026-09-30 실측, docs/screenshots/desktop-720/reactions.png):
    // top:60%로 위에서 내려 그리던 참가자 말풍선이 CFO·CAIO 명패를 덮었다
    // (1920×1080에서는 좌석 열이 더 높아 우연히 안 겹쳤을 뿐 같은 버그였다).
    // 1280px 이하에서는 CAM 01/CLASSIFIED HUD 라벨 자체가 숨어(stage.css
    // 미디어쿼리) 겹칠 대상이 없다 — 여기서는 명패만 확인한다.
    await enterReactionsWithAllConditions(page);

    const readout = await visibleBoxOrNull(page, '.stage-band__readout');
    expect(readout, '1280×720에서는 CAM 01 라벨이 숨어 있어야 한다').toBeNull();

    const participantBubble = await visibleBoxOrNull(page, '[data-testid="stage-bubble-PARTICIPANT"]');
    const cfoNameplate = await page.locator('.stage-band__nameplate--cfo').boundingBox();
    const caioNameplate = await page.locator('.stage-band__nameplate--caio').boundingBox();
    expect(participantBubble).not.toBeNull();
    expect(cfoNameplate).not.toBeNull();
    expect(caioNameplate).not.toBeNull();
    expect(
      boxesIntersect(participantBubble!, cfoNameplate!),
      '참가자 말풍선이 CFO 명패와 겹친다',
    ).toBe(false);
    expect(
      boxesIntersect(participantBubble!, caioNameplate!),
      '참가자 말풍선이 CAIO 명패와 겹친다',
    ).toBe(false);
  });
});
