// 엔딩 화면(T127)의 자동 복귀 규칙. 시간은 주입된 Clock으로만 잰다(렌더 횟수·틱 수로 세지 않는다).

/** 엔딩이 열린 뒤(또는 마지막 입력 뒤) 처음 화면으로 돌아가기까지의 시간(초). */
export const ENDING_AUTO_RETURN_SECONDS = 60;

/** 남은 시간을 확인하는 주기(ms). 표시는 초 단위지만 입력 직후 값이 어긋나지 않게 촘촘히 본다. */
export const ENDING_TICK_MS = 250;

/** 마감 시각(ms)까지 남은 초(올림, 0 미만 없음). */
export function endingSecondsLeft(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function endingDeadline(startMs: number): number {
  return startMs + ENDING_AUTO_RETURN_SECONDS * 1000;
}
