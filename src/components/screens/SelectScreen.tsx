// 안건 선택 화면: 카드 3장 중 하나를 선택해 이사회에 입장한다. ①③은 아직 콘텐츠가
// 없는 준비 중 안건이라 선택 자체를 막는다(CLAUDE_IMPLEMENTATION.md 3장 SELECT 행,
// content/scenarios/index.ts의 status).

import { useState } from 'react';
import type { Scenario } from '../../content/types';
import '../../styles/screens/select.css';

export interface SelectScreenProps {
  scenarios: Scenario[];
  onEnter: (scenarioId: string) => void;
}

export function SelectScreen({ scenarios, onEnter }: SelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section className="screen select-screen">
      <h2 className="select-screen__title">안건을 선택해 주세요</h2>
      <div className="select-screen__cards">
        {scenarios.map((scenario) => {
          const disabled = scenario.status === 'preparing';
          const selected = selectedId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              className={`scenario-card${selected ? ' scenario-card--selected' : ''}`}
              disabled={disabled}
              aria-pressed={selected}
              data-testid={`scenario-card-${scenario.id}`}
              onClick={() => setSelectedId(scenario.id)}
            >
              <h3 className="scenario-card__title">{scenario.title}</h3>
              <p className="scenario-card__subtitle">{scenario.subtitle}</p>
              {disabled && <span className="scenario-card__badge">준비 중</span>}
            </button>
          );
        })}
      </div>
      <div className="screen__submit-row">
        <button
          type="button"
          className="cta"
          disabled={selectedId === null}
          onClick={() => {
            if (selectedId !== null) {
              onEnter(selectedId);
            }
          }}
        >
          이사회 입장
        </button>
      </div>
    </section>
  );
}
