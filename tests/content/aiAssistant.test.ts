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

  it('chairBriefing이 상황·결정 질문·역할 3문장을 모두 갖는다', () => {
    expect(scenario.chairBriefing.situation.length).toBeGreaterThan(0);
    expect(scenario.chairBriefing.question.length).toBeGreaterThan(0);
    expect(scenario.chairBriefing.role.length).toBeGreaterThan(0);
  });

  it('자료 카드마다 insight 한 줄과 관련 임원이 있다 (4개)', () => {
    expect(scenario.evidence).toHaveLength(4);
    for (const card of scenario.evidence) {
      expect(card.insight.length).toBeGreaterThan(0);
      expect(card.relatedMemberIds.length).toBeGreaterThan(0);
    }
  });

  it('핵심 쟁점이 3개이고 참조 자료 ID가 모두 존재한다', () => {
    expect(scenario.briefingIssues).toHaveLength(3);
    for (const issue of scenario.briefingIssues) {
      for (const id of issue.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it('previewConditionIds는 4개이며 모두 conditions에 존재하고 OPEN_ALL은 포함하지 않는다', () => {
    expect(scenario.previewConditionIds).toHaveLength(4);
    for (const id of scenario.previewConditionIds) {
      expect(conditionIds.has(id)).toBe(true);
    }
    expect(scenario.previewConditionIds).not.toContain('OPEN_ALL');
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

  it('임원별 규칙 행 수가 문서와 일치한다 (CEO 2, CFO 3, CAIO 3, CISO 4)', () => {
    expect(scenario.voteRules.CEO).toHaveLength(2);
    expect(scenario.voteRules.CFO).toHaveLength(3);
    expect(scenario.voteRules.CAIO).toHaveLength(3);
    expect(scenario.voteRules.CISO).toHaveLength(4);
  });

  const NUMERIC_COPY_PATTERN = /%|절감/;

  it('incident 3필드가 비어 있지 않고 수치 표현이 없다', () => {
    expect(scenario.incident.caseLabel.length).toBeGreaterThan(0);
    expect(scenario.incident.headline.length).toBeGreaterThan(0);
    expect(scenario.incident.hook.length).toBeGreaterThan(0);
    expect(scenario.incident.caseLabel).not.toMatch(NUMERIC_COPY_PATTERN);
    expect(scenario.incident.headline).not.toMatch(NUMERIC_COPY_PATTERN);
    expect(scenario.incident.hook).not.toMatch(NUMERIC_COPY_PATTERN);
  });

  it('incident 문구는 자료 E1~E4에 없는 요일·확정 상태를 만들지 않는다(PR #8 Codex 1차 검토)', () => {
    // E3은 "주간 보고마다"라고만 하고 요일을 밝히지 않으며, E1·E2는 "이 자료만으로는 알 수
    // 없다"까지만 말한다. 요일 표현과 "아무도 정하지 못했다"류의 단정은 새 사실이다.
    const UNGROUNDED_PATTERN = /[월화수목금토일]요일|아무도|정하지 못/;
    expect(scenario.incident.headline).not.toMatch(UNGROUNDED_PATTERN);
    expect(scenario.incident.hook).not.toMatch(UNGROUNDED_PATTERN);
    // hook의 수치는 E1·E2 insight에 있는 값만 쓴다.
    expect(scenario.incident.hook).toContain('120건');
    expect(scenario.incident.hook).toContain('126건');
  });

  it('resultCopy.sixMonthsLater 4필드가 비어 있지 않고 수치 표현이 없다', () => {
    const { pass, passOriginal, hold, reject } = scenario.resultCopy.sixMonthsLater;
    for (const text of [pass, passOriginal, hold, reject]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(NUMERIC_COPY_PATTERN);
    }
    // 조건 없는 원안 가결 문구는 "붙인 조건"을 전제하지 않는다(PR #8 Codex 2차 검토).
    expect(passOriginal).not.toContain('조건');
    expect(pass).toContain('조건');
  });
});
