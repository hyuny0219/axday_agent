// 상단 공통 바: BOARDROOM 2026 · 단계명 · 남은 시간 자리(DESIGN_SPEC.md 3장 "공통" 문단).
// 실제 카운트다운 표시는 T11(운영 규칙 연결)에서 domain/clock.ts의 remaining()으로 채운다.

import type { SessionStage } from '../../domain/types';
import '../../styles/screens/shell.css';

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
  stage: SessionStage;
}

export function Header({ stage }: HeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header__brand">BOARDROOM 2026</span>
      <span className="app-header__stage">{STAGE_LABELS[stage]}</span>
      <span className="app-header__timer" data-testid="timer-slot" aria-hidden="true">
        --:--
      </span>
    </header>
  );
}
