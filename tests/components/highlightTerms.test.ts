import { describe, expect, it } from 'vitest';
import {
  MAX_HIGHLIGHTS,
  evidenceTextHighlightTerms,
  statementHighlightTerms,
} from '../../src/components/highlightTerms';
import { splitByTerms } from '../../src/components/parts/HighlightText';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { Scenario } from '../../src/content/types';

const base = {
  conditions: [{ id: 'LIMIT', label: '결재 금액 한도', keywords: [] }],
  highlightTerms: ['책임'],
  evidenceHighlightTerms: ['사흘'],
  statementHighlightTerms: ['돈 한도', '돈 한도를 정하면'],
} as unknown as Scenario;

describe('statementHighlightTerms', () => {
  it('빈 텍스트는 빈 배열', () => {
    expect(statementHighlightTerms(base, '')).toEqual([]);
  });

  it('텍스트에 실제로 나오는 말만 돌려주고 긴 말을 먼저, 중복은 한 번만', () => {
    const text = '돈 한도를 정하면 결재 금액 한도가 보입니다.';
    expect(statementHighlightTerms(base, text)).toEqual(expect.arrayContaining(['돈 한도를 정하면', '결재 금액 한도']));
  });

  it('조건 이름을 강조한다', () => {
    expect(statementHighlightTerms(base, '이사님의 결재 금액 한도 말씀')).toContain('결재 금액 한도');
  });

  it('숫자+단위를 자동으로 잡는다', () => {
    const terms = statementHighlightTerms(base, '4건이 있었고 12,000원과 3.5 배와 20%가 나왔습니다.');
    expect(terms).toEqual(expect.arrayContaining(['4건', '12,000원', '3.5 배', '20%']));
  });

  it('숫자 없는 글자 속 단위는 잡지 않는다', () => {
    expect(statementHighlightTerms({ ...base, statementHighlightTerms: [] } as Scenario, '일곱 번 중 한 건')).toEqual([]);
  });

  it('겹치면 긴 말이 이기고 카드 한 장의 강조는 4곳을 넘지 않는다', () => {
    const text = '1건 2건 3건 4건 5건 6건 돈 한도 결재 금액 한도';
    const terms = statementHighlightTerms(base, text);
    const marks = splitByTerms(text, terms).filter((p) => p.highlight).length;
    expect(marks).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
    expect(terms).toContain('결재 금액 한도');
  });

  it('같은 말이 여러 번 나와도 표시 개수는 4곳 이하', () => {
    const text = '돈 한도 돈 한도 돈 한도 돈 한도 돈 한도';
    const marks = splitByTerms(text, statementHighlightTerms(base, text)).filter((p) => p.highlight).length;
    expect(marks).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
  });
});

describe('evidenceTextHighlightTerms', () => {
  it('자료용 말과 숫자만 쓴다', () => {
    const terms = evidenceTextHighlightTerms(base, '사흘 가까이, 310건 중 4건, 책임');
    expect(terms).toEqual(expect.arrayContaining(['사흘', '310건', '4건']));
    expect(terms).not.toContain('책임');
  });
});

describe.each([aiApprovalScenario, experienceFirstScenario])('$id 시나리오 강조 데이터', (scenario) => {
  const evidenceTexts = scenario.evidence.map((card) => card.insight);
  const statementTexts = [
    ...scenario.initialOpinions.map((o) => o.text),
    ...scenario.reactions.map((r) => r.text),
    ...Object.values(scenario.oppositionReactions ?? {}),
    ...Object.values(scenario.holdReasons ?? {}),
    scenario.followUp.question,
  ];

  it('자료용·발언용 핵심 말이 각각 6~10개', () => {
    expect(scenario.evidenceHighlightTerms?.length).toBeGreaterThanOrEqual(6);
    expect(scenario.evidenceHighlightTerms?.length).toBeLessThanOrEqual(10);
    expect(scenario.statementHighlightTerms?.length).toBeGreaterThanOrEqual(6);
    expect(scenario.statementHighlightTerms?.length).toBeLessThanOrEqual(10);
  });

  it('모든 자료용 말은 자료 해석 문장에, 발언용 말은 발언 문장에 실제로 들어 있다', () => {
    for (const term of scenario.evidenceHighlightTerms ?? []) {
      expect(evidenceTexts.some((t) => t.includes(term)), term).toBe(true);
    }
    for (const term of scenario.statementHighlightTerms ?? []) {
      expect(statementTexts.some((t) => t.includes(term)), term).toBe(true);
    }
  });

  it('자료 카드마다 강조가 1~4곳', () => {
    for (const text of evidenceTexts) {
      const marks = splitByTerms(text, evidenceTextHighlightTerms(scenario, text)).filter((p) => p.highlight).length;
      expect(marks, text).toBeGreaterThanOrEqual(1);
      expect(marks, text).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
    }
  });

  it('발언 카드마다 강조가 4곳 이하이고, 발언 대부분에 하나 이상 있다', () => {
    let withMark = 0;
    for (const text of statementTexts) {
      const marks = splitByTerms(text, statementHighlightTerms(scenario, text)).filter((p) => p.highlight).length;
      expect(marks, text).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
      if (marks > 0) withMark += 1;
    }
    expect(withMark).toBeGreaterThanOrEqual(Math.floor(statementTexts.length * 0.8));
  });
});
