// T78: anonBoard의 콘텐츠 검증 테스트를 안건 ②(experience-first)에 적용한다 — 조건
// 키워드가 다른 조건 문구에 걸리지 않는지(키워드 격리), 후속 선택지(DATA_VETO/
// EXP_ONLY 상충쌍 포함)가 정확히 제안하는 조건을 갖는지, 그리고 anonBoard.test.ts와
// 같은 기본 구조 검증.
import { describe, expect, it } from 'vitest';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import { findConflicts, proposeFromText } from '../../src/domain/conditions';
import type { ExecMemberId, Predicate } from '../../src/content/types';

const scenario = experienceFirstScenario;

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

describe('experienceFirstScenario 기본 구조', () => {
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

  it('상충쌍은 DATA_VETO ↔ EXP_ONLY 하나다', () => {
    expect(scenario.conflicts).toEqual([['DATA_VETO', 'EXP_ONLY']]);
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
    expect(proposeFromText(scenario, '전례 없는 상황에 한정해 경험을 우선합시다.')).toEqual([
      'SCOPE',
    ]);
    expect(proposeFromText(scenario, '경험으로 결정할 때는 판단 근거를 기록합시다.')).toEqual([
      'RECORD',
    ]);
    expect(
      proposeFromText(scenario, '데이터 경고 시 결정을 잠시 멈추고 재검토합시다.'),
    ).toEqual(['DATA_VETO']);
    expect(
      proposeFromText(scenario, '결정 결과를 복기해 다음 판단 기준으로 삼읍시다.'),
    ).toEqual(['REVIEW']);
    expect(proposeFromText(scenario, '최종 결정은 언제나 경험 판단을 따르도록 합시다.')).toEqual([
      'EXP_ONLY',
    ]);
  });

  it('P6(요청형)과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(proposeFromText(scenario, '경험을 먼저 믿어야 할 이유를 더 설명해 주십시오.')).toEqual(
      [],
    );
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('후속 선택지(DATA_VETO·EXP_ONLY 상충쌍 포함)는 각각 proposeConditionId와 정확히 같은 조건만 제안한다', () => {
    expect(scenario.followUp.options.length).toBeGreaterThanOrEqual(3);
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });

  it('REVIEW("결정 결과를 복기")와 RECORD("판단 근거")는 서로의 문구에 걸리지 않는다', () => {
    expect(
      proposeFromText(scenario, '결정 결과를 복기해 다음 판단 기준으로 삼읍시다.'),
    ).not.toContain('RECORD');
    expect(
      proposeFromText(scenario, '경험으로 결정할 때는 판단 근거를 기록합시다.'),
    ).not.toContain('REVIEW');
  });

  // PR #13 Codex 1차 검토 P1: REVIEW 키워드가 '복기' 한 단어였을 때 정보성 질문에도
  // 걸려 묻지도 않은 조건이 확정으로 제안됐다(ai-approval OWNER '책임자'와 같은 문제).
  // '결정 결과를 복기'라는 약속형 어구로 좁힌 뒤에는 단순히 누가 하는지 묻는 문장에서
  // 제안하지 않는다.
  it('"복기는 누가 합니까?" 같은 정보성 질문은 REVIEW를 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '복기는 누가 합니까?')).not.toContain('REVIEW');
  });
});

describe('findConflicts', () => {
  it('DATA_VETO·EXP_ONLY가 함께 있을 때만 상충쌍을 반환한다', () => {
    expect(findConflicts(scenario, ['DATA_VETO', 'EXP_ONLY', 'SCOPE'])).toEqual([
      ['DATA_VETO', 'EXP_ONLY'],
    ]);
    expect(findConflicts(scenario, ['DATA_VETO', 'SCOPE'])).toEqual([]);
  });
});
