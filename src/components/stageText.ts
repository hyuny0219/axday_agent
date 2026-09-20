// 무대 띠(StageBand) 말풍선 텍스트를 만드는 순수 함수. 원문을 바꾸지 않고 "첫 문장
// 최대 40자"로 잘라서 보여주기만 한다(docs/design/DESIGN_SPEC.md v1.0 1절). 문장 부호
// (. ! ? 및 전각 대응)를 기준으로 첫 문장을 찾고, 그래도 40자를 넘으면 40자에서 자른
// 뒤 말줄임표를 붙인다. React 컴포넌트가 아니라 이 파일에서만 문구를 다듬어, StageBand는
// 표시만 담당한다.

const SENTENCE_END = /[.!?。！？]/;

export const STAGE_BUBBLE_MAX_LENGTH = 40;

/** 원문의 첫 문장을 최대 maxLength자로 잘라 돌려준다. 빈 문자열이면 그대로 빈 문자열이다. */
export function firstSentenceClipped(
  text: string,
  maxLength: number = STAGE_BUBBLE_MAX_LENGTH,
): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return '';
  }
  const match = SENTENCE_END.exec(trimmed);
  const firstSentence = match ? trimmed.slice(0, match.index + 1) : trimmed;
  if (firstSentence.length <= maxLength) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, maxLength)}…`;
}
