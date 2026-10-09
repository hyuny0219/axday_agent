// T103·T104 진행 도우미(튜토리얼 코치). 체험 전 안내의 버튼은 "안내 받으며 시작" 하나이고,
// 10단계를 끝까지 따라가며, `?coach=off`로 시작하면 코치가 한 번도 안 뜨는지, 건너뛰기·운영 메뉴 끄기가 되는지 확인한다.
// 코치가 떠 있는 동안 스포트라이트 구멍 밖은 클릭이 막히므로 구멍 안(밝힌 대상)만 누른다.
import { test, expect, type Page } from './fixtures';

async function startWithCoach(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안내 받으며 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
}

/** 말풍선이 화면 안에 통째로 들어오고 밝힌 대상을 가리지 않는지 확인한다. 카드가 차례로 나타나며
 * 대상 크기가 변하는 화면이 있어, 값이 자리 잡을 때까지 다시 읽으며 확인한다. */
async function expectCoachInViewport(page: Page, step: number) {
  await expect(page.getByTestId('coach-progress')).toHaveText(`진행 도우미 · ${step}/10`);
  const viewport = page.viewportSize()!;
  await expect
    .poll(
      async () => {
        const bubble = await page.getByTestId('coach-bubble').boundingBox();
        const spot = await page.getByTestId('coach-spot').boundingBox();
        if (!bubble || !spot) return 'missing';
        if (bubble.x < 0 || bubble.y < 0) return 'bubble-before-viewport';
        if (bubble.x + bubble.width > viewport.width) return 'bubble-past-right';
        if (bubble.y + bubble.height > viewport.height) return 'bubble-past-bottom';
        if (spot.width <= 0 || spot.x >= viewport.width || spot.y >= viewport.height) return 'spot-offscreen';
        const overlapX = Math.min(bubble.x + bubble.width, spot.x + spot.width) - Math.max(bubble.x, spot.x);
        const overlapY = Math.min(bubble.y + bubble.height, spot.y + spot.height) - Math.max(bubble.y, spot.y);
        return overlapX > 0 && overlapY > 0 ? 'bubble-covers-target' : 'ok';
      },
      { message: `${step}단계 말풍선·스포트라이트 위치`, timeout: 5000 },
    )
    .toBe('ok');
}

test('안내 받으며 시작: 10단계를 차례로 따라 끝까지 간다', async ({ page }) => {
  await startWithCoach(page);

  // 1. BRIEFING — 상황판(읽기). 근거 자료보다 먼저다.
  await expectCoachInViewport(page, 1);
  await expect(page.getByTestId('coach-title')).toContainText('상황');
  await expect(page.getByTestId('coach-ack')).toHaveCount(1);
  await page.getByTestId('coach-ack').click();

  // 2. BRIEFING — 근거 자료 보기 버튼
  await expectCoachInViewport(page, 2);
  await expect(page.getByTestId('coach-title')).toContainText('근거 자료 4장');
  await expect(page.getByTestId('coach-ack')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '의견 듣기' })).toBeDisabled();
  await page.getByTestId('open-evidence').click();
  await expect(page.getByTestId('evidence-dialog')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0); // 팝업을 읽는 동안은 숨는다
  await page.getByTestId('evidence-dialog-close').click();
  await expect(page.getByTestId('coach')).toHaveCount(0); // 2단계 끝, 이 화면엔 더 없다
  await page.getByRole('button', { name: '의견 듣기' }).click();

  // 3. OPINIONS — 임원 카드 영역, "알겠어요"로 넘어감
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expectCoachInViewport(page, 3);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();

  // 4. DISCUSS — 입장 버튼
  await expectCoachInViewport(page, 4);
  await page.getByTestId('discuss-side-for').click();

  // 5. 추천 문구 카드 영역
  await expectCoachInViewport(page, 5);
  await page.getByTestId('phrase-card-P1').click();

  // 6. 비서실장 버튼 → 팝업 안 다음 기능 → 닫기
  await expectCoachInViewport(page, 6);
  await expect(page.getByTestId('coach-title')).toContainText('AI 비서실장');
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveClass(/coach--dialog/);
  await expect(page.getByTestId('coach-title')).toContainText('세 가지를 한 번씩');
  for (const feature of ['summary', 'compare', 'refine'] as const) {
    // 팝업 안에서는 아직 안 쓴 첫 기능 버튼만 밝혀진다.
    await expect(page.getByTestId(`assistant-action-${feature}`)).toHaveAttribute('data-coach', 'assistant-next');
    await page.getByTestId(`assistant-action-${feature}`).click();
    await expect(page.getByTestId(`assistant-done-${feature}`)).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.getByTestId('coach-title')).toContainText('닫기');
  await expect(page.getByTestId('assistant-close')).toHaveAttribute('data-coach', 'assistant-close');
  await page.getByTestId('assistant-close').click();
  await expect(page.getByTestId('assistant-panel')).toHaveCount(0);

  // 7. 의견 전달 버튼
  await expectCoachInViewport(page, 7);
  await expect(page.getByTestId('submit-opinion')).toBeEnabled();
  await page.getByTestId('submit-opinion').click();

  // 8. REACTIONS 1/2 — 반응 카드 영역, "알겠어요"
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expectCoachInViewport(page, 8);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByTestId('reactions-advance').click();
  await expect(page.getByTestId('followup-textarea')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0); // 2/2 다시 답하기에는 코치가 없다
  await page.getByTestId('keep-previous-answer').click();

  // MOTION에는 코치가 없다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('freeze-motion').click();

  // 9. VOTE — 도장 영역 → 확정 버튼
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectCoachInViewport(page, 9);
  await page.locator('label.vote-choice--yes').click();
  await expect(page.getByTestId('confirm-vote')).toHaveAttribute('data-coach', 'vote-confirm');
  await expectCoachInViewport(page, 9);
  await page.getByTestId('confirm-vote').click();

  // 10. RESULT — 제목 줄+도장, "안내 끝"
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expectCoachInViewport(page, 10);
  await expect(page.getByTestId('coach-ack')).toHaveText('안내 끝');
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
});

test('?coach=off로 시작: 코치가 한 번도 뜨지 않고 버튼 잠금만으로 끝까지 간다', async ({ page }) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안내 받으며 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '의견 듣기' })).toBeDisabled();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  // 잠긴 버튼의 이유는 화면 읽기용 설명으로만 남는다.
  await expect(page.getByTestId('submit-opinion')).toBeDisabled();
  await expect(page.getByTestId('submit-opinion')).toHaveAccessibleDescription(/입장/);
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.getByTestId('assistant-toggle')).toBeEnabled();
  // 옛 맥동 테두리와 한 줄 안내는 없다.
  await expect(page.locator('[data-guide]')).toHaveCount(0);
  await expect(page.locator('.guide-hint, .cta-disabled-hint, [data-testid="step-guide"]')).toHaveCount(0);
});

test('건너뛰기는 이 화면의 코치만 닫고, 버튼 잠금은 그대로이며 다음 화면에서 다시 나온다', async ({ page }) => {
  await startWithCoach(page);
  await expectCoachInViewport(page, 1);
  await page.getByTestId('coach-skip').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '의견 듣기' })).toBeDisabled();

  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expectCoachInViewport(page, 3);
  // Esc도 건너뛰기다.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await expectCoachInViewport(page, 4);
});

test('운영 메뉴에서 안내를 끄면 코치가 사라지고, 다시 켜면 이 화면 단계부터 나온다', async ({ page }) => {
  await startWithCoach(page);
  await expectCoachInViewport(page, 1);

  // 코치가 떠 있어도 운영 메뉴는 누를 수 있다.
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-toggle-coach').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);

  await page.getByTestId('operator-menu-button').click();
  await expect(page.getByTestId('operator-toggle-coach')).toHaveText('안내 켜기');
  await page.getByTestId('operator-toggle-coach').click();
  await expectCoachInViewport(page, 1);
});
