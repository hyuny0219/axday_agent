// 임원 의견 화면: 임원 4명의 한 줄 의견을 보여주고, 펼치면 근거 자료를 보여준다
// (CLAUDE_IMPLEMENTATION.md 3장 OPINIONS 행).

import { useState } from 'react';
import type { Scenario } from '../../content/types';
import { MEMBER_LABELS } from '../memberLabels';
import '../../styles/screens/opinions.css';

export interface OpinionsScreenProps {
  scenario: Scenario;
  onNext: () => void;
}

export function OpinionsScreen({ scenario, onNext }: OpinionsScreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="screen opinions-screen">
      <h2 className="opinions-screen__title">임원들의 첫 의견</h2>
      <div className="opinions-screen__cards">
        {scenario.initialOpinions.map((opinion) => {
          const expanded = expandedId === opinion.memberId;
          return (
            <article key={opinion.memberId} className="opinion-card">
              <h3 className="opinion-card__member">{MEMBER_LABELS[opinion.memberId]}</h3>
              <p className="opinion-card__text">{opinion.text}</p>
              <button
                type="button"
                className="opinion-card__toggle"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : opinion.memberId)}
              >
                {expanded ? '근거 접기' : '근거 보기'}
              </button>
              {expanded && (
                <ul className="opinion-card__evidence">
                  {opinion.evidenceIds.map((id) => {
                    const card = scenario.evidence.find((item) => item.id === id);
                    return (
                      <li key={id}>
                        <strong>{id}</strong>
                        {card ? ` · ${card.title}: ${card.content}` : ''}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
      <button type="button" className="cta" onClick={onNext}>
        내 의견 말하기
      </button>
    </section>
  );
}
