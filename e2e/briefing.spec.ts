// 브리핑 화면 정리(T52, 2026-09-23 사용자 검토): 무대 명패 겹침, 자료 카드 상시 노출,
// 오른쪽 열 재구성을 확인한다. "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점
// 목록은 T52에서 없앴다. 진행 스트립이 BRIEFING에서 ①을, DISCUSS에서 ③을 가리키는지도
// 함께 확인한다.

import { test, expect } from './fixtures';

const EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4'];

test('브리핑 오른쪽 열이 사건·결정 질문 → 현재 상황/제안/미정 → 할 일/최종 결정 → 자료 4장 순으로 보인다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-status')).toBeVisible();
  await expect(page.getByTestId('briefing-role')).toBeVisible();
  // 최종 결정 한 줄은 승인 쪽으로도 부결 쪽으로도 유도하지 않고 그대로 병기된다.
  await expect(page.getByTestId('briefing-role')).toContainText('최종 결정: 승인 · 보류 · 부결');

  // T52: "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점 목록은 제거됐다.
  await expect(page.getByTestId('briefing-issues')).toHaveCount(0);
  await expect(page.getByTestId('condition-preview')).toHaveCount(0);

  // 자료 4장은 클릭 없이 자료명·해석·원문이 모두 보인다.
  for (const id of EVIDENCE_IDS) {
    const card = page.getByTestId(`evidence-card-${id}`);
    await expect(card).toBeVisible();
    await expect(card.locator('.evidence-card__insight')).toBeVisible();
    await expect(card.locator('.evidence-card__content')).toBeVisible();
    // 카드 안 어디에도 ID 접두("E1 · " 같은)가 남아 있지 않다.
    await expect(card).not.toContainText(`${id} ·`);
  }

  // 진행 스트립: BRIEFING에서는 ①이 현재 단계다.
  await expect(page.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS에서는 ③이 현재 단계다.
  await expect(page.getByTestId('progress-step-3')).toHaveAttribute('aria-current', 'step');
});

test('무대 명패 5개가 서로 겹치지 않는다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-anon-board').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();

  const seatIds = ['CEO', 'CFO', 'CAIO', 'CISO', 'PARTICIPANT'];
  const boxes = [];
  for (const seatId of seatIds) {
    const nameplate = page.getByTestId(`stage-seat-${seatId}`).locator('.stage-band__nameplate');
    await expect(nameplate).toBeVisible();
    const box = await nameplate.boundingBox();
    expect(box, `${seatId} 명패의 위치를 읽을 수 있어야 한다`).not.toBeNull();
    if (box) {
      boxes.push({ seatId, box });
    }
  }

  function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      expect(
        overlaps(boxes[i]!.box, boxes[j]!.box),
        `${boxes[i]!.seatId} 명패와 ${boxes[j]!.seatId} 명패가 겹치면 안 된다`,
      ).toBe(false);
    }
  }
});
