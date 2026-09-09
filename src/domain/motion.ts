// 최종 안건(Motion) 고정. CLAUDE_IMPLEMENTATION.md 6장: P0는 baseConditionIds=[]로
// 고정하고 effectiveConditionIds=[...conditionIds]로 구성하며, executionMode는
// 'DEFAULT'로 둔다. 두 배열은 참조를 공유하지 않고 고정 후 수정하지 않는다.

import type { Scenario } from '../content/types';
import type { Motion } from './types';

/** 순서 무관하게 같은 조건 ID 집합인지 비교한다. */
function sameConditionSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * 참가자가 확정한 조건으로 최종 안건을 고정한다. 확정 조건이 원안의 기본 조건과
 * 의미 있는 차이가 없으면(집합이 같으면) original, 그렇지 않으면 amended다.
 */
export function freezeMotion(scenario: Scenario, confirmedIds: string[], now: number): Motion {
  const conditionIds = [...confirmedIds];
  const kind = sameConditionSet(conditionIds, scenario.baseConditionIds) ? 'original' : 'amended';
  return {
    id: `${scenario.id}-motion-${now}`,
    scenarioId: scenario.id,
    kind,
    conditionIds,
    baseConditionIds: [],
    effectiveConditionIds: [...conditionIds],
    executionMode: 'DEFAULT',
    frozenAt: now,
  };
}

/** 원안 그대로(수정 없이) 고정한다. 240초 만료 시 최종 안건이 없을 때 사용한다. */
export function freezeOriginal(scenario: Scenario, now: number): Motion {
  return freezeMotion(scenario, scenario.baseConditionIds, now);
}
