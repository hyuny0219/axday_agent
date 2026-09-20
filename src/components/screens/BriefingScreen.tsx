// 브리핑 화면: 안건·의장 브리핑 3문장·자료 4장(해석 한 줄 + 관련 임원)·핵심 쟁점
// 3개·조건 미리보기 4칩(읽기 전용)을 보여준다(v0.9, REVISION_DECISIONS_v0.9.md 1-1~1-4).
// 핵심 쟁점 카드는 버튼 조작 없이 상시 표시하고 '체험용 사전 구성'을 함께 보여준다
// (CLAUDE_IMPLEMENTATION.md 5장 첫 문단). 카드가 화면에 렌더되면 세션당 한 번만
// MARK_SUMMARY_SHOWN을 기록한다(briefingSummary는 그 기록용으로만 남아 있다).
// T45(조종석 배치): 왼쪽 열(app-body__actions)은 "나"의 행동(CTA)만, 오른쪽 열
// (app-body__content)은 회의 정보(안건·브리핑·근거·쟁점·조건 미리보기)를 담는다
// (DESIGN_SPEC.md v1.0 6절 표). 근거 카드는 EvidenceGrid(parts)로 옮겨 DiscussScreen과
// 공유한다.

import { useEffect, useRef } from 'react';
import type { Scenario } from '../../content/types';
import { EvidenceGrid } from '../parts/EvidenceGrid';
import '../../styles/screens/briefing.css';

export interface BriefingScreenProps {
  scenario: Scenario;
  onSummaryShown: () => void;
  onNext: () => void;
}

export function BriefingScreen({ scenario, onSummaryShown, onNext }: BriefingScreenProps) {
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) {
      return;
    }
    hasShownRef.current = true;
    onSummaryShown();
  }, [onSummaryShown]);

  const previewConditions = scenario.previewConditionIds
    .map((id) => scenario.conditions.find((condition) => condition.id === id))
    .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  return (
    <>
      <div className="app-body__actions screen briefing-screen">
        <button type="button" className="cta" onClick={onNext}>
          의견 듣기
        </button>
      </div>
      <div className="app-body__content screen briefing-screen__info">
        <p className="briefing-screen__incident" data-testid="briefing-incident">
          {scenario.incident.caseLabel} · {scenario.incident.headline}
        </p>
        <h2 className="briefing-screen__motion">{scenario.originalMotion.text}</h2>
        <div className="chair-briefing" data-testid="chair-briefing">
          <p className="chair-briefing__situation">{scenario.chairBriefing.situation}</p>
          <p className="chair-briefing__question">{scenario.chairBriefing.question}</p>
          <p className="chair-briefing__role">{scenario.chairBriefing.role}</p>
        </div>
        <div className="briefing-screen__body">
          <EvidenceGrid evidence={scenario.evidence} />
          <aside className="briefing-issues" data-testid="briefing-issues">
            <p className="briefing-issues__badge">체험용 사전 구성</p>
            <h3 className="briefing-issues__heading">핵심 쟁점</h3>
            <ul className="briefing-issues__list">
              {scenario.briefingIssues.map((issue) => (
                <li key={issue.text} className="briefing-issues__item">
                  <p className="briefing-issues__text">{issue.text}</p>
                  <ul className="briefing-issues__evidence-ids">
                    {issue.evidenceIds.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <div className="condition-preview" data-testid="condition-preview">
          <p className="condition-preview__heading">
            아래 네 가지를 조건으로 붙이면 임원들의 판단이 달라집니다.
          </p>
          <div className="condition-preview__chips">
            {previewConditions.map((condition) => (
              <span
                key={condition.id}
                className="condition-preview__chip"
                data-testid={`condition-preview-chip-${condition.id}`}
                aria-disabled="true"
              >
                {condition.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
