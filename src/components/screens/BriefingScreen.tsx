// 브리핑 화면: 안건·의장 브리핑 3문장·자료 4장(해석 한 줄 + 관련 임원)·핵심 쟁점
// 3개·조건 미리보기 4칩(읽기 전용)을 보여준다(v0.9, REVISION_DECISIONS_v0.9.md 1-1~1-4).
// 핵심 쟁점 카드는 버튼 조작 없이 상시 표시하고 '체험용 사전 구성'을 함께 보여준다
// (CLAUDE_IMPLEMENTATION.md 5장 첫 문단). 카드가 화면에 렌더되면 세션당 한 번만
// MARK_SUMMARY_SHOWN을 기록한다(briefingSummary는 그 기록용으로만 남아 있다).

import { useEffect, useRef } from 'react';
import type { Scenario } from '../../content/types';
import { Avatar } from '../parts/Avatar';
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
    <section className="screen briefing-screen">
      <h2 className="briefing-screen__motion">{scenario.originalMotion.text}</h2>
      <div className="chair-briefing" data-testid="chair-briefing">
        <p className="chair-briefing__situation">{scenario.chairBriefing.situation}</p>
        <p className="chair-briefing__question">{scenario.chairBriefing.question}</p>
        <p className="chair-briefing__role">{scenario.chairBriefing.role}</p>
      </div>
      <div className="briefing-screen__body">
        <div className="briefing-screen__evidence-grid">
          {scenario.evidence.map((card) => (
            <article key={card.id} className="evidence-card">
              <h3 className="evidence-card__title">
                {card.id} · {card.title}
              </h3>
              <p className="evidence-card__content">{card.content}</p>
              <p className="evidence-card__insight-label">이 자료가 말하는 것</p>
              <p className="evidence-card__insight">{card.insight}</p>
              <div className="evidence-card__avatars">
                {card.relatedMemberIds.map((memberId) => (
                  <Avatar key={memberId} memberId={memberId} size="sm" />
                ))}
              </div>
            </article>
          ))}
        </div>
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
      <p className="briefing-screen__time-note">남은 시간은 충분합니다.</p>
      <button type="button" className="cta" onClick={onNext}>
        의견 듣기
      </button>
    </section>
  );
}
