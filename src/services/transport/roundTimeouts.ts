// 서버 /api/health가 내려주는 라운드/반응 타임아웃 값의 클라이언트 캐시(T65). live.ts가
// 8초를 하드코딩하지 않고 이 값을 읽는다. app/mode.ts가 세션 시작 전 서버 가용성 확인
// 응답에서 setRoundTimeouts()로 채우고, 서버가 없거나(scripted) 값이 없으면 기본값
// (8000/12000)을 그대로 쓴다 — AGENT_BOARDROOM_SPEC.md 6장의 OPINIONS·VOTE 8초,
// REACTIONS·FOLLOWUP 12초 기본값과 같다.

export interface RoundTimeouts {
  roundTimeoutMs: number;
  reactionTimeoutMs: number;
}

export const DEFAULT_ROUND_TIMEOUTS: RoundTimeouts = {
  roundTimeoutMs: 8000,
  reactionTimeoutMs: 12000,
};

/** 클라이언트 fetch abort 타이머는 서버 per-role 타임아웃(roundTimeoutMs)보다 이만큼 더
 * 늦게 끊는다(PR #11 Codex 24차 P1). 서버는 요청을 받은 뒤에야 자기 타이머를 시작하므로,
 * 클라이언트 타이머가 서버와 정확히 같은 길이면 실제로는 네트워크 왕복·JSON 직렬화 시간만큼
 * 먼저 abort된다 — 그러면 일부 역할만 실패한 Promise.allSettled 응답이 거의 도착한 순간에도
 * 클라이언트가 요청 전체를 끊어 4명 모두 failed(timeout)로 남고, "다시 요청"이 이미
 * 도착했어야 할 표까지 다시 부르게 된다. 여유를 두어 서버가 부분 실패를 내려줄 시간을
 * 보장한다. boardAgents/live.ts(요청 abort 타이머)와 orchestrator/runner.ts(표결 최초 대기,
 * PR #11 Codex 25차 P2)가 함께 쓴다 — 두 값이 갈라지면 유효한 응답이 UNCAST로 잘못
 * 확정될 수 있다. */
export const TRANSPORT_MARGIN_MS = 1500;

let cached: RoundTimeouts = { ...DEFAULT_ROUND_TIMEOUTS };

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** /api/health 응답 본문에서 두 값을 읽어 캐시를 갱신한다. 값이 없거나 잘못됐으면(구버전
 * 서버 등) 기존 캐시 값을 그대로 둔다. */
export function setRoundTimeouts(body: unknown): void {
  if (typeof body !== 'object' || body === null) {
    return;
  }
  const roundTimeoutMs = (body as { roundTimeoutMs?: unknown }).roundTimeoutMs;
  const reactionTimeoutMs = (body as { reactionTimeoutMs?: unknown }).reactionTimeoutMs;
  cached = {
    roundTimeoutMs: isPositiveNumber(roundTimeoutMs) ? roundTimeoutMs : cached.roundTimeoutMs,
    reactionTimeoutMs: isPositiveNumber(reactionTimeoutMs) ? reactionTimeoutMs : cached.reactionTimeoutMs,
  };
}

export function getRoundTimeouts(): RoundTimeouts {
  return cached;
}

/** 테스트 전용: 캐시를 기본값으로 되돌린다(모듈이 싱글턴이라 테스트 간에 값이 새기 쉽다). */
export function resetRoundTimeouts(): void {
  cached = { ...DEFAULT_ROUND_TIMEOUTS };
}
