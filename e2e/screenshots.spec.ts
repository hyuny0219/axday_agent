// T14 디자인 검수용 스크린샷. 선택·브리핑·토론·반응·투표·결과 6장을 두 해상도(desktop-1080,
// desktop-720)로 캡처한다. UPDATE_SCREENSHOTS=1 일 때만 아래 경로에 저장하고 평소에는 test-results/에 둔다.
// desktop-720) 프로젝트마다 docs/screenshots/<project>/<screen>.png로 남긴다.
// DESIGN_SPEC.md 6장 "실제 토론은 시나리오의 P1~P6 체크 카드 6개와 300자 입력창을
// 제공하고, 대표 경로의 최종 조건 4개를 모두 표시한다"에 맞춰 실제 콘텐츠 분량(추천
// 문구 6개 표시·직접 입력 300자에 가까운 실문장·확정 조건 4개)을 채운 상태에서
// 캡처한다. T78(2026-10-02, 안건 교체)부터 기본 안건 ①(ai-approval)로 캡처한다.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

// P1~P4 문구를 그대로 이어 붙인 뒤, 실제 이사회 발언처럼 이어지는 문장을 더해
// 300자 제한에 가깝지만 넘지 않는 분량으로 만든다(축약 없이 실제 콘텐츠).
const DRAFT_TEXT =
  '결재 금액 한도를 정해 소액부터 자동 승인합시다. 자동 승인마다 승인 사유를 기록합시다. ' +
  '승인 뒤 사람이 일부를 다시 보도록 합시다. 잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다. ' +
  '시범 기간에는 자동 승인 건수와 재검토 결과를 함께 공유하고, 확대 여부는 그 기록을 보고 다음 이사회에서 정하겠습니다.';

// 기본 실행에서는 커밋된 PNG를 덮어쓰지 않도록 임시 폴더에 저장한다.
// 문서용 스크린샷을 갱신할 때만 UPDATE_SCREENSHOTS=1 로 실행한다.
const OUTPUT_ROOT = process.env.UPDATE_SCREENSHOTS
  ? path.join('docs', 'screenshots')
  : path.join('test-results', 'screenshots');

async function capture(page: Page, projectName: string, screenName: string) {
  const dir = path.join(OUTPUT_ROOT, projectName);
  mkdirSync(dir, { recursive: true });
  // 화면 전환(220ms opacity/translate)이 끝난 상태로 캡처한다. 진행 중에 찍으면 반투명한
  // 캡처가 남는다(T38 결과 확인에서 발견).
  // 마운트 직후 캡처하면 screen-enter가 아직 시작되지 않아 반투명하게 남을 수 있어
  // (T40 반응 화면에서 발견) 진행 중인 애니메이션이 끝나기를 먼저 기다린다.
  // BRIEFING~RESULT는 `.screen`이 왼쪽(app-body__actions)·오른쪽(app-body__content) 두
  // 개다. 왼쪽은 shell.css에서 애니메이션을 껐지만(AssistantPanel 드로어 때문, T45)
  // 오른쪽은 그대로 opacity 전환이 있다 — `.first()`만 기다리면 왼쪽(애니메이션 없음,
  // 즉시 resolve)만 기다리고 오른쪽이 아직 페이드 중인 상태로 찍혀 종이 패널이 어두운
  // 배경과 섞인 회색으로 캡처된다(실측, T64). 모든 `.screen` 요소를 함께 기다린다.
  await page.locator('.screen').evaluateAll((elements) =>
    Promise.all(elements.flatMap((el) => el.getAnimations().map((a) => a.finished))),
  );
  await page.screenshot({ path: path.join(dir, `${screenName}.png`), animations: 'disabled' });
}

/** T114: 임원 표 순차 공개(약 4초)와 도장이 모두 끝날 때까지 기다린다(무한 반복 애니메이션 제외). */
async function waitForRevealDone(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

test('대기·선택·브리핑·임원 의견·토론·반응·투표·결과를 실제 콘텐츠로 채운 상태로 캡처한다', async ({
  page,
}, testInfo) => {
  await page.goto('/?mode=scripted&coach=off');

  // ATTRACT(T71): 시안(S0_Attract) 그대로 — 무대 풀블리드·제목·CTA.
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
  await capture(page, testInfo.project.name, 'attract');

  await page.getByRole('button', { name: '체험 시작' }).click();

  // INTRO(T95, T104): 목적·성공 기준 한 장과 시작 버튼 하나. 이후 화면 자체를 보이려고
  // `?coach=off`로 시작했다(코치 화면은 아래 별도 테스트).
  await expect(page.getByRole('heading', { name: '오늘 이사님은 특별 이사입니다' })).toBeVisible();
  await capture(page, testInfo.project.name, 'intro');
  await page.getByRole('button', { name: '확인', exact: true }).click();

  // SELECT(T70): 시안(S1_Select) 카드 2장이 보이는 상태. T84 #10부터 카드를 누르면
  // 바로 입장하므로(별도 선택 상태·CTA가 없다) 입장 전 화면을 그대로 캡처한다.
  await expect(page.getByTestId('scenario-card-ai-approval')).toBeVisible();
  await capture(page, testInfo.project.name, 'select');
  await page.getByTestId('scenario-card-ai-approval').click();


  // BRIEFING: 사건·결정 질문·현재 상황/제안/미정·근거 자료 버튼·CTA(T68, T95로
  // "특별 이사의 임무" 상자는 INTRO로 옮겨 뺐다).
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-status')).toBeVisible();
  await expect(page.getByTestId('open-evidence')).toBeVisible();
  // T95: 자료를 열어 닫기 전에는 "의견 듣기 ▶"가 비활성이다 — 캡처 전에 확인한다.
  await expect(page.getByRole('button', { name: '의견 듣기 ▶' })).toBeDisabled();
  await capture(page, testInfo.project.name, 'briefing');

  // BRIEFING(팝업 열림, T68): "근거 자료 보기"를 눌러 EvidenceDialog에서 자료 4장
  // 전문을 보는 상태를 별도로 캡처한다.
  await page.getByTestId('open-evidence').click();
  const evidenceDialog = page.getByTestId('evidence-dialog');
  await expect(evidenceDialog).toBeVisible();
  await expect(evidenceDialog.getByTestId('evidence-card-E4')).toBeVisible();
  // 팝업 자체의 등장 애니메이션(evidenceDialog.css)은 `.screen` 밖이라 capture()의
  // 대기 대상이 아니다 — 여기서 따로 끝나기를 기다려 페이드 중간에 찍히지 않게 한다.
  await page
    .getByTestId('evidence-dialog-backdrop')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await evidenceDialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await capture(page, testInfo.project.name, 'briefing-evidence');
  await page.keyboard.press('Escape');
  await expect(evidenceDialog).toHaveCount(0);

  // T95: 자료 팝업을 한 번 열어 닫았으니(위) "의견 듣기 ▶"는 이미 활성 상태다.
  await page.getByRole('button', { name: '의견 듣기' }).click();

  // OPINIONS: 임원 4명의 첫 의견 카드(오른쪽)와 무대 말풍선·회의록 패널(왼쪽). 말풍선
  // 등장 애니메이션이 끝난 뒤 캡처한다.
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expect(page.getByTestId('minutes-panel')).toHaveCount(0);
  await expect(page.getByTestId('stage-bubble-CFO')).toBeVisible();
  await capture(page, testInfo.project.name, 'opinions');

  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // DISCUSS: 추천 문구 6개가 모두 보이는 상태에서 4개(P1~P4)를 선택해 최종 조건
  // 4개(LIMIT·LOG·REVIEW·OWNER)를 확정하고, 300자에 가까운 직접 입력으로
  // 덮어써 textarea 분량을 함께 보여준다.
  await expect(page.getByTestId('phrase-card-P6')).toBeVisible();
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill(DRAFT_TEXT);
  await expect(page.getByTestId('condition-chip-LIMIT')).toBeVisible();
  await expect(page.getByTestId('condition-chip-LOG')).toBeVisible();
  await expect(page.getByTestId('condition-chip-REVIEW')).toBeVisible();
  await expect(page.getByTestId('condition-chip-OWNER')).toBeVisible();

  // DISCUSS(T97): 문구를 고른 뒤 비서실장 팝업 첫 화면(소개·체크리스트)을 캡처한다.
  // 이 시점에는 전달 버튼이 아직 닫혀 있다.
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeDisabled();
  await page.getByTestId('assistant-toggle').click();
  const assistantDialog = page.getByTestId('assistant-panel');
  await expect(page.getByTestId('assistant-intro')).toBeVisible();
  await page
    .getByTestId('assistant-panel-backdrop')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await assistantDialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await capture(page, testInfo.project.name, 'discuss-assistant-intro');
  await page.getByTestId('assistant-close').click();
  await expect(assistantDialog).toHaveCount(0);

  // 비서실장 세 기능을 쓰고 나면 전달 버튼이 열린 상태가 된다.
  await tryAllAssistantFeatures(page);
  await expect(submitOpinion).toBeEnabled();
  await capture(page, testInfo.project.name, 'discuss');

  // DISCUSS(팝업 열림, T69): "근거 자료 보기"를 눌러 BRIEFING과 같은 EvidenceDialog에서
  // 자료 4장 전문을 보는 상태를 별도로 캡처한다.
  await page.getByTestId('open-evidence').click();
  const discussEvidenceDialog = page.getByTestId('evidence-dialog');
  await expect(discussEvidenceDialog).toBeVisible();
  await expect(discussEvidenceDialog.getByTestId('evidence-card-E4')).toBeVisible();
  await page
    .getByTestId('evidence-dialog-backdrop')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await discussEvidenceDialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await capture(page, testInfo.project.name, 'discuss-evidence');
  await page.keyboard.press('Escape');
  await expect(discussEvidenceDialog).toHaveCount(0);

  await submitOpinion.click();

  // REACTIONS "반응 듣기"(T89 1/2): 반응 카드 2×2(전문 표시) + 추가 질문 상자를 캡처한다.
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  // T45부터는 페이지 자체가 스크롤되지 않아(무스크롤, DESIGN_SPEC.md v1.0 6절) 더는
  // 스크롤을 되돌릴 필요가 없다.
  await capture(page, testInfo.project.name, 'reactions');

  // REACTIONS "다시 답하기"(T89 2/2, DiscussScreen과 같은 구성): MY REPLY 입력 상자·
  // 조건 칩·입장 선택·추천 답변 체크 카드를 캡처한 뒤, 후속 질문 없이 앞선 의견을
  // 유지해 확정한 4개 조건을 그대로 넘긴다.
  await page.getByTestId('reactions-advance').click();
  await expect(page.getByTestId('followup-textarea')).toBeVisible();
  await capture(page, testInfo.project.name, 'reactions-answer');
  // T110: 조건이 맞은 임원은 추가 질문에 답을 전달해야 찬성이 된다 — 책임자를 정하는
  // 추천 답변(OWNER, 이미 확정된 조건)으로 답해 확정한 4개 조건을 그대로 넘긴다. 성공 결과
  // 화면(result.png)이 이 경로다. "답하지 않고 넘어가기"는 실패 도장으로 이어진다(stance.spec).
  await page.getByTestId('followup-option-0').click();
  await page.getByTestId('submit-followup').click();

  // MOTION(T75, S5_Motion): 확정 조건 4개가 반영된 MOTION ON THE TABLE·CONDITIONS·
  // NOT INCLUDED·CHAIR 안내가 모두 보이는 상태를 캡처한 뒤 표결을 건다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('motion-conditions')).toBeVisible();
  await capture(page, testInfo.project.name, 'motion');
  await page.getByTestId('freeze-motion').click();

  // VOTE(T76, S6_Vote): BALLOTS 봉인 패널(왼쪽)과 MOTION 한 줄·찬성/반대 원형 도장
  // 2칸·별도 확정 CTA(오른쪽)가 함께 보이는 초기 상태를 캡처한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await capture(page, testInfo.project.name, 'vote');

  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  // RESULT: 왼쪽 열(TALLY+"처음 화면으로" 보조 CTA)과 오른쪽 열(종이 보고서: 결론·
  // 도장 칸·VERDICTS)이 스크롤 없이 한 화면에 모두 보인다(T66). 표결 배지·결론
  // 도장(T43)이 다 나온 뒤에 캡처한다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
  await expect(page.getByTestId('result-stamp')).toBeVisible();
  await waitForRevealDone(page);
  await expect(page.getByTestId('end-session')).toBeInViewport();
  await capture(page, testInfo.project.name, 'result');

  // 부결 경로(찬성 2석) 스크린샷(T66 완료 확인 "부결 경로 스크린샷 1장 추가"). 같은
  // 세션을 리셋하지 않고 "처음 화면으로" 전에 이미 result.png를 찍었으니, 여기서는
  // 새로 완주해 반대를 확정한다. T84 #5부터 "처음 화면으로"는 확인 단계를 먼저 연다.
  await page.getByTestId('end-session').click();
  await page.getByTestId('end-session-confirm-ok').click();
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  // 조건을 하나도 확정하지 않으면 임원 표는 baseline대로 찬성 1(CEO)·반대 3이다
  // (aiApproval.ts voteRules "always true" 분기). 참가자가 찬성을 더하면 찬성 2·
  // 반대 3으로 부결이면서 "내 표와 같은 표 2석(CEO)"인 C_Result_Reject.html 조합이
  // 그대로 재현된다(e2e/stance.spec.ts의 "조건 없이 진행" 경로와 같다).
  await page.getByTestId('draft-editor-textarea').fill('이 안건을 검토했습니다.');
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  // 조건을 하나도 더하지 않는 BOTH 옵션(T89, 8번 인덱스).
  await page.getByTestId('followup-option-8').click();
  await page.getByTestId('submit-followup').click();
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await page.getByTestId('freeze-motion').click();
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-stamp')).toBeVisible();
  await waitForRevealDone(page);
  await expect(page.getByTestId('end-session')).toBeInViewport();
  await capture(page, testInfo.project.name, 'result-reject');
});

// T103·T104 진행 도우미 캡처: 상황 안내(1/6)와 토론 안내(3/6). 카드가 화면 안에 들어오는 모습을 남긴다.
test('진행 도우미 BRIEFING(1/6)·DISCUSS(3/6) 안내를 캡처한다', async ({ page }, testInfo) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();

  await expect(page.getByTestId('coach-progress')).toHaveText('안내 1/6');
  await page.getByTestId('coach').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await capture(page, testInfo.project.name, 'coach-briefing');

  await page.getByTestId('open-evidence').click();
  await page.getByTestId('evidence-dialog-close').click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await page.getByTestId('coach-ack').click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await expect(page.getByTestId('coach-progress')).toHaveText('안내 3/6');
  await page.getByTestId('coach').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await capture(page, testInfo.project.name, 'coach-discuss');
  // 닫으면 같은 자리에 "안내" 아이콘이 남는다(T106).
  await page.getByTestId('coach-ack').click();
  await expect(page.getByTestId('coach-icon')).toBeVisible();
  await capture(page, testInfo.project.name, 'coach-icon-discuss');
});
