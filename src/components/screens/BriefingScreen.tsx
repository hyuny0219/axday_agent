// 브리핑 화면: 사건 라벨+결정 질문 → 현재 상황·제안·아직 정하지 않은 것 → 특별
// 이사님이 할 일+최종 결정 → 판단에 참고할 자료 4장(T52, 2026-09-23 사용자 검토
// "명패 겹침·자료 카드가 안 보임·오른쪽 열을 읽어도 모르겠다"). 안건 콘텐츠 문구
// 자체는 그대로 두고 구조만 바꿨다(T53에서 문구 교체). AI 자동 정리 카드는 T52에서
// 제거됐으므로 표시 기록(SUMMARY_SHOWN)도 남기지 않는다 — 보이지 않는 카드를 표시된
// 것으로 기록하고 결과에 "자동 정리 데모 표시"를 내던 것을 PR #10 Codex 27차 검토(P2)에서
// 함께 뺐다. 콘텐츠의 briefingSummary 필드는 화면에서 쓰지 않는다.
// T45(조종석 배치): 왼쪽 열(app-body__actions)은 "나"의 행동(CTA)만, 오른쪽 열
// (app-body__content)은 회의 정보(안건·브리핑·근거)를 담는다
// (DESIGN_SPEC.md v1.0 6절 표). 근거 카드는 EvidenceGrid(parts)로 옮겨 DiscussScreen과
// 공유한다. 자료 카드에는 E1~E4 ID를 쓰지 않는다(T52) — EvidenceGrid variant="expanded"가
// 클릭 없이 네 장 모두 자료명·해석·원문을 보여준다.

import type { Scenario } from '../../content/types';
import { EvidenceGrid } from '../parts/EvidenceGrid';
import '../../styles/screens/briefing.css';

export interface BriefingScreenProps {
  scenario: Scenario;
  onNext: () => void;
}

export function BriefingScreen({ scenario, onNext }: BriefingScreenProps) {
  return (
    <>
      <div className="app-body__actions screen briefing-screen">
        <button type="button" className="cta" onClick={onNext}>
          의견 듣기
        </button>
      </div>
      <div className="app-body__content screen briefing-screen__info">
        <div className="briefing-screen__block" data-testid="chair-briefing">
          <p className="briefing-screen__incident" data-testid="briefing-incident">
            {scenario.incident.caseLabel} · {scenario.incident.headline}
          </p>
          <h2 className="briefing-screen__question">{scenario.chairBriefing.question}</h2>
        </div>
        <div className="briefing-screen__status" data-testid="briefing-status">
          <p className="briefing-screen__situation">
            <span className="briefing-screen__label">현재 상황</span>
            {scenario.chairBriefing.situation}
          </p>
          <p className="briefing-screen__proposal">
            <span className="briefing-screen__label">제안</span>
            {scenario.motionBreakdown.proposal}
          </p>
          <div className="briefing-screen__undecided">
            <span className="briefing-screen__label">아직 정하지 않은 것</span>
            <ul className="briefing-screen__undecided-list">
              {scenario.motionBreakdown.undecidedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="briefing-screen__role" data-testid="briefing-role">
          <h3 className="briefing-screen__role-heading">특별 이사님이 할 일</h3>
          <p className="briefing-screen__role-text">{scenario.chairBriefing.role}</p>
          <p className="briefing-screen__final-decision">최종 결정: 승인 · 보류 · 부결</p>
        </div>
        <div className="briefing-screen__body">
          <h3 className="briefing-screen__evidence-heading">판단에 참고할 자료</h3>
          <EvidenceGrid evidence={scenario.evidence} variant="expanded" />
        </div>
      </div>
    </>
  );
}
