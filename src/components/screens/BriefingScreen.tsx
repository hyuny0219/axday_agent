// 브리핑 화면(T80, docs/design/mockups/Main.html 시안 그대로, 2026-10-02 사용자 지적
// "지금 화면이 승인된 시안과 다르다" — "시안 이탈 금지"). 오른쪽 종이 한 장에 시안
// 순서 그대로: CONFIDENTIAL 도장 → CASE 칩+사건 한 줄 → 결정 질문(h1 위계, 다른
// 조종석 화면과 같은 이유로 <h2>를 쓴다, OpinionsScreen·MotionScreen과 같은 관행) →
// SITREP·PROPOSAL·UNKNOWN 상자 → YOUR ORDERS 점선 상자 → EXHIBIT(근거 자료 버튼).
// 왼쪽 열(무대·CTA·TRANSCRIPT)은 App.tsx가 StageBand·MinutesPanel로 그리므로 이
// 화면은 app-body__actions에 CTA 하나만 둔다(T45 조종석 배치).
//
// T86(2026-10-07 사용자 — "근거 자료가 버튼 클릭하면 나오는 게 아니고 바로 보이고
// '전문 보기'로 바뀌었네, 예전처럼 버튼으로"): T80이 넣은 EXHIBIT 2×2 요약 카드 상시
// 노출("전문 보기"로 전문을 열던 모양)을 걷어내고, DiscussScreen·ReactionsScreen과
// 같은 패턴(종이 아래쪽 버튼 하나 → EvidenceDialog 팝업)으로 되돌린다. 팝업 동작
// (role="dialog"·포커스 트랩·Esc/딤/닫기 버튼 세 경로·스크롤 잠금)은 전혀 건드리지
// 않는다. BRIEFING은 아직 임원 발언이 없어 statements=[]로 넘긴다(기존 그대로).
// 요약 카드가 빠지며 생기는 종이 아래 여백은 그대로 종이 바탕으로 둔다.
import { useState } from 'react';
import type { Scenario } from '../../content/types';
import { EvidenceDialog } from '../parts/EvidenceDialog';
import '../../styles/screens/briefing.css';

export interface BriefingScreenProps {
  scenario: Scenario;
  onNext: () => void;
}

export function BriefingScreen({ scenario, onNext }: BriefingScreenProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  // 사건 칩(시안 "CASE 02", T83에서 한국어화): scenario.incident.caseLabel이 이미
  // "사건 02" 형식이라 그대로 쓴다(ResultScreen·DiscussScreen·ReactionsScreen도 같다).
  const caseTag = scenario.incident.caseLabel;

  // UNKNOWN 줄: 미정 항목을 " · "로 이어 붙여 흐린 잉크로 보여 준다. 시안 Main.html의
  // 마지막 항목 먹칠(redaction, T80)은 2026-10-07 사용자 지시로 제거했다 — 참가자가
  // 렌더링 오류로 오해할 수 있고, 가린 값이 DOM에 그대로 남아 접근성 보완(aria-label)이
  // 필요했던 연출이라 걷어내고 전부 평문으로 둔다(T81).
  // T84: undecidedItems는 { text, resolvedBy? } 객체 — BRIEFING은 조건 확정 전이라 text 전체.
  const undecidedItems = scenario.motionBreakdown.undecidedItems.map((item) => item.text);

  return (
    <>
      <div className="app-body__actions screen briefing-screen">
        <button type="button" className="cta briefing-screen__cta" onClick={onNext}>
          의견 듣기 ▶
        </button>
      </div>
      <div className="app-body__content screen briefing-screen__info">
        <div className="briefing-screen__paper">
          {/* T87(사용자 — "붉은 상자 안의 글씨는 영어로"): T83에서 한국어로 바꿨던 이
              도장만 영문으로 되돌렸다. */}
          <span className="briefing-screen__stamp" aria-hidden="true">
            CONFIDENTIAL
          </span>
          <div className="briefing-screen__block" data-testid="chair-briefing">
            <div className="briefing-screen__case-row" data-testid="briefing-incident">
              <span className="briefing-screen__case">{caseTag}</span>
              <span className="briefing-screen__headline">{scenario.incident.headline}</span>
            </div>
            <h2 className="briefing-screen__question">{scenario.chairBriefing.question}</h2>
          </div>
          <div className="briefing-screen__status" data-testid="briefing-status">
            <p className="briefing-screen__situation">
              <span className="briefing-screen__label">상황</span>
              {scenario.chairBriefing.situation}
            </p>
            <p className="briefing-screen__proposal">
              <span className="briefing-screen__label">제안</span>
              {scenario.motionBreakdown.proposal}
            </p>
            {undecidedItems.length > 0 && (
              <p className="briefing-screen__undecided">
                <span className="briefing-screen__label briefing-screen__label--unknown">미정</span>
                <span className="briefing-screen__undecided-muted">{undecidedItems.join(' · ')}</span>
              </p>
            )}
          </div>
          <div className="briefing-screen__role" data-testid="briefing-role">
            <span className="briefing-screen__label">특별 이사의 임무</span>
            <p className="briefing-screen__role-text">{scenario.chairBriefing.role}</p>
            <p className="briefing-screen__final-decision">
              최종 선택: <span className="briefing-screen__final-yes">찬성</span> /{' '}
              <span className="briefing-screen__final-no">반대</span>
            </p>
          </div>
          <div className="briefing-screen__exhibit">
            <button
              type="button"
              className="cta cta--secondary"
              onClick={() => setEvidenceOpen(true)}
              data-testid="open-evidence"
            >
              근거 자료 보기 · 자료 4장
            </button>
          </div>
        </div>
      </div>
      {evidenceOpen && (
        <EvidenceDialog
          evidence={scenario.evidence}
          caseTag={caseTag}
          statements={[]}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </>
  );
}
