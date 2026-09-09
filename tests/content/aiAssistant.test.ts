import { describe, expect, it } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import type { ExecMemberId, Predicate } from '../../src/content/types';

const scenario = aiAssistantScenario;

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

describe('aiAssistantScenario', () => {
  const evidenceIds = new Set(scenario.evidence.map((e) => e.id));
  const conditionIds = new Set(scenario.conditions.map((c) => c.id));

  it('자료 카드가 4개다', () => {
    expect(scenario.evidence).toHaveLength(4);
  });

  it('추천 문구가 6개다', () => {
    expect(scenario.phrases).toHaveLength(6);
  });

  it('briefingSummary가 참조하는 자료 ID가 모두 존재한다', () => {
    for (const id of scenario.briefingSummary.evidenceIds) {
      expect(evidenceIds.has(id)).toBe(true);
    }
  });

  it('initialOpinions가 참조하는 자료 ID가 모두 존재한다', () => {
    for (const opinion of scenario.initialOpinions) {
      for (const id of opinion.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it('phrases의 conditionId가 존재하거나 null이다', () => {
    for (const phrase of scenario.phrases) {
      if (phrase.conditionId !== null) {
        expect(conditionIds.has(phrase.conditionId)).toBe(true);
      }
    }
  });

  it('reactions의 conditionId가 존재하거나 none이다', () => {
    for (const reaction of scenario.reactions) {
      if (reaction.conditionId !== 'none') {
        expect(conditionIds.has(reaction.conditionId)).toBe(true);
      }
    }
  });

  it('followUp 옵션의 proposeConditionId가 존재하거나 null이다', () => {
    for (const option of scenario.followUp.options) {
      if (option.proposeConditionId !== null) {
        expect(conditionIds.has(option.proposeConditionId)).toBe(true);
      }
    }
  });

  it('충돌쌍의 ID가 conditions에 모두 존재한다', () => {
    expect(scenario.conflicts.length).toBeGreaterThan(0);
    for (const [a, b] of scenario.conflicts) {
      expect(conditionIds.has(a)).toBe(true);
      expect(conditionIds.has(b)).toBe(true);
    }
  });

  it('voteRules의 has() 참조 조건 ID가 모두 존재한다', () => {
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      for (const rule of scenario.voteRules[memberId]) {
        for (const id of collectHasIds(rule.when)) {
          expect(conditionIds.has(id)).toBe(true);
        }
      }
    }
  });

  it('각 임원 규칙의 마지막 행은 always다', () => {
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      const rules = scenario.voteRules[memberId];
      const lastRule = rules[rules.length - 1];
      expect(lastRule?.when).toEqual({ always: true });
    }
  });

  it('임원별 규칙 행 수가 문서와 일치한다 (CEO 2, CFO 3, CIO 3, CISO 4)', () => {
    expect(scenario.voteRules.CEO).toHaveLength(2);
    expect(scenario.voteRules.CFO_CAIO).toHaveLength(3);
    expect(scenario.voteRules.CIO).toHaveLength(3);
    expect(scenario.voteRules.CISO).toHaveLength(4);
  });
});
