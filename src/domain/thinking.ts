// 임원이 생각하고 말하듯 "…"로 뜸을 들이는 시간(T148). 한 명씩 차례로, 임원마다 조금씩 다르게
// 1.2~2.4초. 무작위 대신 순번으로 정해 같은 화면은 늘 같은 리듬이다(테스트 가능).

export const THINK_MIN_MS = 1200;
export const THINK_MAX_MS = 2400;

/** index번째 발언자의 뜸 시간(1200~2400ms, 100ms 단위). */
export function thinkingDurationMs(index: number): number {
  const steps = (THINK_MAX_MS - THINK_MIN_MS) / 100 + 1;
  return THINK_MIN_MS + ((index * 7 + 3) % steps) * 100;
}

/** 발언 count개가 화면에 뜨는 시각(처음부터 흐른 ms). i번째 발언은 앞 발언 뒤 뜸 시간이 지나야 뜬다. */
export function thinkingRevealTimes(count: number): number[] {
  const times: number[] = [];
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    at += thinkingDurationMs(index);
    times.push(at);
  }
  return times;
}
