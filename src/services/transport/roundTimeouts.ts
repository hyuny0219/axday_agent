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
