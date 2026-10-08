// 접근성·모션 검수(T15, DESIGN_SPEC.md 4장): 키보드만으로 추천 문구 경로 완주,
// prefers-reduced-motion에서 화면 전환 애니메이션 제거, 200% 확대 상당(960×540)에서
// CTA 도달. 세 검사 모두 mode=scripted로 강제해 live 서버 호출 여부와 무관하다.

import { test, expect } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

test('키보드만으로 추천 문구 경로를 완주해 결과 화면에 도달한다', async ({ page }) => {
  await page.goto('/?mode=scripted');

  // ATTRACT
  await page.getByRole('button', { name: '체험 시작' }).focus();
  await page.keyboard.press('Enter');

  // INTRO(T95): 소개 한 장 — CTA에 포커스를 옮겨 Enter로 넘어간다.
  await page.getByRole('button', { name: '안건 고르러 가기' }).focus();
  await page.keyboard.press('Enter');

  // SELECT: 카드 자체가 버튼이라(T84 #10) 포커스+Enter만으로 바로 입장한다 —
  // 별도 입장 CTA가 없다.
  await page.getByTestId('scenario-card-ai-approval').focus();
  await page.keyboard.press('Enter');

  // BRIEFING: 근거 자료를 한 번 열어 닫기 전에는 "의견 듣기 ▶"가 잠겨 있다(T95).
  await page.getByTestId('open-evidence').focus();
  await page.keyboard.press('Enter');
  const evidenceDialog = page.getByTestId('evidence-dialog');
  await expect(evidenceDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(evidenceDialog).toHaveCount(0);

  const hearOpinions = page.getByRole('button', { name: '의견 듣기' });
  await expect(hearOpinions).toBeEnabled();
  await hearOpinions.focus();
  await page.keyboard.press('Enter');

  // OPINIONS
  await page.getByRole('button', { name: '내 의견 말하기' }).focus();
  await page.keyboard.press('Enter');

  // DISCUSS: 입장을 먼저 고른다(T87, 네이티브 button이라 Enter로 누른다).
  await page.getByTestId('discuss-side-for').focus();
  await page.keyboard.press('Enter');

  // 추천 문구 체크박스는 Space로 토글한다(네이티브 checkbox 키보드 조작).
  const phraseCheckbox = page.locator('[data-testid="phrase-card-P1"] input[type="checkbox"]');
  await phraseCheckbox.focus();
  await page.keyboard.press('Space');
  await expect(phraseCheckbox).toBeChecked();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.focus();
  await page.keyboard.press('Enter');

  // REACTIONS: "답하지 않고 넘어가기" 보조 버튼(T84 #1, 네이티브 button)으로 후속
  // 입력 없이 마무리한다 — 체크박스가 아니라 버튼이라 Space 대신 Enter로 누른다.
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  const keepPreviousButton = page.getByTestId('keep-previous-answer');
  await keepPreviousButton.focus();
  await page.keyboard.press('Enter');

  // MOTION
  const freezeMotion = page.getByTestId('freeze-motion');
  await freezeMotion.focus();
  await page.keyboard.press('Enter');

  // VOTE: radio는 Space로 선택한다(방향키 이동은 브라우저 네이티브 radio group 동작).
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  const yesRadio = page.getByTestId('vote-radio-YES');
  await yesRadio.focus();
  await page.keyboard.press('Space');
  await expect(yesRadio).toBeChecked();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.focus();
  await page.keyboard.press('Enter');

  // RESULT
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
});

test('prefers-reduced-motion에서는 화면 전환에 애니메이션이 남지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();

  const selectScreen = page.locator('.screen.select-screen');
  await expect(selectScreen).toBeVisible();
  const animationDuration = await selectScreen.evaluate(
    (el) => getComputedStyle(el).animationDuration,
  );
  // base.css의 전역 reduced-motion 규칙이 지속 시간을 0.01ms로 강제로 줄인다. 브라우저가
  // 이를 "0s"로 반올림해 보여줄 수 있어, 평소 220ms(--transition-screen)와만 다르다는
  // 대신 실제 ms 값이 사실상 0에 가까운지로 판정한다.
  const ms = animationDuration.endsWith('ms')
    ? Number.parseFloat(animationDuration)
    : Number.parseFloat(animationDuration) * 1000;
  expect(ms).toBeLessThan(1);
});

test('960×540 뷰포트(200% 확대 상당)에서 스크롤로 CTA에 도달할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안건 고르러 가기' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // 사용자가 실제로 쓰는 경로(마우스 휠)로만 스크롤한다 — scrollIntoView는
  // overflow:hidden 컨테이너도 프로그램적으로 움직여 잘림을 숨긴다(PR #6 Codex 4차 검토).
  // 무스크롤 잠금은 검수 해상도(1920×1080·1280×720)에서만 적용되고, 200% 확대 상당의
  // 짧은 뷰포트에서는 문서 스크롤이 열려 있어야 한다(DESIGN_SPEC.md 3장·v1.0 6절).
  async function wheelUntilVisible(testId: string) {
    const target = page.getByTestId(testId);
    // 대상이 다음 화면의 요소면(예: REACTIONS 답변 → 후속 라운드 → MOTION의 freeze-motion)
    // 화면이 바뀌기 전에 스크롤이 끝나 버리므로 대상이 DOM에 붙은 뒤 문서 맨 위에서 시작한다.
    await target.waitFor({ state: 'attached' });
    // 문서 스크롤만 움직인다(window.scrollBy). scrollIntoView는 overflow:hidden 컨테이너도
    // 프로그램적으로 움직여 잘림을 숨기지만(PR #6 Codex 4차 검토) window.scrollBy는 문서가
    // 스크롤 가능할 때만 효과가 있어 "짧은 뷰포트에서 문서 스크롤이 열려 있다"는 검증을
    // 그대로 유지한다. 마우스 휠은 포인터 아래 요소(헤더가 스크롤돼 나간 뒤에는 발언 흐름
    // 패널 같은 내부 스크롤 영역)가 먼저 소비해 CI 글꼴 차이에 따라 간헐 실패했다.
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < 12; i += 1) {
      if (await target.isVisible()) {
        const box = await target.boundingBox();
        const viewport = page.viewportSize();
        if (box && viewport && box.y >= 0 && box.y + box.height <= viewport.height) {
          return target;
        }
      }
      await page.evaluate(() => window.scrollBy(0, 300));
    }
    await expect(target).toBeInViewport();
    return target;
  }

  // 세로 1열 재배치·overflow 해제가 실제 계산값으로 적용됐는지 확인한다(PR #6 Codex 5차
  // 검토: 미디어 블록이 기본 규칙보다 앞에 있으면 같은 특이성의 기본 규칙이 이겨 2열과
  // overflow:hidden이 그대로 남고, CTA만 우연히 닿는 통과가 된다). 오른쪽 열이 뷰포트
  // 밖으로 밀리거나 가로 스크롤이 생기지 않아야 한다.
  const layout = await page.evaluate(() => {
    const style = (selector: string, property: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).getPropertyValue(property).trim() : '';
    };
    const content = document.querySelector('.app-body__content');
    return {
      columns: style('.app-body', 'grid-template-columns').split(/\s+/).length,
      shellOverflow: style('.app-shell', 'overflow-y'),
      mainOverflow: style('.app-main', 'overflow-y'),
      contentOverflow: style('.app-body__content', 'overflow-y'),
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      contentRight: content ? Math.round(content.getBoundingClientRect().right) : -1,
    };
  });
  expect(layout.columns).toBe(1);
  expect(layout.shellOverflow).toBe('visible');
  expect(layout.mainOverflow).toBe('visible');
  expect(layout.contentOverflow).toBe('visible');
  expect(layout.horizontalScroll).toBe(false);
  expect(layout.contentRight).toBeLessThanOrEqual(960);

  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = await wheelUntilVisible('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  const keepPrevious = await wheelUntilVisible('keep-previous-answer');
  await keepPrevious.click();

  const freezeMotion = await wheelUntilVisible('freeze-motion');
  await freezeMotion.click();

  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = await wheelUntilVisible('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
});
