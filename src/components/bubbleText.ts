// 무대 말풍선용 핵심 한 구절(T102, 2026-10-08 사용자 — "발언 흐름·임원 의견·이미지 위
// 대화가 너무 중복"). 발언 전문은 오른쪽 종이 카드에서만 읽고, 무대 말풍선은 "지금 누가
// 어떤 기류인지" 한 구절만 보여준다. scripted는 시나리오 데이터의 bubble 필드를 쓰고,
// live(서버 응답은 전문뿐)는 이 순수 함수로 클라이언트에서 줄인다.

export const BUBBLE_MAX_LENGTH = 18;

const SENTENCE_END = /[.!?。！？]/;
const CLAUSE_END = /[,，、]/;
const DIGIT = /[0-9]/;
const OPEN_QUOTES = '“‘"\'「『';
const CLOSE_QUOTES = '”’"\'」』';

/** text에서 pattern과 맞는 첫 위치. 쉼표·마침표 양옆이 숫자("12,345원", "3.5배")면 건너뛴다. */
function findBreak(text: string, pattern: RegExp): number {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (!pattern.test(ch)) continue;
    if (DIGIT.test(text.charAt(i - 1)) && DIGIT.test(text.charAt(i + 1))) continue;
    return i;
  }
  return -1;
}

/** 끊은 뒤 짝 없이 남은 앞 따옴표(“ 등)를 뗀다. */
function stripUnmatchedQuote(line: string): string {
  const first = line.charAt(0);
  const openIndex = OPEN_QUOTES.indexOf(first);
  if (openIndex < 0) return line;
  const rest = line.slice(1);
  return [...CLOSE_QUOTES].some((q) => rest.includes(q)) ? line : rest.trim();
}

/** 첫 문장을 쉼표·마침표 앞에서 끊고, 최대 18자(말줄임표 포함)로 맞춘다. */
export function bubbleLineOf(text: string, maxLength: number = BUBBLE_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return '';
  }
  const sentenceAt = findBreak(trimmed, SENTENCE_END);
  const firstSentence = sentenceAt >= 0 ? trimmed.slice(0, sentenceAt) : trimmed;
  const clauseAt = findBreak(firstSentence, CLAUSE_END);
  // 쉼표 앞이 너무 짧으면("그래도,") 의미가 없어 문장 전체를 쓴다.
  const cut = clauseAt >= 4 ? firstSentence.slice(0, clauseAt) : firstSentence;
  const line = stripUnmatchedQuote(cut.trim());
  if (line.length <= maxLength) {
    return line;
  }
  return `${line.slice(0, maxLength - 1).trimEnd()}…`;
}
