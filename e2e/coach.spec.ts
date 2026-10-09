// T103·T104 진행 도우미(화면 사용법 안내). 체험 전 안내의 버튼은 "확인" 하나이고, 코치는 흐름을
// 끌고 가지 않는다 — 6개 화면에서 한 번씩 말풍선이 뜨고, "알겠어요" 또는 그 화면의 첫 조작으로
// 사라지며, 떠 있는 동안에도 화면의 버튼은 그대로 눌린다. `?coach=off`면 한 번도 안 뜬다.
import { test, expect, type Page } from './fixtures';

async function startWithCoach(page: Page) {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
}

/** 말풍선이 화면 안에 통째로 들어오고 번호가 맞는지 확인한다. 화면 배치가 자리 잡을 때까지 다시 읽는다. */
async function expectCoach(page: Page, step: number) {
  await expect(page.getByTestId('coach-progress')).toHaveText(`안내 ${step}/6`);
  const viewport = page.viewportSize()!;
  await expect
    .poll(
      async () => {
        const card = await page.getByTestId('coach').boundingBox();
        if (!card) return 'missing';
        if (card.x < 0 || card.y < 0) return 'before-viewport';
        if (card.x + card.width > viewport.width) return 'past-right';
        if (card.y + card.height > viewport.height) return 'past-bottom';
        return 'ok';
      },
      { message: `${step}번 안내 위치`, timeout: 5000 },
    )
    .toBe('ok');
  // 덮개·스포트라이트는 없다.
  await expect(page.getByTestId('coach-dim')).toHaveCount(0);
  await expect(page.getByTestId('coach-spot')).toHaveCount(0);
}

test('6개 화면에서 한 번씩 뜨고, 알겠어요나 첫 조작으로 사라지며, 떠 있어도 버튼이 눌린다', async ({ page }) => {
  await startWithCoach(page);

  // 1. BRIEFING — 안내가 떠 있어도 근거 자료 버튼이 눌리고, 누르면 안내가 사라진다.
  await expectCoach(page, 1);
  await expect(page.getByTestId('coach-title')).toContainText('상황을 읽고 자료를 열어 보세요');
  await expect(page.getByTestId('coach-lines').locator('li')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '의견 듣기' })).toBeDisabled(); // 버튼 잠금은 그대로
  await page.getByTestId('open-evidence').click();
  await expect(page.getByTestId('evidence-dialog')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('evidence-dialog-close').click();
  await page.getByRole('button', { name: '의견 듣기' }).click();

  // 2. OPINIONS — "알겠어요 ▶"로 닫는다.
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expectCoach(page, 2);
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();

  // 3. DISCUSS — 입장 버튼을 바로 눌러도 된다(첫 조작 = 닫힘). 다시 들어와도 한 번뿐이다.
  await expectCoach(page, 3);
  await expect(page.getByTestId('coach-lines').locator('li')).toHaveCount(4);
  await page.getByTestId('discuss-side-for').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('phrase-card-P1').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0); // 팝업 안에는 코치가 없다
  for (const feature of ['summary', 'compare', 'refine'] as const) {
    await page.getByTestId(`assistant-action-${feature}`).click();
    await expect(page.getByTestId(`assistant-done-${feature}`)).toBeVisible({ timeout: 15_000 });
  }
  await page.getByTestId('assistant-close').click();
  await expect(page.getByTestId('assistant-panel')).toHaveCount(0);
  await expect(page.getByTestId('submit-opinion')).toBeEnabled();
  await page.getByTestId('submit-opinion').click();

  // 4. REACTIONS 1/2
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expectCoach(page, 4);
  await page.getByTestId('coach-ack').click();
  await page.getByTestId('reactions-advance').click();
  await expect(page.getByTestId('followup-textarea')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0); // 2/2 다시 답하기에는 코치가 없다
  await page.getByTestId('keep-previous-answer').click();

  // MOTION에는 코치가 없다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('freeze-motion').click();

  // 5. VOTE — 도장 라벨을 바로 눌러도 된다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectCoach(page, 5);
  await page.locator('label.vote-choice--yes').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await page.getByTestId('confirm-vote').click();

  // 6. RESULT — 마지막 안내.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expectCoach(page, 6);
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
});

test('?coach=off로 시작: 코치가 한 번도 뜨지 않고 버튼 잠금만으로 끝까지 간다', async ({ page }) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
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

test('안내가 떠 있는 화면을 건너뛰고 다음 화면으로 가도 이전 화면 안내는 다시 나오지 않는다', async ({ page }) => {
  await startWithCoach(page);
  await expectCoach(page, 1);
  // 안내를 닫지 않고 바로 진행한다(자료 → 의견 듣기). 첫 조작이므로 1번은 이미 닫혔다.
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expectCoach(page, 2);
  // 안내가 떠 있어도 다음 버튼이 눌린다.
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await expectCoach(page, 3);
});

test('운영 메뉴에서 안내를 끄면 코치가 사라지고, 다시 켜면 이 화면 안내부터 나온다', async ({ page }) => {
  await startWithCoach(page);
  await expectCoach(page, 1);

  // 안내가 떠 있어도 운영 메뉴는 누를 수 있고, 메뉴 조작은 "첫 조작"으로 세지 않는다.
  await page.getByTestId('operator-menu-button').click();
  await expect(page.getByTestId('coach')).toHaveCount(1);
  await page.getByTestId('operator-toggle-coach').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);

  await page.getByTestId('operator-menu-button').click();
  await expect(page.getByTestId('operator-toggle-coach')).toHaveText('안내 켜기');
  await page.getByTestId('operator-toggle-coach').click();
  await expectCoach(page, 1);
});

test('알겠어요로 닫으면 안내 아이콘이 남고, 누르면 다시 열려 닫기·Esc로 닫힌다', async ({ page }) => {
  await startWithCoach(page);
  await expectCoach(page, 1);
  await expect(page.getByTestId('coach-icon')).toHaveCount(0);
  await expect(page.getByTestId('coach-ack')).toHaveText('알겠어요 ▶');
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);

  const icon = page.getByTestId('coach-icon');
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAccessibleName('안내 다시 보기');
  // 아이콘은 무대 사진 안쪽에 있다(720에서도 밖으로 나가지 않는다).
  const band = (await page.getByTestId('stage-band').boundingBox())!;
  const box = (await icon.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(band.x);
  expect(box.y).toBeGreaterThanOrEqual(band.y);
  expect(box.x + box.width).toBeLessThanOrEqual(band.x + band.width);
  expect(box.y + box.height).toBeLessThanOrEqual(band.y + band.height);

  await icon.click();
  await expectCoach(page, 1);
  await expect(page.getByTestId('coach-ack')).toHaveText('닫기 ▶');
  // 다시 연 안내는 다른 조작으로는 닫히지 않는다.
  await page.getByTestId('open-evidence').click();
  await expect(page.getByTestId('evidence-dialog')).toBeVisible();
  // 팝업이 열려 있는 동안 코치(말풍선·아이콘)는 그리지 않는다(Codex 44차 — 축소 모드에서는 z-index로 못 막음).
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(page.getByTestId('coach-icon')).toHaveCount(0);
  // 팝업을 닫으면 다시 연 안내가 돌아온다(Esc는 팝업이 쓴다).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('evidence-dialog')).toHaveCount(0);
  await expect(page.getByTestId('coach')).toHaveCount(1);
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(icon).toBeVisible();

  await icon.click();
  await expect(page.getByTestId('coach')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('coach')).toHaveCount(0);
  await expect(icon).toBeVisible();

  // 화면이 바뀌면 그 화면의 첫 안내가 자동으로 뜨고 아이콘은 사라진다.
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expectCoach(page, 2);
  await expect(page.getByTestId('coach-icon')).toHaveCount(0);
});

test('?coach=off면 안내 아이콘도 없다', async ({ page }) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await expect(page.getByTestId('open-evidence')).toBeVisible();
  await expect(page.getByTestId('coach-icon')).toHaveCount(0);
});
