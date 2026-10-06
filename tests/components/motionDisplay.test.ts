// T84 안건 문장 동적 구성·결과 "남은 과제" 규칙. PR #20 Codex 1차 검토 P2: 부결이면 붙인
// 조건도 승인된 것이 아니므로 남은 과제에서 아무것도 빼지 않는다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { buildMotionDisplay, buildRemainingTaskLabels } from '../../src/components/motionDisplay';

const scenario = aiApprovalScenario;
const allTasks = scenario.remainingTasks.map((item) => item.text);
const resolvedByLimit = scenario.remainingTasks.filter((item) => item.resolvedBy === 'LIMIT');

describe('buildMotionDisplay', () => {
  it('조건이 없으면 제안 문장 그대로, 미정 항목 전체를 보여준다', () => {
    const display = buildMotionDisplay(scenario, []);
    expect(display.sentence).toBe(scenario.motionBreakdown.proposal);
    expect(display.undecidedLabels).toEqual(
      scenario.motionBreakdown.undecidedItems.map((item) => item.text),
    );
  });

  it('조건을 붙이면 "단, 아래 조건을 붙입니다"를 덧붙이고 대응하는 미정 항목을 뺀다', () => {
    const display = buildMotionDisplay(scenario, ['LIMIT']);
    expect(display.sentence).toBe(`${scenario.motionBreakdown.proposal} 단, 아래 조건을 붙입니다.`);
    const resolved = scenario.motionBreakdown.undecidedItems
      .filter((item) => item.resolvedBy === 'LIMIT')
      .map((item) => item.text);
    expect(resolved.length).toBeGreaterThan(0);
    for (const text of resolved) {
      expect(display.undecidedLabels).not.toContain(text);
    }
  });
});

describe('buildRemainingTaskLabels', () => {
  it('가결이면 확정 조건에 대응하는 과제를 뺀다', () => {
    expect(resolvedByLimit.length).toBeGreaterThan(0);
    const labels = buildRemainingTaskLabels(scenario, ['LIMIT'], 'PASS');
    for (const item of resolvedByLimit) {
      expect(labels).not.toContain(item.text);
    }
    expect(labels.length).toBe(allTasks.length - resolvedByLimit.length);
  });

  it('부결이면 조건을 붙였어도 과제를 하나도 빼지 않는다(PR #20 Codex 1차 검토 P2)', () => {
    expect(buildRemainingTaskLabels(scenario, ['LIMIT'], 'REJECT')).toEqual(allTasks);
    expect(buildRemainingTaskLabels(scenario, ['LIMIT', 'LOG', 'OWNER'], 'REJECT')).toEqual(allTasks);
  });

  it('결과가 아직 없으면(null) 과제 전체를 돌려준다', () => {
    expect(buildRemainingTaskLabels(scenario, ['LIMIT'], null)).toEqual(allTasks);
  });
});
