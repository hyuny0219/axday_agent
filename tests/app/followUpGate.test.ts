// live 후속 대기 게이트 판정(T46, PR #7 Codex 1차 검토 반영): effect가 세우는 state가
// 아니라 세션 상태에서 동기적으로 계산되므로 MOTION 첫 렌더부터 잠겨 있어야 한다.

import { describe, expect, it } from 'vitest';
import { isFollowUpGateActive, type FollowUpGateSession } from '../../src/app/followUpGate';

function session(overrides: Partial<FollowUpGateSession> = {}): FollowUpGateSession {
  return {
    mode: 'live',
    stage: 'MOTION',
    sessionId: 's1',
    opinions: [
      { id: 'o1', originalText: '첫 의견', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 0 },
      { id: 'o2', originalText: '후속 답', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 1 },
    ],
    ...overrides,
  };
}

describe('isFollowUpGateActive', () => {
  it('live MOTION에서 후속 의견이 있고 아직 settle되지 않았으면 첫 렌더부터 잠근다', () => {
    expect(isFollowUpGateActive(session(), null)).toBe(true);
  });

  it('같은 세션의 FOLLOWUP promise가 settle되면 연다', () => {
    expect(isFollowUpGateActive(session(), 's1')).toBe(false);
  });

  it("'의견 유지'(후속 의견 없음) 경로는 라운드가 없어 잠그지 않는다", () => {
    expect(isFollowUpGateActive(session({ opinions: session().opinions.slice(0, 1) }), null)).toBe(false);
  });

  it('scripted는 잠그지 않는다', () => {
    expect(isFollowUpGateActive(session({ mode: 'scripted' }), null)).toBe(false);
  });

  it('MOTION 밖(VOTE·RESULT)에서는 꺼진다 — 만료로 RESULT에 들어가도 영구 잠금이 없다', () => {
    expect(isFollowUpGateActive(session({ stage: 'RESULT' }), null)).toBe(false);
    expect(isFollowUpGateActive(session({ stage: 'VOTE' }), null)).toBe(false);
  });

  it('리셋으로 sessionId가 바뀌면 이전 세션의 settle 기록은 새 세션을 열지 않는다', () => {
    expect(isFollowUpGateActive(session({ sessionId: 's2' }), 's1')).toBe(true);
  });
});
