// T119: 조건은 직접 작성 없이 추천 문구·추천 답변만으로 모두 붙일 수 있어야 한다.
// 안건 × 참가자 입장(FOR·AGAINST)마다 아래 네 가지를 고정한다.
//  (a) 규칙표(voteRules)가 쓰는 모든 조건은 첫 단계 추천 문구 ∪ 추가 답변에서 제안된다.
//  (b) 첫 단계 추천 문구만으로는 그 조건 중 정확히 1~2개가 빠진다.
//  (c) 추가 답변은 그 입장에서 규칙표가 쓰는 모든 조건을 제안한다(첫 단계에서 빠진 것만이
//      아니라 전부 — 첫 의견에서 안 고른 조건도 직접 쓰지 않고 붙일 수 있어야 한다).
//  (d) 추가 답변 문구는 proposeFromText가 선언한 조건과 정확히 같은 값을 돌려준다.
// T137: 반대 입장의 조건은 "반대 근거"(Condition.side 'AGAINST')다. 입장마다 자기 쪽 조건만 따진다 —
//  찬성은 side가 없는(FOR) 조건 전부, 반대는 반대 근거 전부. 반대 쪽 추천 문구·답변은 찬성 조건을
//  제안하지 않고(찬성 쪽도 반대 근거를 제안하지 않는다), 양쪽 모두 함정이 하나씩 있다(f).
// T133: 함정은 그 조건 하나로 임원 넷이 모두 상대편 표가 되는 조건이다. 반대 쪽 함정(지나친 주장)은
//  반대 근거의 하나로 추천 문구·추가 답변에 들어 있다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import type { ExecMemberId, Predicate, Scenario } from '../../src/content/types';
import { proposeFromText } from '../../src/domain/conditions';
import { duplicateFollowUpOptionIndexes } from '../../src/components/followUpDuplicates';

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

/** 함정 조건(T133, T137): 임원 넷 모두 "그 조건이 있으면 같은 표(찬성 쪽 함정은 NO, 반대 쪽 함정은 YES)"라는
 * 단독 규칙을 가진 조건. 다른 쪽 함정과 겹칠 때의 우선순위는 결과표 테스트(objectionResultTable)가 고정한다. */
function trapConditionIds(scenario: Scenario, vote: 'YES' | 'NO'): string[] {
  return scenario.conditions
    .map((c) => c.id)
    .filter((id) =>
      (Object.keys(scenario.voteRules) as ExecMemberId[]).every((memberId) =>
        scenario.voteRules[memberId].some(
          (rule) => rule.vote === vote && 'has' in rule.when && rule.when.has === id,
        ),
      ),
    );
}

function isAgainstCondition(scenario: Scenario, id: string): boolean {
  return scenario.conditions.find((c) => c.id === id)?.side === 'AGAINST';
}

const scenarios: Array<[string, Scenario]> = [
  ['aiApproval', aiApprovalScenario],
  ['experienceFirst', experienceFirstScenario],
];

describe.each(scenarios)('T119 조건 커버리지 — %s', (_name, scenario) => {
  const allRequired = voteRuleConditionIds(scenario);
  const requiredFor = (stance: Stance) =>
    allRequired.filter((id) => isAgainstCondition(scenario, id) === (stance === 'AGAINST'));

  it('(f) 양쪽에 함정이 하나씩 있고, 추천 문구·추가 답변은 자기 입장 쪽 조건만 제안한다(T133·T137)', () => {
    expect(trapConditionIds(scenario, 'NO').filter((id) => !isAgainstCondition(scenario, id))).toHaveLength(1);
    expect(trapConditionIds(scenario, 'YES').filter((id) => isAgainstCondition(scenario, id))).toHaveLength(1);
    for (const option of scenario.followUp.options) {
      const side = option.side ?? 'FOR';
      if (side !== 'BOTH' && option.proposeConditionId) {
        expect(isAgainstCondition(scenario, option.proposeConditionId), option.text).toBe(side === 'AGAINST');
      }
    }
    for (const phrase of scenario.phrases) {
      const side = phrase.side ?? 'FOR';
      if (side !== 'BOTH' && phrase.conditionId) {
        expect(isAgainstCondition(scenario, phrase.conditionId), phrase.text).toBe(side === 'AGAINST');
      }
    }
  });

  describe.each<Stance>(['FOR', 'AGAINST'])('입장 %s', (stance) => {
    const required = requiredFor(stance);
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

  // T120: 첫 의견에서 고른 문구 집합 S에 대해, 2/2에 보이는 카드 ∪ S의 조건 = 규칙표 조건 전부.
  // 숨긴 카드의 조건은 반드시 S가 이미 제안한 조건이다(같은 입장일 때; 입장 전환 시에는 텍스트가 같은 카드만 숨긴다).
  describe.each<Stance>(['FOR', 'AGAINST'])('(e) T120 중복 제외 후에도 조건이 모두 도달한다 — 입장 %s', (stance) => {
    const required = requiredFor(stance);
    const sidePhrases = scenario.phrases.filter((p) => {
      const side = p.side ?? 'FOR';
      return side === 'BOTH' || side === stance;
    });
    const selections: string[][] = [
      [],
      ...sidePhrases.map((p) => [p.id]),
      sidePhrases.map((p) => p.id),
    ];
    for (const selected of selections) {
      it(`첫 의견 문구 [${selected.join(',') || '없음'}]`, () => {
        const hidden = duplicateFollowUpOptionIndexes(scenario, { selectedPhraseIds: selected, stance }, stance);
        const fromSelected = new Set(
          scenario.phrases.filter((p) => selected.includes(p.id) && p.conditionId).map((p) => p.conditionId as string),
        );
        const visible = new Set<string>();
        scenario.followUp.options.forEach((option, index) => {
          const side = option.side ?? 'FOR';
          if (option.keepPrevious || hidden.has(index) || !option.proposeConditionId) return;
          if (side === 'BOTH' || side === stance) visible.add(option.proposeConditionId);
        });
        const unreachable = required.filter((id) => !visible.has(id) && !fromSelected.has(id));
        expect(unreachable).toEqual([]);
        // 숨긴 카드의 조건은 S가 이미 제안한 조건이거나, 텍스트가 같은 카드다.
        for (const index of hidden) {
          const option = scenario.followUp.options[index]!;
          const sameText = scenario.phrases.some((p) => selected.includes(p.id) && p.text.trim() === option.text.trim());
          expect(sameText || (option.proposeConditionId !== null && fromSelected.has(option.proposeConditionId))).toBe(true);
        }
      });
    }
    it('입장을 바꾸면 조건이 같다는 이유로는 숨기지 않는다', () => {
      const other: Stance = stance === 'FOR' ? 'AGAINST' : 'FOR';
      const selected = sidePhrases.map((p) => p.id);
      const hidden = duplicateFollowUpOptionIndexes(scenario, { selectedPhraseIds: selected, stance }, other);
      const texts = new Set(scenario.phrases.filter((p) => selected.includes(p.id)).map((p) => p.text.trim()));
      for (const index of hidden) {
        expect(texts.has(scenario.followUp.options[index]!.text.trim())).toBe(true);
      }
    });
  });

  it('(d) 추가 답변 문구가 proposeFromText 결과와 선언된 조건에 정확히 일치한다', () => {
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });
});
