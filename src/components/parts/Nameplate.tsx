// 참가자 좌석 명패. "나 · 특별 이사" 표기를 화면 전환과 무관하게 항상 유지한다
// (DESIGN_SPEC.md 3장 "공통" 문단).

import '../../styles/screens/shell.css';

export function Nameplate() {
  return (
    <div className="nameplate">
      <span className="nameplate__name">나</span>
      <span className="nameplate__separator" aria-hidden="true">
        ·
      </span>
      <span className="nameplate__role">특별 이사</span>
    </div>
  );
}
