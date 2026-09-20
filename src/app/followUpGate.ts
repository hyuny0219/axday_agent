// live 후속 대기 게이트(T46, DESIGN_SPEC.md v1.0 7절 "후속 대기 게이트")의 판정을 세션
// 상태에서 동기적으로 계산한다. 게이트를 effect가 세우는 state(초기값 false)로 두면
// SUBMIT_FOLLOWUP 직후 MOTION의 첫 프레임에서는 아직 false라, effect가 돌기 전 들어온
// 빠른 클릭이 FOLLOWUP promise가 settle되기 전에 VOTE로 넘어갈 수 있다(PR #7 Codex 1차
// 검토). 그래서 "이 세션의 FOLLOWUP 라운드가 settle됐는가"만 state로 두고(settle된
// sessionId), 게이트 자체는 매 렌더에서 세션 상태로부터 계산한다 — MOTION 첫 커밋부터
// 참이다.

import type { Session } from '../domain/types';

export type FollowUpGateSession = Pick<Session, 'mode' | 'stage' | 'opinions' | 'sessionId'>;

/**
 * live·MOTION·후속 의견이 있는(opinions ≥ 2, 즉 FOLLOWUP 라운드가 도는) 세션에서, 그
 * 세션의 FOLLOWUP promise가 아직 settle되지 않았으면 true. settledSessionId는 마지막으로
 * settle된 라운드의 sessionId(없으면 null)라, 리셋으로 sessionId가 바뀌면 자동으로 다시
 * 잠기고, 같은 세션에서 settle되면 열린다. scripted와 '의견 유지'(opinions 1건) 경로는
 * 라운드가 없으므로 항상 false다.
 */
export function isFollowUpGateActive(
  session: FollowUpGateSession,
  settledSessionId: string | null,
): boolean {
  return (
    session.mode === 'live' &&
    session.stage === 'MOTION' &&
    session.opinions.length >= 2 &&
    settledSessionId !== session.sessionId
  );
}
