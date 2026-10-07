// 쉬운 말 규칙(T93, 2026-10-07 사용자 지시 "AI 임원들이 의견을 내는 것을 초중학생이 봐도
// 이해할 수 있는 수준으로"). 임원 프롬프트(server/prompts/roles/index.ts)와 가독성
// 검사기(scripts/eval-set-run.ts --check)·콘텐츠 테스트(tests/content/)가 같은 금지 어휘
// 목록·문장 길이 기준을 쓰도록 이 파일에 상수로 둔다. 자료 카드·조건 라벨·추천 문구는 T93
// 범위 밖이라(docs/TASKS.md T93) 이 목록으로 검사하지 않는다.

/**
 * 발언에 쓰지 않을 한자어·업무 용어(사용자가 든 예시 7개 + 그 밖의 흔한 업무 용어, 20개
 * 안팎). 측정용 목록이라 서버 검증에서 거절하지 않는다 — eval-set-run.ts --check가 등장
 * 횟수만 센다(라이브 응답), 콘텐츠 테스트는 scripted 발언에서 0건을 요구한다(쓰지 않을
 * 선택권이 있으므로).
 */
export const FORBIDDEN_WORDS: readonly string[] = [
  '재구성',
  '상계',
  '표본',
  '전사',
  '리스크',
  '거버넌스',
  '재검토 절차',
  '가늠',
  '집계',
  '이행',
  '소급',
  '체계',
  '전면',
  '통제',
  '확산',
  '전제',
  '선행',
  '소명',
  '책임 소재',
  '산정',
];

/** "한 문장 25자 안팎"의 목표값. 콘텐츠 테스트의 엄격한 상한으로는 쓰지 않는다(목표일 뿐
 * 규칙이 아니라서, MAX_SENTENCE_CHARS를 따로 둔다). */
export const TARGET_SENTENCE_CHARS = 25;

/** 콘텐츠 테스트가 scripted 발언에 적용하는 문장당 글자 수 상한. 목표값(25자)보다 넉넉히
 * 잡아 자연스러운 조사·어미까지 포함한 문장이 통과하면서도, 지나치게 긴 복문은 걸러낸다. */
export const MAX_SENTENCE_CHARS = 50;

/** 한 발언에 권장하는 문장 수(2~3문장)의 상한. */
export const MAX_SENTENCES_PER_STATEMENT = 3;

/**
 * 임원 발언에만 붙는 쉬운 말 규칙(withExecStyle, prompts/roles/index.ts). 공통
 * 가드레일(prompts/common.ts)에 두면 비서실장 refine·summarize에도 번져 참가자 원문을 다시
 * 쓰게 될 수 있어(EXEC_STYLE_RULE·EXEC_DECISION_RULE과 같은 이유로) 임원 역할 전용으로
 * 한정한다.
 */
export const PLAIN_LANGUAGE_RULE =
  '발언은 중학생이 한 번 듣고 바로 이해할 수 있는 말로 하십시오. 문장은 짧게 끊고(한 문장' +
  ' 25자 안팎), 한 번 발언에는 문장을 2~3개까지만 쓰십시오.' +
  '\n' +
  '한자어나 업무에서만 쓰는 어려운 말("재구성", "상계", "표본", "전사", "리스크",' +
  ' "거버넌스", "재검토 절차" 등) 대신 일상에서 쓰는 말로 바꿔 말하십시오. 예를 들어' +
  ' "재구성"은 "다시 확인", "한도"는 "돈 한도", "책임자"는 "책임질 사람", "기록"은' +
  ' "기록을 남기기"처럼 쉬운 말로 쓰십시오.' +
  '\n' +
  '숫자는 한 번 발언에 하나만 쓰고, 단위도 쉬운 말로 바꾸십시오(예: "하루 수십 건", "열에' +
  ' 넷"). 비유는 한 문장까지 쓸 수 있습니다.' +
  '\n' +
  '조건이나 자료를 가리킬 때는 제공된 한국어 이름을 그대로 불러도 되지만, 그 뜻을 쉬운 말로' +
  ' 한 번 풀어서 설명하십시오.';

/**
 * 문장 경계: 마침표·물음표·느낌표 뒤 공백이나 줄바꿈으로 나눈다. scripted 문구에는
 * 인용 괄호("(E1)" 등)가 없으므로 eval-set-run.ts의 splitSentences보다 단순하게 둔다 —
 * 공백 없이 붙은 문장까지는 나누지 않는다(이 용도는 과집계보다 누락이 안전하다).
 */
export function splitPlainSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 문장 끝 문장부호를 뗀 순수 글자 수(공백 포함). */
function sentenceCharLength(sentence: string): number {
  return sentence.replace(/[.!?]+$/, '').length;
}

/** scripted 콘텐츠 테스트가 문장당 글자 수 상한을 검사할 때 쓰는 문장별 길이 목록. */
export function sentenceCharLengths(text: string): number[] {
  return splitPlainSentences(text).map(sentenceCharLength);
}

/** text에 등장한 금지 어휘 목록(중복 제거). */
export function findForbiddenWords(text: string): string[] {
  return FORBIDDEN_WORDS.filter((word) => text.includes(word));
}

export interface ReadabilityStats {
  sentenceCount: number;
  avgCharsPerSentence: number;
}

/** eval-set-run.ts --check의 가독성 지표(문장당 평균 글자 수, 발언당 문장 수) 집계에 쓴다. */
export function readabilityStats(text: string): ReadabilityStats {
  const lengths = sentenceCharLengths(text);
  if (lengths.length === 0) return { sentenceCount: 0, avgCharsPerSentence: 0 };
  const total = lengths.reduce((sum, n) => sum + n, 0);
  return { sentenceCount: lengths.length, avgCharsPerSentence: total / lengths.length };
}
