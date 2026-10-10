// 브리핑 화면 정리(T52, 2026-09-23 사용자 검토): 무대 명패 겹침, 자료 카드 상시 노출,
// 오른쪽 열 재구성을 확인한다. "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점
// 목록은 T52에서 없앴다. 진행 스트립이 BRIEFING에서 ①을, DISCUSS에서 ③을 가리키는지도
// 함께 확인한다.
// T68(2026-09-30 사용자 요청): 자료 4장은 더 이상 상시 펼침이 아니라 "근거 자료 보기"
// 버튼 → EvidenceDialog 팝업 안에서만 보인다(오른쪽 열 세로 예산을 줄이려고).
// T80(2026-10-02, Main.html 시안 그대로)에서 EXHIBIT 2×2 요약 카드 상시 노출로 한 차례
// 바뀌었으나, T86(2026-10-07 사용자 — "예전처럼 버튼으로")에서 다시 버튼 하나 →
// EvidenceDialog 팝업 패턴으로 되돌렸다(DiscussScreen·ReactionsScreen과 같은 모양).

import { test, expect } from './fixtures';

const EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4'];

test('브리핑 오른쪽 열이 사건·결정 질문 → SITREP/PROPOSAL/UNKNOWN → 근거 자료 버튼 순으로 보이고, 버튼으로 자료 4장을 전문으로 본다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-status')).toBeVisible();
  // T95(2026-10-08): "특별 이사의 임무 … 최종 선택: 찬성/반대" 점선 상자는 INTRO
  // 화면이 같은 내용(목적·성공 기준)을 먼저 보여주므로 뺐다 — briefing-role은 더
  // 이상 없다.
  await expect(page.getByTestId('briefing-role')).toHaveCount(0);

  // T52: "체험용 사전 구성" 배지·조건 미리보기 4칩·핵심 쟁점 목록은 제거됐다.
  await expect(page.getByTestId('briefing-issues')).toHaveCount(0);
  await expect(page.getByTestId('condition-preview')).toHaveCount(0);

  // T86: 자료 4장은 팝업 없이는 보이지 않는다(evidence-card-<id> 없음). 근거 자료
  // 버튼만 종이 아래쪽에 있다.
  for (const id of EVIDENCE_IDS) {
    await expect(page.getByTestId(`evidence-card-${id}`)).toHaveCount(0);
  }
  const openEvidence = page.getByTestId('open-evidence');
  await expect(openEvidence).toBeVisible();
  await openEvidence.click();
  const dialog = page.getByTestId('evidence-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // 팝업 안에서 자료 4장은 클릭 없이 자료명·해석·관련 임원이 보인다.
  for (const id of EVIDENCE_IDS) {
    const card = dialog.getByTestId(`evidence-card-${id}`);
    await expect(card).toBeVisible();
    await expect(card.locator('.evidence-card__insight')).toBeVisible();
    await expect(card.locator('.evidence-card__meta')).toBeVisible();
    // 카드 안 어디에도 자료 ID가 없다 — 접두("E1 · ")뿐 아니라 원문 속 언급("E1과 다르다")도
    // 참가자에게 ID를 노출한다(PR #10 Codex 29차 검토 P2).
    await expect(card).not.toContainText(/E[1-4]/);
    // T105: 해석 속 핵심 수치·사실이 굵게 표시되되 카드당 4곳 이하, 제목에는 없다.
    const markCount = await card.locator('.evidence-card__insight mark.key-term').count();
    expect(markCount, `${id} 해석에 강조가 없거나 너무 많다`).toBeGreaterThanOrEqual(1);
    expect(markCount, `${id} 해석 강조가 4곳을 넘는다`).toBeLessThanOrEqual(4);
    await expect(card.locator('.evidence-card__heading mark')).toHaveCount(0);
    // 해석 한 문장은 줄 클램프 없이 마지막 글자까지 카드 안에 보인다(T99: 원문은 카드에서 뺐다).
    const tail = await card.locator('.evidence-card__insight').evaluate((el) => {
      // 핵심 말 강조(T105)로 마지막 조각이 <mark> 안일 수 있어 마지막 텍스트 노드를 찾는다.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode() as Text;
      for (let next = walker.nextNode(); next; next = walker.nextNode()) text = next as Text;
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
      };
    });
    expect(tail.clamp, `${id} 해석에 줄 클램프가 걸려 있다`).toBe('none');
    expect(tail.glyphHeight, `${id} 해석 마지막 글자가 그려지지 않았다`).toBeGreaterThan(0);
    expect(tail.glyphBottom <= tail.boxBottom + 1, `${id} 해석 마지막 글자가 잘린다`).toBe(true);
  }
  // 팝업 어디에도 자료 ID(E1~E4)가 화면 문구로 나오지 않는다.
  await expect(dialog).not.toContainText(/E[1-4]/);

  // Esc로 닫으면 팝업이 사라지고 포커스가 연 버튼으로 돌아온다.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openEvidence).toBeFocused();

  // 진행 스트립: BRIEFING에서는 ①이 현재 단계다.
  await expect(page.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');

  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // DISCUSS에서는 ③이 현재 단계다.
  await expect(page.getByTestId('progress-step-3')).toHaveAttribute('aria-current', 'step');
});

test('근거 자료 팝업이 닫기 버튼·딤 클릭·Esc 세 가지 방법으로 닫히고 그때마다 포커스가 연 버튼으로 돌아온다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
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
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
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
