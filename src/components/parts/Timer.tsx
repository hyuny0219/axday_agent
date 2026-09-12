// 헤더에 표시하는 mm:ss 카운트다운. domain/clock.remaining()으로 남은 시간을 계산하고,
// 60초·30초 진입 시 짧은 문구를 잠깐 보여준다(DESIGN_SPEC.md 4장 "타이머"). 30초 이하는
// 앰버 색으로만 강조하며 점멸·경고음은 쓰지 않는다.

import { useEffect, useRef, useState } from 'react';
import { useClockNow } from '../../app/useClockNow';
import type { Clock } from '../../domain/clock';
import { WARN_30, WARN_60, remaining } from '../../domain/clock';
import type { Session } from '../../domain/types';

const NOTICE_DURATION_MS = 4_000;

export interface TimerProps {
  session: Session;
  clock: Clock;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function Timer({ session, clock }: TimerProps) {
  const now = useClockNow(clock);
  const [notice, setNotice] = useState<string | null>(null);
  const shownRef = useRef({ warn60: false, warn30: false });

  // 새 세션(다른 sessionId)이 되면 60초/30초 안내를 다시 보여줄 수 있게 초기화한다.
  useEffect(() => {
    shownRef.current = { warn60: false, warn30: false };
    setNotice(null);
  }, [session.sessionId]);

  const remainingMs = session.deadline === null ? null : remaining(session, now);

  useEffect(() => {
    if (remainingMs === null) {
      return;
    }
    if (remainingMs <= WARN_30 && !shownRef.current.warn30) {
      shownRef.current.warn30 = true;
      setNotice('남은 시간 30초입니다');
    } else if (remainingMs <= WARN_60 && !shownRef.current.warn60) {
      shownRef.current.warn60 = true;
      setNotice('남은 시간 60초입니다');
    }
  }, [remainingMs]);

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const id = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(id);
  }, [notice]);

  const isAmber = remainingMs !== null && remainingMs <= WARN_30;

  return (
    <div className="app-timer">
      <span
        className={`app-header__timer${isAmber ? ' app-header__timer--amber' : ''}`}
        data-testid="timer-slot"
      >
        {remainingMs === null ? '--:--' : formatRemaining(remainingMs)}
      </span>
      {notice !== null && (
        <span className="app-timer__notice" role="status" data-testid="timer-notice">
          {notice}
        </span>
      )}
    </div>
  );
}
