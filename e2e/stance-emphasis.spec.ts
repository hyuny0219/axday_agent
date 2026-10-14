// T131: AI 임원 찬반 강조 — 카드 색 머리띠(B안)와 무대 명패·빛·집계(C안). scripted 흐름으로
// OPINIONS·REACTIONS에서 머리띠·명패가 보이고, 추가 질문에 답한 뒤(MOTION·VOTE)에는 방향이
// "?"로 가려진 채 유지되며, 1920×1080·1280×720 모두 스크롤·잘림이 없는지 확인한다.

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

async function enterOpinions(page: Page) {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
}

async function expectNoPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(overflow.scrollHeight <= overflow.clientHeight + 1, `${label}: 페이지 스크롤이 생겼다`).toBe(true);
}

/** 머리띠·명패가 안 잘리고 뷰포트 안에 다 보이는지. */
async function expectVisibleInViewport(page: Page, testId: string, label: string) {
  const locator = page.getByTestId(testId);
  await expect(locator, `${label}: ${testId}`).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${label}: ${testId}가 뷰포트를 벗어났다`).toBe(true);
}

test('OPINIONS: 카드마다 색 머리띠와 큰 판정 글자, 무대 명패·빛 고리·집계가 보인다', async ({ page }) => {
  await enterOpinions(page);
  const expected = { CEO: '찬성', CFO: '반대', CAIO: '고민 중', CISO: '반대' } as const;
  await expect(page.getByTestId('stance-band-CISO')).toBeVisible();
  for (const [id, text] of Object.entries(expected)) {
    await expect(page.getByTestId(`exec-mood-label-${id}`)).toHaveText(text);
    await expectVisibleInViewport(page, `stance-band-${id}`, 'OPINIONS 머리띠');
    await expect(page.getByTestId(`stage-mood-${id}`)).toHaveText(text);
    await expectVisibleInViewport(page, `stage-mood-${id}`, 'OPINIONS 명패');
  }
  await expect(page.getByTestId('stance-band-CEO')).toHaveClass(/stance-band--for/);
  await expect(page.getByTestId('stance-band-CFO')).toHaveClass(/stance-band--against/);
  await expect(page.getByTestId('stance-band-CAIO')).toHaveClass(/stance-band--undecided/);
  await expect(page.locator('.stage-band__face-ring')).toHaveCount(4);
  await expect(page.getByTestId('stage-tally')).toContainText('찬성');
  await expectVisibleInViewport(page, 'stage-tally', 'OPINIONS 집계');
  await expectNoPageScroll(page, 'OPINIONS');
});

test('REACTIONS: 기울음은 빗금 띠·"찬성 쪽?"·"답하면 확정", 답한 뒤 MOTION·VOTE는 "?"로 가림이 유지된다', async ({
  page,
}) => {
  await enterOpinions(page);
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();

  // 1/2 반응 듣기: CEO 찬성 확정, CFO·CAIO 기울음, CISO 반대 확정.
  await expect(page.getByTestId('reaction-card-CFO')).toBeVisible();
  for (const id of ['CFO', 'CAIO']) {
    await expect(page.getByTestId(`stance-band-${id}`)).toHaveClass(/stance-band--leaning/);
    await expect(page.getByTestId(`exec-mood-label-${id}`)).toHaveText('찬성 쪽?');
    await expect(page.getByTestId(`reaction-card-badge-${id}`)).toContainText('답하면 확정');
    await expect(page.getByTestId(`stage-mood-${id}`)).toHaveText('찬성 쪽?');
    await expect(page.getByTestId(`stage-mood-${id}`)).toHaveClass(/stage-band__mood--leaning/);
    await expectVisibleInViewport(page, `stance-band-${id}`, 'REACTIONS 머리띠');
  }
  await expect(page.getByTestId('stance-band-CEO')).not.toHaveClass(/stance-band--leaning/);
  await expect(page.getByTestId('exec-mood-label-CEO')).toHaveText('찬성');
  await expect(page.getByTestId('exec-mood-label-CISO')).toHaveText('반대');
  await expect(page.getByTestId('stage-tally')).toContainText('기울음 2');
  await expectNoPageScroll(page, 'REACTIONS(반응 듣기)');

  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();

  // MOTION: 방향을 가린다 — 명패 "?", 빛 고리·집계 없음.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  const expectSealed = async () => {
    for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      await expect(page.getByTestId(`stage-mood-${id}`)).toHaveText('?');
    }
    await expect(page.locator('.stage-band__face-ring')).toHaveCount(0);
    await expect(page.getByTestId('stage-tally')).toHaveCount(0);
    expect((await page.getByTestId('stage-band').textContent()) ?? '').not.toMatch(/찬성|반대/);
  };
  await expectSealed();
  await expectNoPageScroll(page, 'MOTION');
  await page.getByTestId('freeze-motion').click();

  // VOTE: 가림이 표결까지 이어진다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await expectSealed();
  await expectNoPageScroll(page, 'VOTE');
});
