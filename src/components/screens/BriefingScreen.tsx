// 브리핑 화면: 안건·의장 발언·자료 4장 + AI 정리 카드. AI 정리 카드는 버튼 조작 없이
// 상시 표시하고 '체험용 사전 구성'과 근거 ID를 함께 보여준다(CLAUDE_IMPLEMENTATION.md
// 5장 첫 문단). 카드가 화면에 렌더되면 세션당 한 번만 MARK_SUMMARY_SHOWN을 기록한다.

import { useEffect, useRef } from 'react';
import type { Scenario } from '../../content/types';
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

  return (
    <section className="screen briefing-screen">
      <h2 className="briefing-screen__motion">{scenario.originalMotion.text}</h2>
      <p className="briefing-screen__chair-line">{scenario.chairLine}</p>
      <div className="briefing-screen__body">
        <div className="briefing-screen__evidence-grid">
          {scenario.evidence.map((card) => (
            <article key={card.id} className="evidence-card">
              <h3 className="evidence-card__title">
                {card.id} · {card.title}
              </h3>
              <p className="evidence-card__content">{card.content}</p>
            </article>
          ))}
        </div>
        <aside className="ai-summary-card" data-testid="ai-summary-card">
          <p className="ai-summary-card__badge">체험용 사전 구성</p>
          <p className="ai-summary-card__text">{scenario.briefingSummary.text}</p>
          <ul className="ai-summary-card__evidence-ids">
            {scenario.briefingSummary.evidenceIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </aside>
      </div>
      <button type="button" className="cta" onClick={onNext}>
        의견 듣기
      </button>
    </section>
  );
}
