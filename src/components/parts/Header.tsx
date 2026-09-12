// 상단 공통 바: BOARDROOM 2026 · 단계명 · 남은 시간 · 운영 메뉴
// (DESIGN_SPEC.md 3장 "공통" 문단, CLAUDE_IMPLEMENTATION.md 3장 "현장 운영").
// T30에서 진행 방식 배지(LIVE / 사전 구성 시뮬레이션)를 더했다(AGENT_BOARDROOM_SPEC.md
// 6장 "세션 시작 전에 live/scripted 모드를 고정하고 화면에 표시한다").

import type { Clock } from '../../domain/clock';
import type { Session, SessionStage } from '../../domain/types';
import '../../styles/screens/shell.css';
import { OperatorMenu } from './OperatorMenu';
import { Timer } from './Timer';

const MODE_BADGE_TEXT: Record<Session['mode'], string> = {
  live: 'LIVE',
  scripted: '사전 구성 시뮬레이션',
};

const STAGE_LABELS: Record<SessionStage, string> = {
  ATTRACT: '대기',
  SELECT: '안건 선택',
  BRIEFING: '브리핑',
  OPINIONS: '임원 의견',
  DISCUSS: '의견 작성',
  REACTIONS: '반응',
  MOTION: '최종 안건',
  VOTE: '최종 투표',
  RESULT: '결과',
};

export interface HeaderProps {
  session: Session;
  clock: Clock;
  onOperatorReset: () => void;
}

export function Header({ session, clock, onOperatorReset }: HeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header__brand">BOARDROOM 2026</span>
      <span className="app-header__stage">{STAGE_LABELS[session.stage]}</span>
      <div className="app-header__right">
        <span
          className={`mode-badge mode-badge--${session.mode}`}
          data-testid="mode-badge"
        >
          {MODE_BADGE_TEXT[session.mode]}
        </span>
        <Timer session={session} clock={clock} />
        <OperatorMenu onNewSession={onOperatorReset} />
      </div>
    </header>
  );
}
