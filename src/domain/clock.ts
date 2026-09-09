// 주입형 시계와 240초 만료·75/90초 무입력 판정. CLAUDE_IMPLEMENTATION.md 3장
// "시간 만료·리셋"·"현장 운영" 절을 그대로 따른다. 시간은 항상 여기 주입된 Clock의
// now()로만 계산하고, setInterval 호출 횟수나 렌더링 횟수로 계산하지 않는다.
// 이 파일은 세션 상태를 만들지 않는다(reduce는 session.ts의 책임). tick()은 어떤
// action이 필요한지만 알려준다.

import type { Session } from './types';

/** 240초 전체 체험 시간. */
export const EXPERIENCE_MS = 240_000;
/** 남은 시간 60초 경고 기준. */
export const WARN_60 = 60_000;
/** 남은 시간 30초 경고 기준. */
export const WARN_30 = 30_000;
/** 무입력 75초: "15초 뒤 처음 화면으로 돌아갑니다" 경고를 띄우는 기준. */
export const IDLE_WARN_MS = 75_000;
/** 무입력 90초: ATTRACT로 강제 복귀하는 기준. */
export const IDLE_RESET_MS = 90_000;

export interface Clock {
  now(): number;
}

/** 실제 시간을 반환하는 시계. 런타임 앱에서만 사용한다. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface FakeClock extends Clock {
  /** 테스트에서 시간을 ms만큼 앞으로 이동한다. */
  advance(ms: number): void;
}

/** 테스트 전용 결정적 시계. now()는 마지막으로 설정된 값만 반환한다. */
export function fakeClock(start: number): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

export type IdleState = 'active' | 'warn' | 'reset';

/** deadline까지 남은 ms. deadline이 아직 없으면(타이머 시작 전) 전체 시간을 돌려준다. */
export function remaining(session: Session, now: number): number {
  if (session.deadline === null) {
    return EXPERIENCE_MS;
  }
  return Math.max(0, session.deadline - now);
}

/**
 * 마지막 사용자 활동(클릭·키·스크롤) 이후 경과 시간으로 무입력 상태를 판정한다.
 * ATTRACT 화면은 무입력 복귀의 대상이 아니므로 항상 'active'다.
 */
export function idleState(session: Session, now: number): IdleState {
  if (session.stage === 'ATTRACT') {
    return 'active';
  }
  const idleMs = now - session.lastActivityAt;
  if (idleMs >= IDLE_RESET_MS) {
    return 'reset';
  }
  if (idleMs >= IDLE_WARN_MS) {
    return 'warn';
  }
  return 'active';
}

/** tick이 필요하다고 판단한 최소 단위 액션. session.ts의 SessionAction으로의 변환
 * (EXPIRE에 필요한 scenario 채우기 등)은 이 파일이 아니라 호출부의 책임이다. */
export type ClockAction = 'EXPIRE' | 'IDLE_RESET';

/**
 * 주기적으로 호출해 필요한 액션을 결정한다. 같은 tick에서 무입력 리셋과 시간 만료가
 * 동시에 성립하면 무입력 리셋만 우선한다. 이미 RESULT면 EXPIRE를 내지 않는다(결과는
 * 이미 확정돼 있으므로). RESULT 진입 시 lastActivityAt을 다시 시작하는 일은
 * session.ts의 reduce가 담당한다.
 */
export function tick(session: Session, now: number): ClockAction[] {
  if (session.stage === 'ATTRACT') {
    return [];
  }
  if (idleState(session, now) === 'reset') {
    return ['IDLE_RESET'];
  }
  if (session.stage !== 'RESULT' && session.deadline !== null && now >= session.deadline) {
    return ['EXPIRE'];
  }
  return [];
}

/** 클릭·키 입력·실제 스크롤에서만 호출한다. deadline은 늘리지 않고 무입력 시계만 갱신한다. */
export function touch(session: Session, now: number): Session {
  return { ...session, lastActivityAt: now };
}
