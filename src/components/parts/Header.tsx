// 상단 공통 바: BOARDROOM 2026 · 진행 스트립 · 운영 메뉴
// (DESIGN_SPEC.md 3장 "공통" 문단, v1.2). T30에서 진행 방식 배지(LIVE / 사전 구성
// 시뮬레이션)를 더했다(AGENT_BOARDROOM_SPEC.md 6장 "세션 시작 전에 live/scripted
// 모드를 고정하고 화면에 표시한다"). T50(2026-09-22 사용자 결정)에서 240초 카운트다운
// 표시를 없앴다. T67(2026-09-30 사용자 요청)에서 참가자 명패와 단계 이름 칩을 없애고,
// 본문 위에 따로 있던 ProgressStrip을 헤더 가운데로 올렸다(`docs/design/mockups/
// Main.html` 헤더 한 줄: 좌 브랜드·케이스 라벨 | 가운데 01~05 탭 | 우 모드 배지·운영).
// ATTRACT·SELECT는 ProgressStrip이 null을 돌려주므로 가운데가 비고 좌·우만 남는다.
// T78(2026-10-02, 안건 교체): 케이스 번호를 세션의 안건 caseLabel(01/02)로 바꾼다 —
// 안건이 아직 없는 ATTRACT·SELECT에서는 scenario가 null이라 "No. --"를 보여준다
// (시안 Main.html 형식 유지, BriefingScreen·DiscussScreen 등과 같은 caseDigits 규칙).

import type { Session } from '../../domain/types';
import type { Scenario } from '../../content/types';
import '../../styles/screens/shell.css';
import { OperatorMenu } from './OperatorMenu';
import { ProgressStrip } from './ProgressStrip';

// T86(2026-10-07 사용자 — "실시간 표시는 제거해줘", 이어서 "사전 구성 시뮬레이션
// 표시도 빼줘"): live든 scripted든 참가자 화면에는 더 이상 모드 배지를 보여주지
// 않는다(실제 임원처럼 느끼게 하려는 목적). 모드 확인은 운영 메뉴(운영자용, 이
// 배지와 무관)에서만 한다.

export interface HeaderProps {
  session: Session;
  scenario: Scenario | null;
  onOperatorReset: () => void;
}

export function Header({ session, scenario, onOperatorReset }: HeaderProps) {
  // 안건을 고르기 전에는 사건 번호를 숨긴다("사건 --"가 엉뚱해 보임, Opus 최종 검토 should 7).
  const caseLabel = scenario?.incident.caseLabel;
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__brand">BOARDROOM 2026</span>
        {/* "기밀 작전실" 타자기 라벨(T64, Main.html "CASE FILE No. 02 · SESSION 0042",
            T83에서 한국어화). sessionId 앞 4자로 세션을 구분한다 — 장식용 코드라
            sessionId 전체를 노출하지 않는다. */}
        <span className="app-header__case-file" aria-hidden="true">
          {caseLabel ? `${caseLabel} · ` : ''}세션 {session.sessionId.slice(0, 4).toUpperCase()}
        </span>
      </div>
      <div className="app-header__center">
        <ProgressStrip stage={session.stage} />
      </div>
      <div className="app-header__right">
        <OperatorMenu onNewSession={onOperatorReset} />
      </div>
    </header>
  );
}
