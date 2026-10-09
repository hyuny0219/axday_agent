// 영문 라벨 회귀 방지(T83, 2026-10-07 사용자 결정 — "화면 문구에 영어 단어가 섞여 있어
// 어색하고 AI스럽다. 사람이 쓰는 것처럼 자연스럽게"). 참가자가 거치는 주요 화면
// (ATTRACT~RESULT)의 눈에 보이는 텍스트에 라틴 알파벳 2자 이상 연속이 있으면 안
// 된다 — 있다면 예외로 정한 것뿐이어야 한다: 역할 약자(CEO·CFO·CAIO·CISO), 타이틀
// `BOARDROOM 2026`, 'AI' 두 글자. 운영자 전용 메뉴(`.operator-menu`, `MODEL_PROVIDER`·
// `scripted` 같은 기술 용어)와 헤더의 세션 코드(`randomUUID` 앞 4자, 장식용 임의 코드라
// 영문·숫자가 섞일 수 있다)는 "주요 화면" 밖이라 이 검사에서 뺀다.
import { test, expect } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

/** 역할 약자·타이틀·'AI'·'Esc'를 뺀 나머지에서 라틴 알파벳 2자 이상 연속을 찾는다.
 * innerText는 flex 자식 사이에 줄바꿈을 넣지 않는 경우가 있어(예: 무대 명패 옆
 * 캡션이 공백 없이 그대로 이어붙는다) 인접 예외 토큰이 "CAIOAI"처럼 붙을 수 있다 —
 * 그래서 단어 경계(`\b`)가 아니라 순수 부분 문자열 제거로 처리한다(이 토큰들이 다른
 * 단어의 일부로 쓰이는 경우가 없다). 'CAIO'가 'AI'를 포함하므로 역할 약자를 먼저
 * 지워야 'AI' 예외가 중복 적용되지 않는다. 'Esc'는 팝업 안내("Esc · 닫기 버튼")의
 * 키보드 키 이름 — 물리 키보드 표기 그대로라 디자인 장식 라벨이 아니다(판단 근거:
 * 한국어 UI에서도 "Esc 키"로 흔히 쓴다). */
const ALLOWED_TOKENS = ['BECOME A BOARD', 'CEO', 'CFO', 'CAIO', 'CISO', 'AI', 'Esc'];
const STRAY_LATIN = /[A-Za-z]{2,}/g;

/** 붉은 사각 도장류(T87, 사용자 — "붉은 상자 안의 글씨는 영어로, 더 비밀요원스럽다")만
 * 예외로 영문을 쓴다. ALLOWED_TOKENS처럼 문서 전체에서 그 단어를 무조건 허용하면
 * 다른 자리에 같은 영문이 새로 생겨도 이 검사가 잡아내지 못하므로, 도장 요소 자체를
 * 지워 "그 요소 안에서만" 예외가 적용되게 좁힌다. */
const STAMP_SELECTORS = [
  '.attract-screen__stamp',
  '.intro-screen__stamp',
  '.opinions-screen__stamp',
  '.briefing-screen__stamp',
  '.vote-screen__stamp',
  '.motion-screen__stamp',
  '.scenario-card__stamp',
  '.stage-band__classified',
  // T89: EvidenceDialog·AssistantPanel 둘 다 공용 DialogShell의 도장을 쓴다
  // (옛 .evidence-dialog__stamp에서 이름이 바뀌었다).
  '.dialog-shell__stamp',
];

/** 운영자 전용 메뉴·헤더 세션 코드·붉은 도장을 DOM에서 지운 뒤 보이는 텍스트만
 * 남긴다(innerText는 aria-hidden 장식 라벨도 포함한다 — 시각적으로 보이면 그대로
 * 검사 대상이다). */
async function visibleBodyTextWithoutOperatorAndSessionCode(page: import('./fixtures').Page): Promise<string> {
  return page.evaluate((stampSelectors) => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const selector of ['.operator-menu', '.app-header__case-file', ...stampSelectors]) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }
    return clone.innerText;
  }, STAMP_SELECTORS);
}

function findStrayLatin(text: string): string[] {
  let cleaned = text;
  for (const token of ALLOWED_TOKENS) {
    cleaned = cleaned.split(token).join(' ');
  }
  return Array.from(cleaned.matchAll(STRAY_LATIN), (m) => m[0]);
}

test('ATTRACT~RESULT 모든 화면에 역할 약자·브랜드명·AI 외의 영문 단어가 남아 있지 않다(부결 경로)', async ({
  page,
}) => {
  await page.goto('/?mode=scripted&coach=off');

  const stray: Record<string, string[]> = {};

  async function checkScreen(label: string) {
    const text = await visibleBodyTextWithoutOperatorAndSessionCode(page);
    const found = findStrayLatin(text);
    if (found.length > 0) {
      stray[label] = found;
    }
  }

  await checkScreen('ATTRACT');

  await page.getByRole('button', { name: '체험 시작' }).click();
  await checkScreen('INTRO');
  await page.getByRole('button', { name: '안내 받으며 시작' }).click();
  await checkScreen('SELECT');

  // T84 #10: 카드 클릭으로 바로 입장한다("이사회 입장" 버튼은 없앴다).
  await page.getByTestId('scenario-card-ai-approval').click();
  await checkScreen('BRIEFING');

  // 근거 자료 팝업도 BRIEFING과 같은 틀(EXHIBIT·CONFIDENTIAL·STATEMENTS)을 쓰므로 함께
  // 연다.
  await page.getByTestId('open-evidence').click();
  await checkScreen('BRIEFING(근거 자료 팝업)');
  await page.getByTestId('evidence-dialog-close').click();

  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await checkScreen('OPINIONS');

  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await checkScreen('DISCUSS');

  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();
  await checkScreen('REACTIONS(반응 듣기)');

  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  await checkScreen('REACTIONS(다시 답하기)');

  // T84 #1: "앞서 전달한 의견을 유지하겠습니다" 체크 카드(followup-option-2)를 보조
  // 버튼 "답하지 않고 넘어가기"로 옮겼다 — 조건을 더 붙이지 않는 경로(부결로
  // 이어진다, aiApproval.ts voteRules의 조건 없는 always 분기)는 이 버튼으로 탄다.
  await page.getByTestId('keep-previous-answer').click();
  await checkScreen('MOTION');

  await page.getByTestId('freeze-motion').click();
  await checkScreen('VOTE');

  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();
  await checkScreen('RESULT');

  await page.getByTestId('result-transcript-toggle').click();
  await checkScreen('RESULT(회의록 전문)');

  expect(stray, `역할 약자·브랜드명·AI 외의 영문이 남아 있다: ${JSON.stringify(stray)}`).toEqual({});
});

// T84: 위 경로는 조건을 하나도 붙이지 않아 항상 부결(aiApproval.ts voteRules의
// 조건 없는 always 분기는 CEO만 찬성)로 끝나, resultCopy.sixMonthsLater.reject만
// 지나갔다 — PASS 전용 문구(resultCopy.sixMonthsLater.pass, 6개월 뒤 카드)에 남아
// 있던 영문 "Agent"(T83 정리 누락, T84에서 "AI 에이전트"로 수정)를 이 검사가 끝내
// 잡아내지 못한 이유다. 조건을 붙여 가결로 이어지는 경로를 따로 둔다.
test('ATTRACT~RESULT 모든 화면에 역할 약자·브랜드명·AI 외의 영문 단어가 남아 있지 않다(조건부 가결 경로)', async ({
  page,
}) => {
  await page.goto('/?mode=scripted&coach=off');

  const stray: Record<string, string[]> = {};

  async function checkScreen(label: string) {
    const text = await visibleBodyTextWithoutOperatorAndSessionCode(page);
    const found = findStrayLatin(text);
    if (found.length > 0) {
      stray[label] = found;
    }
  }

  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '안내 받으며 시작' }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();

  // 승인 사유 기록(LOG) 조건을 DISCUSS에서 확정한다.
  await page.getByTestId('phrase-card-P2').click();
  await tryAllAssistantFeatures(page);
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();

  // 결재 규칙 책임자(OWNER) 조건을 REACTIONS 후속 질문에서 더 확정한다 — LOG+OWNER면
  // CAIO·CISO가 모두 찬성으로 바뀌어 CEO까지 3석 찬성으로 가결이 결정된다(참가자
  // 표와 무관하게, aiApproval.ts voteRules).
  // T89: "반응 듣기"(1/2)에서 "다시 답하기"(2/2)로 넘어간다.
  await page.getByTestId('reactions-advance').click();
  await page.getByTestId('followup-option-0').click();
  const submitFollowup = page.getByTestId('submit-followup');
  await expect(submitFollowup).toBeEnabled();
  await submitFollowup.click();
  await checkScreen('MOTION');

  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await checkScreen('RESULT');

  // "6개월 뒤" 카드(T84 #8)가 가결 + 반영 조건 있음 경로의 resultCopy.sixMonthsLater.pass
  // 문구를 실제로 보여준다 — 이 검사가 전에 놓쳤던 자리다.
  await expect(page.getByTestId('result-epilogue')).toBeVisible();
  await checkScreen('RESULT(6개월 뒤 카드)');

  expect(stray, `역할 약자·브랜드명·AI 외의 영문이 남아 있다: ${JSON.stringify(stray)}`).toEqual({});
});
