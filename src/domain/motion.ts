// 최종 안건(Motion) 고정. CLAUDE_IMPLEMENTATION.md 6장: P0는 baseConditionIds=[]로
// 고정하고 effectiveConditionIds=[...conditionIds]로 구성하며, executionMode는
// 'DEFAULT'로 둔다. 두 배열은 참조를 공유하지 않고 고정 후 수정하지 않는다.
// T26: id·text·effectiveConditionIds·executionMode를 결정적으로 해시한 motion.hash를
// 더한다(AGENT_BOARDROOM_SPEC.md 3장 "id/revision/hash를 고정"). live 모드 표는 이
// 해시와 일치해야만 반영한다(session.ts RECORD_EXEC_BALLOT).

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

/** 외부 라이브러리 없이 문자열을 32비트로 결정적 해시하는 FNV-1a. */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * id·text·effectiveConditionIds·executionMode만으로 결정적 문자열 해시를 만든다.
 * 동기 함수이며 외부 의존이 없다. effectiveConditionIds는 조건 "집합"이므로 순서를
 * 무시하도록 정렬해서 합친다.
 */
export function computeMotionHash(
  motion: Pick<Motion, 'id' | 'text' | 'effectiveConditionIds' | 'executionMode'>,
): string {
  const canonical = JSON.stringify({
    id: motion.id,
    text: motion.text,
    effectiveConditionIds: [...motion.effectiveConditionIds].sort(),
    executionMode: motion.executionMode,
  });
  return fnv1aHash(canonical);
}

/**
 * 참가자가 확정한 조건으로 최종 안건을 고정한다. 확정 조건이 원안의 기본 조건과
 * 의미 있는 차이가 없으면(집합이 같으면) original, 그렇지 않으면 amended다.
 */
export function freezeMotion(scenario: Scenario, confirmedIds: string[], now: number): Motion {
  const conditionIds = [...confirmedIds];
  const kind = sameConditionSet(conditionIds, scenario.baseConditionIds) ? 'original' : 'amended';
  const id = `${scenario.id}-motion-${now}`;
  const text = scenario.originalMotion.text;
  const effectiveConditionIds = [...conditionIds];
  const executionMode = 'DEFAULT';
  const hash = computeMotionHash({ id, text, effectiveConditionIds, executionMode });
  return {
    id,
    scenarioId: scenario.id,
    kind,
    conditionIds,
    baseConditionIds: [],
    effectiveConditionIds,
    executionMode,
    frozenAt: now,
    text,
    hash,
  };
}

/** 원안 그대로(수정 없이) 고정한다. 240초 만료 시 최종 안건이 없을 때 사용한다. */
export function freezeOriginal(scenario: Scenario, now: number): Motion {
  return freezeMotion(scenario, scenario.baseConditionIds, now);
}
