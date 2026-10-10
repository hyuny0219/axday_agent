// T84 안건 문장 동적 구성·결과 "남은 과제" 규칙. PR #20 Codex 1차 검토 P2: 부결이면 붙인
// 조건도 승인된 것이 아니므로 남은 과제에서 아무것도 빼지 않는다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { buildMotionDisplay, buildRemainingTaskLabels } from '../../src/components/motionDisplay';

const scenario = aiApprovalScenario;
const allTasks = scenario.remainingTasks.map((item) => item.text);
const resolves = (item: { resolvedBy?: string | readonly string[] }, id: string) =>
  typeof item.resolvedBy === 'string' ? item.resolvedBy === id : (item.resolvedBy ?? []).includes(id);
const resolvedByLimit = scenario.remainingTasks.filter((item) => resolves(item, 'LIMIT'));

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
      .filter((item) => resolves(item, 'LIMIT'))
      .map((item) => item.text);
    expect(resolved.length).toBeGreaterThan(0);
    for (const text of resolved) {
      expect(display.undecidedLabels).not.toContain(text);
    }
  });

  // PR #20 Codex 5차 검토 P2: 상반된 조건(REVIEW / FULL_AUTO)이 같은 미정 항목을 해소한다.
  it('"사람이 다시 보는 절차"는 REVIEW로도 FULL_AUTO로도 미정에서 빠진다', () => {
    const text = '사람이 다시 보는 절차';
    expect(buildMotionDisplay(scenario, []).undecidedLabels).toContain(text);
    expect(buildMotionDisplay(scenario, ['REVIEW']).undecidedLabels).not.toContain(text);
    expect(buildMotionDisplay(scenario, ['FULL_AUTO']).undecidedLabels).not.toContain(text);
    expect(buildMotionDisplay(scenario, ['LIMIT']).undecidedLabels).toContain(text);
  });

  // T92: 참가자가 반대 입장이면서 조건을 붙였으면 "단, 아래 조건을 붙입니다" 대신
  // 참가자가 요구했다는 문장으로.
  it('반대 입장 + 조건 있음이면 "이사님은 처음 안에 반대하며, 아래 조건을 요구합니다"', () => {
    const display = buildMotionDisplay(scenario, ['LIMIT'], 'AGAINST');
    expect(display.sentence).toBe(
      `${scenario.motionBreakdown.proposal} 이사님은 처음 안에 반대하며, 아래 조건을 요구합니다.`,
    );
  });

  it('반대 입장이어도 조건이 없으면(순수 반대) 문장은 원안 그대로', () => {
    expect(buildMotionDisplay(scenario, [], 'AGAINST').sentence).toBe(scenario.motionBreakdown.proposal);
  });

  it('찬성 입장이면 조건이 있어도 기존 "단, 아래 조건을 붙입니다" 문장을 쓴다', () => {
    const display = buildMotionDisplay(scenario, ['LIMIT'], 'FOR');
    expect(display.sentence).toBe(`${scenario.motionBreakdown.proposal} 단, 아래 조건을 붙입니다.`);
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
