// 무대 말풍선용 핵심 한 구절(T102, 2026-10-08 사용자 — "발언 흐름·임원 의견·이미지 위
// 대화가 너무 중복"). 발언 전문은 오른쪽 종이 카드에서만 읽고, 무대 말풍선은 "지금 누가
// 어떤 기류인지" 한 구절만 보여준다. scripted는 시나리오 데이터의 bubble 필드를 쓰고,
// live(서버 응답은 전문뿐)는 이 순수 함수로 클라이언트에서 줄인다.

export const BUBBLE_MAX_LENGTH = 18;

const SENTENCE_END = /[.!?。！？]/;
const CLAUSE_END = /[,，、]/;

/** 첫 문장을 쉼표·마침표 앞에서 끊고, 18자를 넘으면 18자에서 잘라 "…"을 붙인다. */
export function bubbleLineOf(text: string, maxLength: number = BUBBLE_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return '';
  }
  const sentence = SENTENCE_END.exec(trimmed);
  const firstSentence = sentence ? trimmed.slice(0, sentence.index) : trimmed;
  const clause = CLAUSE_END.exec(firstSentence);
  // 쉼표 앞이 너무 짧으면("그래도,") 의미가 없어 문장 전체를 쓴다.
  const cut = clause && clause.index >= 4 ? firstSentence.slice(0, clause.index) : firstSentence;
  const line = cut.trim();
  if (line.length <= maxLength) {
    return line;
  }
  return `${line.slice(0, maxLength)}…`;
}
