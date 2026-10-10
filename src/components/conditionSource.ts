// T119: 아직 안 붙은 조건을 비서실장이 안내할 때 "어디서 붙일 수 있는지"를 함께 말하기 위한
// 순수 함수. 직접 쓰지 않고도 모든 조건에 닿을 수 있다는 약속(tests/content/
// conditionCoverage.test.ts)을 화면 문구로 옮긴다. "추천 문구 N번"의 N은 DISCUSS에서
// 그 입장(+BOTH)에 보이는 추천 문구의 순서(1부터)이며, 카드 앞 숫자(CSS counter)와 같다.

import type { Scenario } from '../content/types';

export type ConditionSourceStage = 'DISCUSS' | 'REACTIONS';

/** 그 입장에 보이는 추천 문구 중 조건을 제안하는 문구의 번호(1부터). 없으면 null. */
export function phraseNumberForCondition(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST',
): number | null {
  const visible = scenario.phrases.filter((phrase) => {
    const phraseSide = phrase.side ?? 'FOR';
    return phraseSide === 'BOTH' || phraseSide === side;
  });
  const index = visible.findIndex((phrase) => phrase.conditionId === conditionId);
  return index >= 0 ? index + 1 : null;
}

/** 그 입장에 보이는 추가 답변(followUp.options) 중 조건을 제안하는 답변이 있는지. */
export function hasFollowUpForCondition(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST',
): boolean {
  return scenario.followUp.options.some(
    (option) =>
      option.proposeConditionId === conditionId &&
      !option.keepPrevious &&
      ((option.side ?? 'FOR') === 'BOTH' || (option.side ?? 'FOR') === side),
  );
}

/** 추천 문구·추가 답변 어디에도 없으면 false(비서실장은 그 조건을 안내하지 않는다). */
export function isConditionOffered(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST' | null,
): boolean {
  if (side === null) return true;
  return (
    phraseNumberForCondition(scenario, conditionId, side) !== null ||
    hasFollowUpForCondition(scenario, conditionId, side)
  );
}

/**
 * 안내 문구. DISCUSS에서는 추천 문구 번호를 먼저, 없으면 다음 단계의 추가 답변을 말한다.
 * REACTIONS에서는 추천 문구 단계가 끝났으므로 추가 답변이 있을 때만 말한다. 닿을 곳이
 * 없으면 null.
 */
export function conditionSourceHint(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST' | null,
  stage: ConditionSourceStage,
): string | null {
  if (side === null) return null;
  if (stage === 'DISCUSS') {
    const number = phraseNumberForCondition(scenario, conditionId, side);
    if (number !== null) return `추천 문구 ${number}번에서 고를 수 있습니다`;
  }
  if (hasFollowUpForCondition(scenario, conditionId, side)) {
    return stage === 'DISCUSS'
      ? '다음 단계 추가 답변에서 고를 수 있습니다'
      : '추가 답변에서 고를 수 있습니다';
  }
  return null;
}
