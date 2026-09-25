// 상단 공통 바: BOARDROOM 2026 · 단계명 · 운영 메뉴
// (DESIGN_SPEC.md 3장 "공통" 문단). T30에서 진행 방식 배지(LIVE / 사전 구성 시뮬레이션)를
// 더했다(AGENT_BOARDROOM_SPEC.md 6장 "세션 시작 전에 live/scripted 모드를 고정하고
// 화면에 표시한다"). T50(2026-09-22 사용자 결정)에서 240초 카운트다운 표시를 없앴다.

import type { Session, SessionStage } from '../../domain/types';
import '../../styles/screens/shell.css';
import { Nameplate } from './Nameplate';
import { OperatorMenu } from './OperatorMenu';

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
  onOperatorReset: () => void;
}

export function Header({ session, onOperatorReset }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__brand">BOARDROOM 2026</span>
        {/* 참가자 명패는 헤더 좌측에 상시 둔다(v1.0 6절 개정: 무대 좌상단 pill은
            의장 말풍선과 겹쳐 헤더로 옮겼다). ATTRACT에서는 아직 좌석이 없으므로 숨긴다. */}
        {session.stage !== 'ATTRACT' && <Nameplate className="nameplate--header" />}
      </div>
      <span className="app-header__stage">{STAGE_LABELS[session.stage]}</span>
      <div className="app-header__right">
        <span
          className={`mode-badge mode-badge--${session.mode}`}
          data-testid="mode-badge"
        >
          {MODE_BADGE_TEXT[session.mode]}
        </span>
        <OperatorMenu onNewSession={onOperatorReset} />
      </div>
    </header>
  );
}
