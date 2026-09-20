// 참가자 좌석 명패. "나 · 특별 이사" 표기를 화면 전환과 무관하게 항상 유지한다
// (DESIGN_SPEC.md 3장 "공통" 문단).

import '../../styles/screens/shell.css';
import { Avatar } from './Avatar';

export interface NameplateProps {
  /** BRIEFING~RESULT에서는 'nameplate--stage'를 더해 무대 안 좌상단 절대 위치
   * pill로 겹쳐 찍는다(DESIGN_SPEC.md v1.0 6절). 기본값은 SELECT에서 쓰는 여백
   * 있는 형태다. */
  className?: string;
}

export function Nameplate({ className }: NameplateProps = {}) {
  return (
    <div className={className ? `nameplate ${className}` : 'nameplate'} data-testid="nameplate">
      <Avatar memberId="PARTICIPANT" size="sm" />
      <span className="nameplate__name">나</span>
      <span className="nameplate__separator" aria-hidden="true">
        ·
      </span>
      <span className="nameplate__role">특별 이사</span>
    </div>
  );
}
