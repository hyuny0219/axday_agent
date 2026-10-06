// 브리핑 화면 정리(T52, 2026-09-23 사용자 검토): 무대 명패 겹침, 자료 카드 상시 노출,
// 오른쪽 열 재구성을 확인한다. "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점
// 목록은 T52에서 없앴다. 진행 스트립이 BRIEFING에서 ①을, DISCUSS에서 ③을 가리키는지도
// 함께 확인한다.
// T68(2026-09-30 사용자 요청): 자료 4장은 더 이상 상시 펼침이 아니라 "근거 자료 보기"
// 버튼 → EvidenceDialog 팝업 안에서만 보인다(오른쪽 열 세로 예산을 줄이려고).
// T80(2026-10-02, Main.html 시안 그대로): 오른쪽 열이 CONFIDENTIAL 도장 → CASE 칩+사건
// 한 줄 → 결정 질문 → SITREP·PROPOSAL·UNKNOWN → YOUR ORDERS → EXHIBIT 2×2 요약 카드
// (팝업 없이 항상 보임, testid `evidence-summary-<id>`) 순서로 바뀌었다 — 전문은 EXHIBIT
// 머리줄의 "전문 보기"(여전히 testid `open-evidence`)로 연다.
// PR #14 Codex 1차 검토(P2, 2026-10-02): 1280×720에서 EXHIBIT 카드 두 장(C·D)이 종이
// 아래로 밀려 그리드 자체의 내부 스크롤(overflow-y:auto) 밖에 있었다 — `toBeVisible()`은
// 그 상태에서도 통과하므로 종이 패널(`.briefing-screen__paper`) 안에 실제로 들어있는지
// bounding box로 직접 확인한다. 같은 차수에서 "전문 보기" 버튼의 보이는 크기를 줄이며
// 터치 타깃이 함께 줄어, 버튼 중심에 겹친 투명 히트 영역(`--touch-min`)으로 보강했다 —
// 버튼 바깥(위로 10px) 지점을 눌러도 열리는지 좌표로 확인한다.

import { test, expect } from './fixtures';

const EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4'];

test('브리핑 오른쪽 열이 사건·결정 질문 → SITREP/PROPOSAL/UNKNOWN → YOUR ORDERS → EXHIBIT 요약 카드 순으로 보이고, "전문 보기"로 자료 4장을 전문으로 본다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-status')).toBeVisible();
  await expect(page.getByTestId('briefing-role')).toBeVisible();
  // 최종 선택 한 줄은 찬성 쪽으로도 반대 쪽으로도 유도하지 않고 그대로 병기된다(시안
  // "FINAL CALL: 찬성 / 반대", T83에서 "최종 선택: 찬성 / 반대"로 한국어화).
  await expect(page.getByTestId('briefing-role')).toContainText('최종 선택: 찬성 / 반대');

  // T52: "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점 목록은 제거됐다.
  await expect(page.getByTestId('briefing-issues')).toHaveCount(0);
  await expect(page.getByTestId('condition-preview')).toHaveCount(0);

  // T80: EXHIBIT 요약 카드 4장은 팝업 없이 항상 보인다(evidence-summary-<id>). 팝업
  // 전용 전문 카드(evidence-card-<id>)는 "전문 보기" 전에는 DOM에 없다.
  // PR #14 Codex 1차 검토(P2): `toBeVisible()`만으로는 그리드 내부 스크롤 밖으로
  // 밀려난 카드도 통과하므로, 종이 패널(`.briefing-screen__paper`) 경계 안에 bounding
  // box가 실제로 들어있는지까지 두 해상도 모두에서 확인한다.
  const paperBox = await page.locator('.briefing-screen__paper').boundingBox();
  expect(paperBox, '종이 패널 위치를 읽을 수 있어야 한다').not.toBeNull();
  for (const id of EVIDENCE_IDS) {
    const summaryCard = page.getByTestId(`evidence-summary-${id}`);
    await expect(summaryCard).toBeVisible();
    await expect(page.getByTestId(`evidence-card-${id}`)).toHaveCount(0);
    const cardBox = await summaryCard.boundingBox();
    expect(cardBox, `${id} 요약 카드 위치를 읽을 수 있어야 한다`).not.toBeNull();
    if (cardBox && paperBox) {
      expect(
        cardBox.y >= paperBox.y - 1 && cardBox.y + cardBox.height <= paperBox.y + paperBox.height + 1,
        `${id} 요약 카드가 종이 패널 밖으로 밀려났다(card top=${cardBox.y}, bottom=${cardBox.y + cardBox.height}, paper top=${paperBox.y}, bottom=${paperBox.y + paperBox.height})`,
      ).toBe(true);
    }
  }
  const openEvidence = page.getByTestId('open-evidence');
  await expect(openEvidence).toHaveText('전문 보기');

  // PR #14 Codex 1차 검토(P2): 보이는 버튼은 작아졌지만(1280에서 약 25px) 중심에 겹친
  // 투명 `::before`가 `--touch-min`(56px) 이상의 히트 영역을 보장한다 — 버튼 자체 높이를
  // 넘어서는 바깥(위로 10px) 지점을 눌러도 여전히 버튼 클릭으로 처리되는지 좌표로
  // 직접 확인한다(계산된 버튼 높이만 재는 검사로는 실제 클릭 가능 여부를 증명하지 못한다).
  const touchArea = await openEvidence.evaluate((el) => {
    const style = getComputedStyle(el, '::before');
    return { width: parseFloat(style.width), height: parseFloat(style.height) };
  });
  expect(
    touchArea.height,
    `전문 보기 버튼의 투명 히트 영역이 44px 미만이다(height=${touchArea.height})`,
  ).toBeGreaterThanOrEqual(44);
  const openBox = await openEvidence.boundingBox();
  expect(openBox, '전문 보기 버튼 위치를 읽을 수 있어야 한다').not.toBeNull();
  if (openBox) {
    const outsideVisibleButtonY = openBox.y - 10;
    expect(
      outsideVisibleButtonY,
      '터치 타깃 검증 전제: 버튼 위 10px 지점이 뷰포트 안에 있어야 한다',
    ).toBeGreaterThan(0);
    await page.mouse.click(openBox.x + openBox.width / 2, outsideVisibleButtonY);
  }
  const dialog = page.getByTestId('evidence-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // 팝업 안에서 자료 4장은 클릭 없이 자료명·해석·원문이 모두 보인다.
  for (const id of EVIDENCE_IDS) {
    const card = dialog.getByTestId(`evidence-card-${id}`);
    await expect(card).toBeVisible();
    await expect(card.locator('.evidence-card__insight')).toBeVisible();
    await expect(card.locator('.evidence-card__meta')).toBeVisible();
    // 카드 안 어디에도 자료 ID가 없다 — 접두("E1 · ")뿐 아니라 원문 속 언급("E1과 다르다")도
    // 참가자에게 ID를 노출한다(PR #10 Codex 29차 검토 P2).
    await expect(card).not.toContainText(/E[1-4]/);
    // 원문은 줄 클램프 없이 마지막 글자까지 카드 안·뷰포트 안에 보인다. visibility·overflow
    // 검사는 CSS line-clamp가 지운 뒷부분을 잡지 못하므로 마지막 글자의 사각형을 직접 본다.
    const tail = await card.locator('.evidence-card__meta').evaluate((el) => {
      const text = el.firstChild as Text;
      const range = document.createRange();
      range.setStart(text, text.length - 1);
      range.setEnd(text, text.length);
      const glyph = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return {
        clamp: getComputedStyle(el).webkitLineClamp,
        glyphBottom: glyph.bottom,
        glyphHeight: glyph.height,
        boxBottom: box.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(tail.clamp, `${id} 원문에 줄 클램프가 걸려 있다`).toBe('none');
    expect(tail.glyphHeight, `${id} 원문 마지막 글자가 그려지지 않았다`).toBeGreaterThan(0);
    expect(
      tail.glyphBottom <= tail.boxBottom + 1,
      `${id} 원문 마지막 글자가 팝업 카드 밖으로 잘린다(glyphBottom=${tail.glyphBottom}, boxBottom=${tail.boxBottom})`,
    ).toBe(true);
  }
  // 팝업 어디에도 자료 ID(E1~E4)가 화면 문구로 나오지 않는다.
  await expect(dialog).not.toContainText(/E[1-4]/);

  // Esc로 닫으면 팝업이 사라지고 포커스가 연 버튼으로 돌아온다.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();

  // 진행 스트립: BRIEFING에서는 ①이 현재 단계다.
  await expect(page.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS에서는 ③이 현재 단계다.
  await expect(page.getByTestId('progress-step-3')).toHaveAttribute('aria-current', 'step');
});

test('근거 자료 팝업이 닫기 버튼·딤 클릭·Esc 세 가지 방법으로 닫히고 그때마다 포커스가 연 버튼으로 돌아온다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  const openEvidence = page.getByTestId('open-evidence');
  const dialog = page.getByTestId('evidence-dialog');

  // 1) 닫기 버튼. 열리면 닫기 버튼에 포커스가 먼저 간다.
  await openEvidence.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('evidence-dialog-close')).toBeFocused();
  await page.getByTestId('evidence-dialog-close').click();
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();

  // 2) 딤(배경) 클릭.
  await openEvidence.click();
  await expect(dialog).toBeVisible();
  await page.getByTestId('evidence-dialog-backdrop').click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();

  // 3) Esc.
  await openEvidence.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();

  // 포커스 트랩: 팝업 안에는 닫기 버튼 하나만 포커스 가능하므로 Tab을 눌러도 팝업
  // 밖(헤더 운영 버튼 등)으로 포커스가 빠져나가지 않는다.
  await openEvidence.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('evidence-dialog-close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('evidence-dialog-close')).toBeFocused();
  await page.getByTestId('evidence-dialog-close').click();
});

test('무대 명패 4개가 서로 겹치지 않고 참가자 좌석에는 명패가 없다', async ({ page }) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  // 참가자 좌석은 명패 없이 글로우·말풍선·표 배지만 둔다(2026-09-28 사용자).
  await expect(
    page.getByTestId('stage-seat-PARTICIPANT').locator('.stage-band__nameplate'),
  ).toHaveCount(0);

  const seatIds = ['CEO', 'CFO', 'CAIO', 'CISO'];
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
