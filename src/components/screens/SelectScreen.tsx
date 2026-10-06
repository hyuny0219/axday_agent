// 안건 선택 화면(T70, docs/design/mockups/S1_Select.html 시안대로). 뒤에 흐린 무대
// 사진을 전체 배경으로 깔고(ATTRACT와 같은 "기밀 작전실" 프레임: 스캔라인·상하
// 그라데이션·네 모서리 브래킷·우상단 CAM 판독 라벨), 가운데 종이 서류철 카드
// 2장(활성 1 + 준비 중 1) 중 하나를 골라 이사회에 입장한다. 카드 본문은 headline·
// hook·subtitle이 아니라 chairBriefing.question(안건 질문 한 줄)만 쓴다(시안 카드
// 제목이 사건 헤드라인이 아니라 질문 문장이기 때문, src/content/scenarios/index.ts
// 주석 참고). 준비 중 안건(①③)은 선택 자체를 막는다.

import { useState } from 'react';
import type { Scenario } from '../../content/types';
import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/select.css';

export interface SelectScreenProps {
  scenarios: Scenario[];
  onEnter: (scenarioId: string) => void;
}

/** 카드 좌상단 사건 칩(시안 "CASE 01"/"CASE 02", T83에서 한국어 "사건 01"/"사건 02"로
 * 교체). 시나리오 데이터의 caseLabel(예 "사건 02")은 BRIEFING eyebrow 등 다른 화면이
 * 그대로 쓰므로 바꾸지 않고, 이 칩은 카드 배열 순서(1부터)로만 번호를 매긴다 —
 * anon-board 콘텐츠를 건드리지 않는다. */
function caseTagFor(index: number): string {
  return `사건 ${String(index + 1).padStart(2, '0')}`;
}

export function SelectScreen({ scenarios, onEnter }: SelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = scenarios.findIndex((scenario) => scenario.id === selectedId);

  return (
    <section className="screen select-screen">
      <div className="select-screen__stage" aria-hidden="true">
        <img src={stageRender} alt="" className="select-screen__bg" />
        <div className="select-screen__scanlines" />
        <div className="select-screen__vignette" />
        <div className="select-screen__bracket select-screen__bracket--tl" />
        <div className="select-screen__bracket select-screen__bracket--tr" />
        <div className="select-screen__bracket select-screen__bracket--bl" />
        <div className="select-screen__bracket select-screen__bracket--br" />
        <div className="select-screen__readout">
          <span>회의실 A</span>
          <span className="select-screen__readout-dim">안건 대기 중</span>
        </div>
      </div>

      <div className="select-screen__heading">
        <span className="select-screen__eyebrow">안건 선택</span>
        <h2 className="select-screen__title">안건을 선택해 주세요</h2>
      </div>

      <div className="select-screen__cards">
        {scenarios.map((scenario, index) => {
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
              {selected && (
                <span className="scenario-card__check" aria-hidden="true">
                  ✓
                </span>
              )}
              <span
                className={`scenario-card__stamp${
                  disabled ? ' scenario-card__stamp--preparing' : ' scenario-card__stamp--confidential'
                }`}
                aria-hidden="true"
              >
                {disabled ? '준비 중' : '대외비'}
              </span>
              <span className="scenario-card__case">{caseTagFor(index)}</span>
              <h3 className="scenario-card__title">{scenario.chairBriefing.question}</h3>
              <span className="scenario-card__footer">
                {disabled ? '봉인됨 · 다음 안건을 준비하고 있습니다' : '열람 가능 · 선택하면 이사회에 입장합니다'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="select-screen__submit-row screen__submit-row">
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
          이사회 입장 ▶
        </button>
        {selectedId !== null && selectedIndex !== -1 && (
          <span className="select-screen__selected-label">
            선택한 안건: {caseTagFor(selectedIndex)}
          </span>
        )}
      </div>
    </section>
  );
}
