// 영문 라벨 회귀 방지(T83, 2026-10-07 사용자 결정 — "화면 문구에 영어 단어가 섞여 있어
// 어색하고 AI스럽다. 사람이 쓰는 것처럼 자연스럽게"). 참가자가 거치는 주요 화면
// (ATTRACT~RESULT)의 눈에 보이는 텍스트에 라틴 알파벳 2자 이상 연속이 있으면 안
// 된다 — 있다면 예외로 정한 것뿐이어야 한다: 역할 약자(CEO·CFO·CAIO·CISO), 타이틀
// `BOARDROOM 2026`, 'AI' 두 글자. 운영자 전용 메뉴(`.operator-menu`, `MODEL_PROVIDER`·
// `scripted` 같은 기술 용어)와 헤더의 세션 코드(`randomUUID` 앞 4자, 장식용 임의 코드라
// 영문·숫자가 섞일 수 있다)는 "주요 화면" 밖이라 이 검사에서 뺀다.
import { test, expect } from './fixtures';

/** 역할 약자·타이틀·'AI'·'Esc'를 뺀 나머지에서 라틴 알파벳 2자 이상 연속을 찾는다.
 * innerText는 flex 자식 사이에 줄바꿈을 넣지 않는 경우가 있어(예: 무대 명패 옆
 * 캡션이 공백 없이 그대로 이어붙는다) 인접 예외 토큰이 "CAIOAI"처럼 붙을 수 있다 —
 * 그래서 단어 경계(`\b`)가 아니라 순수 부분 문자열 제거로 처리한다(이 토큰들이 다른
 * 단어의 일부로 쓰이는 경우가 없다). 'CAIO'가 'AI'를 포함하므로 역할 약자를 먼저
 * 지워야 'AI' 예외가 중복 적용되지 않는다. 'Esc'는 팝업 안내("Esc · 닫기 버튼")의
 * 키보드 키 이름 — 물리 키보드 표기 그대로라 디자인 장식 라벨이 아니다(판단 근거:
 * 한국어 UI에서도 "Esc 키"로 흔히 쓴다). */
const ALLOWED_TOKENS = ['BOARDROOM 2026', 'CEO', 'CFO', 'CAIO', 'CISO', 'AI', 'Esc'];
const STRAY_LATIN = /[A-Za-z]{2,}/g;

/** 운영자 전용 메뉴·헤더 세션 코드를 DOM에서 지운 뒤 보이는 텍스트만 남긴다(innerText는
 * aria-hidden 장식 라벨도 포함한다 — 시각적으로 보이면 그대로 검사 대상이다). */
async function visibleBodyTextWithoutOperatorAndSessionCode(page: import('./fixtures').Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const selector of ['.operator-menu', '.app-header__case-file']) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }
    return clone.innerText;
  });
}

function findStrayLatin(text: string): string[] {
  let cleaned = text;
  for (const token of ALLOWED_TOKENS) {
    cleaned = cleaned.split(token).join(' ');
  }
  return Array.from(cleaned.matchAll(STRAY_LATIN), (m) => m[0]);
}

test('ATTRACT~RESULT 모든 화면에 역할 약자·BOARDROOM 2026·AI 외의 영문 단어가 남아 있지 않다', async ({
  page,
}) => {
  await page.goto('/?mode=scripted');

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
  await checkScreen('SELECT');

  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByRole('button', { name: '이사회 입장' }).click();
  await checkScreen('BRIEFING');

  // 근거 자료 팝업도 BRIEFING과 같은 틀(EXHIBIT·CONFIDENTIAL·STATEMENTS)을 쓰므로 함께
  // 연다.
  await page.getByTestId('open-evidence').click();
  await checkScreen('BRIEFING(근거 자료 팝업)');
  await page.getByTestId('evidence-dialog-close').click();

  await page.getByRole('button', { name: '의견 듣기' }).click();
  await checkScreen('OPINIONS');

  await page.getByRole('button', { name: '내 의견 말하기' }).click();
  await checkScreen('DISCUSS');

  await page.getByTestId('phrase-card-P1').click();
  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await submitOpinion.click();
  await checkScreen('REACTIONS');

  await page.getByTestId('followup-option-2').click();
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

  expect(stray, `역할 약자·BOARDROOM 2026·AI 외의 영문이 남아 있다: ${JSON.stringify(stray)}`).toEqual({});
});
