// 무입력 75초 안내: "15초 뒤 처음 화면으로 돌아갑니다" + '계속 체험' 버튼
// (CLAUDE_IMPLEMENTATION.md 3장 "현장 운영"). 실제 90초 복귀는 useTicker가 처리하고,
// 이 컴포넌트는 domain/clock.idleState()로만 표시 여부를 판단하는 안내 UI다.

import { useClockNow } from '../../app/useClockNow';
import type { Clock } from '../../domain/clock';
import { idleState } from '../../domain/clock';
import type { Session } from '../../domain/types';

export interface IdleNoticeProps {
  session: Session;
  clock: Clock;
  onContinue: () => void;
}

export function IdleNotice({ session, clock, onContinue }: IdleNoticeProps) {
  const now = useClockNow(clock);

  if (idleState(session, now) !== 'warn') {
    return null;
  }

  return (
    <div className="idle-notice" role="alertdialog" aria-label="무입력 안내" data-testid="idle-notice">
      <p className="idle-notice__message">15초 뒤 처음 화면으로 돌아갑니다</p>
      <button
        type="button"
        className="cta idle-notice__continue"
        onClick={onContinue}
        data-testid="idle-notice-continue"
      >
        계속 체험
      </button>
    </div>
  );
}
