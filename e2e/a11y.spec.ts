// 접근성·모션 검수(T15, DESIGN_SPEC.md 4장): 키보드만으로 추천 문구 경로 완주,
// prefers-reduced-motion에서 화면 전환 애니메이션 제거, 200% 확대 상당(960×540)에서
// CTA 도달. 세 검사 모두 mode=scripted로 강제해 live 서버 호출 여부와 무관하다.

import { test, expect } from '@playwright/test';

test('키보드만으로 추천 문구 경로를 완주해 결과 화면에 도달한다', async ({ page }) => {
  await page.goto('/?mode=scripted');

  // ATTRACT
  await page.getByRole('button', { name: '체험 시작' }).focus();
  await page.keyboard.press('Enter');

  // SELECT: 카드 선택도, 입장 CTA도 마우스 클릭 없이 포커스+Enter로만 조작한다.
  await page.getByTestId('scenario-card-ai-assistant').focus();
  await page.keyboard.press('Enter');
  const enterBoard = page.getByRole('button', { name: '이사회 입장' });
  await expect(enterBoard).toBeEnabled();
  await enterBoard.focus();
  await page.keyboard.press('Enter');

  // BRIEFING
  await page.getByRole('button', { name: '의견 듣기' }).focus();
  await page.keyboard.press('Enter');

  // OPINIONS
  await page.getByRole('button', { name: '내 의견 말하기' }).focus();
  await page.keyboard.press('Enter');

  // DISCUSS: 추천 문구 체크박스는 Space로 토글한다(네이티브 checkbox 키보드 조작).
  const phraseCheckbox = page.locator('[data-testid="phrase-card-P1"] input[type="checkbox"]');
  await phraseCheckbox.focus();
  await page.keyboard.press('Space');
  await expect(phraseCheckbox).toBeChecked();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.focus();
  await page.keyboard.press('Enter');

  // REACTIONS: '앞선 의견 유지' 선택지로 후속 입력 없이 마무리한다.
  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await page.getByTestId('followup-option-2').focus();
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
  await page.getByTestId('scenario-card-ai-assistant').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await submitOpinion.scrollIntoViewIfNeeded();
  await expect(submitOpinion).toBeVisible();
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  await page.getByTestId('followup-option-2').click();

  const freezeMotion = page.getByTestId('freeze-motion');
  await freezeMotion.scrollIntoViewIfNeeded();
  await expect(freezeMotion).toBeVisible();
  await freezeMotion.click();

  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await confirmVote.scrollIntoViewIfNeeded();
  await expect(confirmVote).toBeVisible();
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  await expect(page.getByTestId('result-conclusion')).toBeVisible();
});
