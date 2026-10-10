// T119: 조건은 직접 작성 없이 추천 문구·추천 답변만으로 모두 붙일 수 있어야 한다.
// 안건 × 참가자 입장(FOR·AGAINST)마다 아래 네 가지를 고정한다.
//  (a) 규칙표(voteRules)가 쓰는 모든 조건은 첫 단계 추천 문구 ∪ 추가 답변에서 제안된다.
//  (b) 첫 단계 추천 문구만으로는 그 조건 중 정확히 1~2개가 빠진다.
//  (c) 추가 답변은 그 입장에서 규칙표가 쓰는 모든 조건을 제안한다(첫 단계에서 빠진 것만이
//      아니라 전부 — 첫 의견에서 안 고른 조건도 직접 쓰지 않고 붙일 수 있어야 한다).
//  (d) 추가 답변 문구는 proposeFromText가 선언한 조건과 정확히 같은 값을 돌려준다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import type { ExecMemberId, Predicate, Scenario } from '../../src/content/types';
import { proposeFromText } from '../../src/domain/conditions';

type Stance = 'FOR' | 'AGAINST';

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

function voteRuleConditionIds(scenario: Scenario): string[] {
  const ids = new Set<string>();
  for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
    for (const rule of scenario.voteRules[memberId]) {
      for (const id of collectHasIds(rule.when)) ids.add(id);
    }
  }
  return [...ids];
}

function phraseConditionIds(scenario: Scenario, stance: Stance): Set<string> {
  const ids = new Set<string>();
  for (const phrase of scenario.phrases) {
    const side = phrase.side ?? 'FOR';
    if ((side === 'BOTH' || side === stance) && phrase.conditionId) ids.add(phrase.conditionId);
  }
  return ids;
}

function followUpConditionIds(scenario: Scenario, stance: Stance): Set<string> {
  const ids = new Set<string>();
  for (const option of scenario.followUp.options) {
    const side = option.side ?? 'FOR';
    if ((side === 'BOTH' || side === stance) && option.proposeConditionId) {
      ids.add(option.proposeConditionId);
    }
  }
  return ids;
}

// 후속 질문(followUp.askedBy·question)이 묻는 조건. 찬성 입장에서만 지정한다(반대 입장은
// 첫 문구가 원래 2개를 비운다).
const ASKED_CONDITION: Record<string, Partial<Record<Stance, string>>> = {
  'ai-approval': { FOR: 'OWNER' },
  'experience-first': { FOR: 'DATA_VETO' },
};

const scenarios: Array<[string, Scenario]> = [
  ['aiApproval', aiApprovalScenario],
  ['experienceFirst', experienceFirstScenario],
];

describe.each(scenarios)('T119 조건 커버리지 — %s', (_name, scenario) => {
  const required = voteRuleConditionIds(scenario);

  describe.each<Stance>(['FOR', 'AGAINST'])('입장 %s', (stance) => {
    const first = phraseConditionIds(scenario, stance);
    const later = followUpConditionIds(scenario, stance);
    const missingFirst = required.filter((id) => !first.has(id));

    it('(a) 규칙표가 쓰는 모든 조건이 추천 문구 또는 추가 답변에서 제안된다', () => {
      const unreachable = required.filter((id) => !first.has(id) && !later.has(id));
      expect(unreachable).toEqual([]);
    });

    it('(b) 첫 단계 추천 문구만으로는 조건이 정확히 1~2개 빠진다', () => {
      expect(missingFirst.length).toBeGreaterThanOrEqual(1);
      expect(missingFirst.length).toBeLessThanOrEqual(2);
    });

    it('(c) 추가 답변이 규칙표가 쓰는 모든 조건을 제안한다', () => {
      const notCovered = required.filter((id) => !later.has(id));
      expect(notCovered).toEqual([]);
    });

    it('(b2) 첫 단계에서 빠지는 조건에는 후속 질문이 묻는 조건이 들어 있다', () => {
      const asked = ASKED_CONDITION[scenario.id]?.[stance];
      if (asked) expect(missingFirst).toContain(asked);
    });
  });

  it('(d) 추가 답변 문구가 proposeFromText 결과와 선언된 조건에 정확히 일치한다', () => {
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });
});
