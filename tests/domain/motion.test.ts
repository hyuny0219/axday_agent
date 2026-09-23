// Motion.hash 결정성 검사(T26). id·text·effectiveConditionIds·executionMode만으로
// 계산하는 동기 함수이며 외부 의존이 없다(AGENT_BOARDROOM_SPEC.md 3장 "id/revision/
// hash를 고정").

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { computeMotionHash, freezeMotion } from '../../src/domain/motion';

const scenario = anonBoardScenario;
const T0 = 1_700_000_000_000;

describe('computeMotionHash', () => {
  it('freezeMotion이 고정한 hash는 같은 입력을 다시 넣었을 때와 같다', () => {
    const motion = freezeMotion(scenario, ['PILOT'], T0);
    expect(motion.hash).toBe(computeMotionHash(motion));
    expect(computeMotionHash(motion)).toBe(computeMotionHash(motion));
  });

  it('조건 집합이 다르면 다른 해시를 만든다', () => {
    const a = freezeMotion(scenario, ['PILOT'], T0);
    const b = freezeMotion(scenario, ['PILOT', 'MEASURE'], T0);
    expect(a.hash).not.toBe(b.hash);
  });

  it('조건 순서만 다르면 같은 해시를 만든다(집합이므로 순서 무관)', () => {
    const a = computeMotionHash({
      id: 'm1',
      text: 'text',
      effectiveConditionIds: ['A', 'B'],
      executionMode: 'DEFAULT',
    });
    const b = computeMotionHash({
      id: 'm1',
      text: 'text',
      effectiveConditionIds: ['B', 'A'],
      executionMode: 'DEFAULT',
    });
    expect(a).toBe(b);
  });
});
