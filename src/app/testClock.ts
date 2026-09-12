// 현장 시연·자동 테스트에서 240초/무입력 타이머를 실제로 기다리지 않고 넘기기 위한
// 테스트 전용 시계. URL에 `?testClock=1`이 없으면 프로덕션 빌드에서도 항상 systemClock만
// 쓰고 window.__boardroom을 만들지 않는다(CLAUDE_IMPLEMENTATION.md 3장 "현장 운영").

import type { Clock } from '../domain/clock';
import { fakeClock, systemClock } from '../domain/clock';

declare global {
  interface Window {
    __boardroom?: {
      /** 테스트 전용 시계를 ms만큼 앞으로 이동한다. */
      advance(ms: number): void;
    };
  }
}

function hasTestClockParam(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('testClock') === '1';
}

/** 이번 페이지 로드에서 쓸 Clock을 정한다. 모듈이 처음 로드될 때 한 번만 호출된다. */
export function resolveClock(): Clock {
  if (!hasTestClockParam()) {
    return systemClock;
  }
  const clock = fakeClock(Date.now());
  window.__boardroom = {
    advance(ms: number) {
      clock.advance(ms);
    },
  };
  return clock;
}

/** 앱 전체가 공유하는 단일 Clock 인스턴스. Header·Timer·IdleNotice·SessionProvider가
 * 모두 이 인스턴스를 참조해야 `?testClock=1`의 advance()가 화면에 동일하게 반영된다. */
export const appClock: Clock = resolveClock();
