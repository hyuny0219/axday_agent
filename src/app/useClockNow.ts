// 250ms마다 주입된 Clock의 now()를 다시 읽어 렌더를 갱신하는 훅. Timer·IdleNotice가
// 공유한다. 여기서도 useTicker와 같은 규칙을 따른다: 경과 시간은 항상 clock.now()로만
// 계산하고, setInterval 호출 횟수나 렌더링 횟수로 계산하지 않는다.

import { useEffect, useState } from 'react';
import type { Clock } from '../domain/clock';

const DEFAULT_INTERVAL_MS = 250;

export function useClockNow(clock: Clock, intervalMs: number = DEFAULT_INTERVAL_MS): number {
  const [now, setNow] = useState(() => clock.now());

  useEffect(() => {
    setNow(clock.now());
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [clock, intervalMs]);

  return now;
}
