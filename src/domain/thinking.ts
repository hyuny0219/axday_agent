// 임원이 생각하고 말하듯 "…"로 뜸을 들이는 시간(T148). 2026-10-30 사용자 지시 "고민은 같이 하고 한번에
// 의견 내도록": 임원 모두 함께 "…"로 고민하다가 같은 순간에 발언이 뜬다(한 명씩 차례로 → 동시에).

/** 함께 고민하는 시간. */
export const GROUP_THINK_MS = 2400;

/** 발언 count개가 화면에 뜨는 시각(처음부터 흐른 ms). 모두 같은 순간에 뜬다. */
export function thinkingRevealTimes(count: number): number[] {
  return Array.from({ length: count }, () => GROUP_THINK_MS);
}
