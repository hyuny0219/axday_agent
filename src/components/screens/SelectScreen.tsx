// 안건 선택 화면(T70, docs/design/mockups/S1_Select.html 시안대로). 뒤에 흐린 무대
// 사진을 전체 배경으로 깔고(ATTRACT와 같은 "기밀 작전실" 프레임: 스캔라인·상하
// 그라데이션·네 모서리 브래킷·우상단 CAM 판독 라벨), 가운데 종이 서류철 카드
// 2장(활성 1 + 준비 중 1) 중 하나를 골라 이사회에 입장한다. 카드 본문은 headline·
// hook·subtitle이 아니라 chairBriefing.question(안건 질문 한 줄)만 쓴다(시안 카드
// 제목이 사건 헤드라인이 아니라 질문 문장이기 때문, src/content/scenarios/index.ts
// 주석 참고). 준비 중 안건(①③)은 선택 자체를 막는다.
//
// T84(Opus UX 검토 #10): 카드 문구가 "선택하면 이사회에 입장합니다"였는데 실제로는
// 카드를 고른 뒤 아래 "이사회 입장 ▶" 버튼을 또 눌러야 했다 — 두 단계가 한 문장이
// 가리키는 동작과 달라 참가자가 멈칫했다. 별도 선택 상태·제출 버튼을 없애고 카드
// 클릭(버튼 네이티브 동작이라 Enter/Space 키보드 활성화도 그대로 된다) 즉시
// onEnter를 부른다. App.tsx의 onEnter(dispatch SELECT_SCENARIO)는 동기 리듀서
// 호출이라 지연이 없지만, 중복 클릭·연타로 같은 전환이 두 번 나가는 것은
// `entering` 플래그로 막는다(두 번째 클릭부터는 모든 카드가 disabled). 빈 공간이
// 많던 카드 본문에는 사건 한 줄(incident.headline)과 "눌러서 입장" 힌트를 더해
// 첫 행동 신호를 분명히 한다.

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
  return `안건 ${String(index + 1).padStart(2, '0')}`;
}

export function SelectScreen({ scenarios, onEnter }: SelectScreenProps) {
  // 입장 중복 방지(연타·중복 클릭): onEnter를 부른 뒤 모든 카드를 잠가 두 번째
  // 클릭이 또 dispatch를 내보내지 않게 한다. 이 화면은 전환과 함께 곧 사라지므로
  // 되돌릴 일이 없다.
  const [entering, setEntering] = useState(false);

  function handleSelect(scenario: Scenario) {
    if (scenario.status === 'preparing' || entering) {
      return;
    }
    setEntering(true);
    onEnter(scenario.id);
  }

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
          const preparing = scenario.status === 'preparing';
          return (
            <button
              key={scenario.id}
              type="button"
              className="scenario-card"
              disabled={preparing || entering}
              data-testid={`scenario-card-${scenario.id}`}
              onClick={() => handleSelect(scenario)}
            >
              <span
                className={`scenario-card__stamp${
                  preparing ? ' scenario-card__stamp--preparing' : ' scenario-card__stamp--confidential'
                }`}
                aria-hidden="true"
              >
                {/* T87(사용자 — "붉은 상자 안의 글씨는 영어로"): "준비 중" 카드는 그대로
                    두고 활성 카드 도장만 T83 이전 영문으로 되돌렸다. */}
                {preparing ? '준비 중' : 'CONFIDENTIAL'}
              </span>
              <span className="scenario-card__case">{caseTagFor(index)}</span>
              <h3 className="scenario-card__title">{scenario.chairBriefing.question}</h3>
              <p className="scenario-card__headline">{scenario.incident.headline}</p>
              <span className="scenario-card__footer">
                {preparing ? '봉인됨 · 다음 안건을 준비하고 있습니다' : '열람 가능 · 눌러서 입장'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
