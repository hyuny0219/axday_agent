// 250ms마다 domain/clock의 tick을 호출해 필요한 만료·무입력 액션을 dispatch하는 훅.
// 시계는 항상 props로 주입받는다(systemClock 또는 테스트용 fakeClock). setInterval은
// "언제 다시 확인할지"만 정할 뿐, 경과 시간 계산에는 쓰지 않는다 — 실제 시간은
// 매 호출마다 clock.now()로 다시 읽는다.

import { useEffect, useRef } from 'react';
import type { Clock, ClockAction } from '../domain/clock';
import { tick } from '../domain/clock';
import type { Session } from '../domain/types';

const TICK_INTERVAL_MS = 250;

export interface UseTickerOptions {
  session: Session;
  clock: Clock;
  dispatch: (action: ClockAction) => void;
  intervalMs?: number;
}

export function useTicker({ session, clock, dispatch, intervalMs = TICK_INTERVAL_MS }: UseTickerOptions): void {
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    const id = setInterval(() => {
      const actions = tick(sessionRef.current, clock.now());
      for (const action of actions) {
        dispatch(action);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [clock, dispatch, intervalMs]);
}
