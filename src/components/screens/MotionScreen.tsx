// 최종 안건 화면: 원안 문장, DISCUSS·REACTIONS에서 누적 확정된 조건, 남은 확인
// 사항을 보여준다. '이 안건으로 표결'을 누르면 지금까지 확정한 조건 전체로
// FREEZE_MOTION을 낸다(docs/SCENARIO_AI_ASSISTANT.md "최종 안건 화면").
// T45(조종석 배치): 왼쪽 열은 "이 안건으로 표결" CTA만, 오른쪽 열은 안건 카드·반영
// 조건·남은 과제를 담는다(DESIGN_SPEC.md v1.0 6절 표).

import { useMemo } from 'react';
import type { Scenario } from '../../content/types';
import type { Opinion } from '../../domain/types';
import { collectConfirmedConditionIds } from '../opinionConditions';
import '../../styles/screens/motion.css';

export interface MotionScreenProps {
  scenario: Scenario;
  opinions: Opinion[];
  /** live에서 후속 답을 제출한 뒤 runRound('FOLLOWUP')이 settle되기 전이면 true(T46,
   * DESIGN_SPEC.md v1.0 7절 "후속 대기 게이트"). scripted와 '의견 유지'(후속 라운드
   * 없음) 경로는 항상 undefined/false로 넘어와 CTA가 그대로 활성이다. */
  freezeDisabled?: boolean;
  onFreeze: (confirmedConditionIds: string[]) => void;
}

export function MotionScreen({
  scenario,
  opinions,
  freezeDisabled = false,
  onFreeze,
}: MotionScreenProps) {
  const confirmedConditionIds = useMemo(() => collectConfirmedConditionIds(opinions), [opinions]);

  function conditionLabel(id: string): string {
    return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
  }

  return (
    <>
      <div className="app-body__actions screen motion-screen">
        <button
          type="button"
          className="cta"
          disabled={freezeDisabled}
          onClick={() => onFreeze(confirmedConditionIds)}
          data-testid="freeze-motion"
        >
          이 안건으로 표결
        </button>
        {freezeDisabled && (
          <p className="motion-screen__waiting" data-testid="motion-waiting-followup">
            임원 후속 판단 중…
          </p>
        )}
      </div>
      <div className="app-body__content screen motion-screen__info">
        <h2 className="motion-screen__title">최종 안건</h2>
        <article className="motion-screen__card" data-testid="motion-card">
          <p className="motion-screen__original">{scenario.originalMotion.text}</p>
          <h3 className="motion-screen__section-label">확정 조건</h3>
          {confirmedConditionIds.length > 0 ? (
            <ul className="motion-screen__conditions" data-testid="motion-conditions">
              {confirmedConditionIds.map((id) => (
                <li key={id}>{conditionLabel(id)}</li>
              ))}
            </ul>
          ) : (
            <p className="motion-screen__no-conditions">확정한 수정 조건이 없어 원안 그대로 표결합니다.</p>
          )}
          <h3 className="motion-screen__section-label">남은 확인 사항</h3>
          <ul className="motion-screen__tasks">
            {scenario.remainingTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </article>
      </div>
    </>
  );
}
