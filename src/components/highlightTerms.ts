// 근거 자료·임원 발언 카드의 핵심 말 고르기(T105, 2026-10-09 사용자 — "근거 자료와 임원
// 의견들에 중요한 단어는 강조표시해"). 규칙은 화면이 아니라 여기(순수 함수)에 둔다.
// 후보: 시나리오 데이터의 핵심 말(브리핑용 + 자료용 + 발언용) · 조건 이름 · 숫자+단위
// 자동 추출. 텍스트에 실제로 나오는 것만 남기고, 긴 말을 먼저 잡되 카드 한 장의 강조
// 표시가 MAX_HIGHLIGHTS곳을 넘지 않게 자른다 — 과하면 강조가 아니다.
import type { Scenario } from '../content/types';
import { splitByTerms } from './parts/HighlightText';

export const MAX_HIGHLIGHTS = 4;

const NUMBER_UNIT = /\d[\d,.]*\s?(?:건|명|원|%|배|석|번|년|개월|일|시간)/g;

type HighlightSource = Pick<Scenario, 'conditions' | 'highlightTerms' | 'evidenceHighlightTerms' | 'statementHighlightTerms'>;

function countMarks(text: string, terms: readonly string[]): number {
  return splitByTerms(text, terms).filter((part) => part.highlight).length;
}

function pickTerms(text: string, candidates: readonly string[]): string[] {
  const unique = [...new Set(candidates.map((term) => term.trim()).filter((term) => term.length > 0))];
  const present = unique
    .filter((term) => text.includes(term))
    .sort((a, b) => b.length - a.length || text.indexOf(a) - text.indexOf(b));
  const chosen: string[] = [];
  for (const term of present) {
    const next = [...chosen, term];
    if (countMarks(text, next) <= MAX_HIGHLIGHTS) chosen.push(term);
  }
  return chosen;
}

/** 발언 카드 본문에서 강조할 말. 텍스트에 실제로 나오는 것만, 긴 말 우선, 최대 4곳. */
export function statementHighlightTerms(scenario: HighlightSource, text: string): string[] {
  if (text.length === 0) return [];
  const candidates = [
    ...(scenario.highlightTerms ?? []),
    ...(scenario.evidenceHighlightTerms ?? []),
    ...(scenario.statementHighlightTerms ?? []),
    ...scenario.conditions.map((condition) => condition.label),
    ...(text.match(NUMBER_UNIT) ?? []),
  ];
  return pickTerms(text, candidates);
}

/** 근거 자료 카드 해석(insight)에서 강조할 말. 자료용 핵심 말 + 숫자만 쓴다. */
export function evidenceTextHighlightTerms(scenario: HighlightSource, text: string): string[] {
  if (text.length === 0) return [];
  return pickTerms(text, [...(scenario.evidenceHighlightTerms ?? []), ...(text.match(NUMBER_UNIT) ?? [])]);
}
