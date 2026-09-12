// 최종 안건 화면: 원안 문장, DISCUSS·REACTIONS에서 누적 확정된 조건, 남은 확인
// 사항을 보여준다. '이 안건으로 표결'을 누르면 지금까지 확정한 조건 전체로
// FREEZE_MOTION을 낸다(docs/SCENARIO_AI_ASSISTANT.md "최종 안건 화면").

import { useMemo } from 'react';
import type { Scenario } from '../../content/types';
import type { Opinion } from '../../domain/types';
import { collectConfirmedConditionIds } from '../opinionConditions';
import '../../styles/screens/motion.css';

export interface MotionScreenProps {
  scenario: Scenario;
  opinions: Opinion[];
  onFreeze: (confirmedConditionIds: string[]) => void;
}

export function MotionScreen({ scenario, opinions, onFreeze }: MotionScreenProps) {
  const confirmedConditionIds = useMemo(() => collectConfirmedConditionIds(opinions), [opinions]);

  function conditionLabel(id: string): string {
    return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
  }

  return (
    <section className="screen motion-screen">
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
      <button
        type="button"
        className="cta"
        onClick={() => onFreeze(confirmedConditionIds)}
        data-testid="freeze-motion"
      >
        이 안건으로 표결
      </button>
    </section>
  );
}
