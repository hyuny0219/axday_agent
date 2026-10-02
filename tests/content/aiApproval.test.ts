// T78: anonBoard의 콘텐츠 검증 테스트를 안건 ①(ai-approval)에 적용한다 — 조건 키워드가
// 다른 조건 문구에 걸리지 않는지(키워드 격리), 후속 선택지가 정확히 하나의 조건만
// 제안하는지, 상충쌍이 올바른지, 그리고 anonBoard.test.ts와 같은 기본 구조 검증.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { findConflicts, proposeFromText } from '../../src/domain/conditions';
import type { ExecMemberId, Predicate } from '../../src/content/types';

const scenario = aiApprovalScenario;

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

describe('aiApprovalScenario 기본 구조', () => {
  const evidenceIds = new Set(scenario.evidence.map((e) => e.id));
  const conditionIds = new Set(scenario.conditions.map((c) => c.id));

  it('자료 카드가 4개, 추천 문구가 6개, 조건이 5개다', () => {
    expect(scenario.evidence).toHaveLength(4);
    expect(scenario.phrases).toHaveLength(6);
    expect(scenario.conditions).toHaveLength(5);
  });

  it('phrases·reactions·followUp의 조건 참조가 모두 존재한다', () => {
    for (const phrase of scenario.phrases) {
      if (phrase.conditionId !== null) {
        expect(conditionIds.has(phrase.conditionId)).toBe(true);
      }
    }
    for (const reaction of scenario.reactions) {
      if (reaction.conditionId !== 'none') {
        expect(conditionIds.has(reaction.conditionId)).toBe(true);
      }
    }
    for (const option of scenario.followUp.options) {
      if (option.proposeConditionId !== null) {
        expect(conditionIds.has(option.proposeConditionId)).toBe(true);
      }
    }
  });

  it('initialOpinions가 참조하는 자료 ID가 모두 존재한다', () => {
    for (const opinion of scenario.initialOpinions) {
      for (const id of opinion.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it('상충쌍은 REVIEW ↔ FULL_AUTO 하나다', () => {
    expect(scenario.conflicts).toEqual([['REVIEW', 'FULL_AUTO']]);
  });

  it('voteRules의 has() 참조 조건 ID가 모두 존재하고, 각 임원 규칙의 마지막 행은 always다', () => {
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      const rules = scenario.voteRules[memberId];
      for (const rule of rules) {
        for (const id of collectHasIds(rule.when)) {
          expect(conditionIds.has(id)).toBe(true);
        }
      }
      expect(rules[rules.length - 1]?.when).toEqual({ always: true });
    }
  });

  it('임원별 규칙 행 수가 문서와 일치한다 (CEO 2, CFO 3, CAIO 3, CISO 4)', () => {
    expect(scenario.voteRules.CEO).toHaveLength(2);
    expect(scenario.voteRules.CFO).toHaveLength(3);
    expect(scenario.voteRules.CAIO).toHaveLength(3);
    expect(scenario.voteRules.CISO).toHaveLength(4);
  });

  it('12개 규칙 모두 판단 이유가 있고 수치 표현이 없다', () => {
    const NUMERIC_COPY_PATTERN = /%|절감/;
    let total = 0;
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      for (const rule of scenario.voteRules[memberId]) {
        total += 1;
        expect(rule.reason, `${memberId}: ${JSON.stringify(rule.when)}`).toBeTruthy();
        expect(rule.reason).not.toMatch(NUMERIC_COPY_PATTERN);
      }
    }
    expect(total).toBe(12);
  });
});

describe('조건 키워드 격리(proposeFromText)', () => {
  it('P1~P5 각 문구 문장은 정확히 자기 조건 하나만 제안한다', () => {
    expect(proposeFromText(scenario, '결재 금액 한도를 정해 소액부터 자동 승인합시다.')).toEqual([
      'LIMIT',
    ]);
    expect(proposeFromText(scenario, '자동 승인마다 승인 사유를 기록합시다.')).toEqual(['LOG']);
    expect(proposeFromText(scenario, '승인 뒤 사람이 표본 재검토를 하도록 합시다.')).toEqual([
      'REVIEW',
    ]);
    expect(
      proposeFromText(scenario, '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.'),
    ).toEqual(['OWNER']);
    expect(proposeFromText(scenario, '사람 검토를 전면 생략하고 전부 자동 승인합시다.')).toEqual([
      'FULL_AUTO',
    ]);
  });

  it('P6(요청형)과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(proposeFromText(scenario, '맡겨도 될지 판단할 근거를 더 제시해 주십시오.')).toEqual([]);
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('후속 선택지는 각각 proposeConditionId와 정확히 같은 조건만(또는 빈 배열을) 제안한다', () => {
    expect(scenario.followUp.options.length).toBeGreaterThanOrEqual(3);
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });

  it('"검토 없이 공유"류 부정문은 REVIEW를 제안하지 않는다(기존 부정 규칙이 그대로 적용된다)', () => {
    expect(proposeFromText(scenario, '표본 재검토 없이 바로 넘깁시다.')).not.toContain('REVIEW');
  });
});

describe('findConflicts', () => {
  it('REVIEW·FULL_AUTO가 함께 있을 때만 상충쌍을 반환한다', () => {
    expect(findConflicts(scenario, ['REVIEW', 'FULL_AUTO', 'LIMIT'])).toEqual([
      ['REVIEW', 'FULL_AUTO'],
    ]);
    expect(findConflicts(scenario, ['REVIEW', 'LIMIT'])).toEqual([]);
  });
});
