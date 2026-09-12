import { describe, expect, it } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import {
  EXPERIENCE_MS,
  IDLE_RESET_MS,
  IDLE_WARN_MS,
  WARN_30,
  WARN_60,
  fakeClock,
  idleState,
  remaining,
  tick,
  touch,
} from '../../src/domain/clock';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Session } from '../../src/domain/types';

const scenario = aiAssistantScenario;
const T0 = 1_700_000_000_000;

/** ATTRACT를 지나 BRIEFING(deadline이 막 설정된 상태)까지 진행한 세션을 만든다. */
function sessionAtBriefing(now = T0): Session {
  let session = createInitialSession(now);
  session = reduce(session, { type: 'START' }, now);
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, now);
  return session;
}

describe('systemClock/fakeClock', () => {
  it('fakeClock은 advance한 만큼만 now()가 바뀐다', () => {
    const clock = fakeClock(T0);
    expect(clock.now()).toBe(T0);
    clock.advance(1_000);
    expect(clock.now()).toBe(T0 + 1_000);
  });
});

describe('remaining', () => {
  it('deadline이 없으면 전체 체험 시간을 돌려준다', () => {
    const session = createInitialSession(T0);
    expect(remaining(session, T0)).toBe(EXPERIENCE_MS);
  });

  it('60초·30초 경계에서 남은 시간을 정확히 계산한다', () => {
    const session = sessionAtBriefing(T0);
    expect(remaining(session, T0 + EXPERIENCE_MS - WARN_60)).toBe(WARN_60);
    expect(remaining(session, T0 + EXPERIENCE_MS - WARN_30)).toBe(WARN_30);
  });

  it('deadline을 넘겨도 음수가 아니라 0으로 바닥을 둔다', () => {
    const session = sessionAtBriefing(T0);
    expect(remaining(session, T0 + EXPERIENCE_MS + 5_000)).toBe(0);
  });
});

describe('idleState', () => {
  it('ATTRACT는 얼마나 지나도 항상 active다', () => {
    const session = createInitialSession(T0);
    expect(idleState(session, T0 + IDLE_RESET_MS + 10_000)).toBe('active');
  });

  it('75초 미만은 active, 75초부터 warn, 90초부터 reset', () => {
    const session = sessionAtBriefing(T0);
    expect(idleState(session, T0 + IDLE_WARN_MS - 1)).toBe('active');
    expect(idleState(session, T0 + IDLE_WARN_MS)).toBe('warn');
    expect(idleState(session, T0 + IDLE_RESET_MS - 1)).toBe('warn');
    expect(idleState(session, T0 + IDLE_RESET_MS)).toBe('reset');
  });
});

describe('tick', () => {
  it('240초가 되면 EXPIRE를 낸다', () => {
    // 무입력 리셋(90초)이 먼저 끼어들지 않도록 활동 시각을 만료 직전으로 맞춘다.
    let session = sessionAtBriefing(T0);
    session = { ...session, lastActivityAt: T0 + EXPERIENCE_MS - 1 };
    expect(tick(session, T0 + EXPERIENCE_MS - 1)).toEqual([]);
    expect(tick(session, T0 + EXPERIENCE_MS)).toEqual(['EXPIRE']);
  });

  it('무입력 90초가 되면 IDLE_RESET을 낸다', () => {
    const session = sessionAtBriefing(T0);
    expect(tick(session, T0 + IDLE_RESET_MS)).toEqual(['IDLE_RESET']);
  });

  it('같은 tick에 만료와 무입력이 동시에 성립하면 IDLE_RESET만 낸다', () => {
    // deadline(240s)보다 무입력 리셋(90s)이 항상 먼저 오지만, 무입력 시계를 일부러
    // deadline과 같은 시각에 맞춰 두 조건이 같은 tick에서 동시에 성립하게 만든다.
    let session = sessionAtBriefing(T0);
    session = { ...session, lastActivityAt: session.deadline! - IDLE_RESET_MS };
    expect(tick(session, session.deadline!)).toEqual(['IDLE_RESET']);
  });

  it('이미 RESULT면 EXPIRE를 내지 않는다', () => {
    let session = sessionAtBriefing(T0);
    session = { ...session, stage: 'RESULT', deadline: T0 };
    expect(tick(session, T0 + 10_000)).toEqual([]);
  });

  it('RESULT에서도 무입력 90초가 지나면 다시 IDLE_RESET을 낸다', () => {
    let session = sessionAtBriefing(T0);
    // RESULT 진입 시 lastActivityAt 재설정은 reducer 몫이므로 여기서는 진입 시각을 흉내낸다.
    session = { ...session, stage: 'RESULT', lastActivityAt: T0 };
    expect(tick(session, T0 + IDLE_RESET_MS)).toEqual(['IDLE_RESET']);
  });

  it('ATTRACT에서는 아무 액션도 내지 않는다', () => {
    const session = createInitialSession(T0);
    expect(tick(session, T0 + EXPERIENCE_MS + IDLE_RESET_MS)).toEqual([]);
  });
});

describe('touch', () => {
  it('lastActivityAt만 갱신하고 deadline은 늘리지 않는다', () => {
    const session = sessionAtBriefing(T0);
    const touched = touch(session, T0 + 50_000);
    expect(touched.lastActivityAt).toBe(T0 + 50_000);
    expect(touched.deadline).toBe(session.deadline);
  });
});
