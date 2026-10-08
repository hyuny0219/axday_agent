// 조건 추천의 "적용"이 화면에서 실제로 체크할 수 있는 문구를 찾는 규칙. DISCUSS(추천 문구)와
// REACTIONS(추천 답변)가 같은 함수를 써서, "적용 버튼을 보여 줄지"와 "눌렀을 때 실제로
// 체크되는지"가 어긋나지 않게 한다(PR #20 Codex 30차 P2-1).

import type { Phrase, Scenario } from '../content/types';

/** DISCUSS: 조건과 연결된 현재 입장(side)의 추천 문구. selectedIds를 주면 이미 고른 문구는
 * 건너뛴다(없으면 선택 여부와 무관하게 "적용 가능한 문구가 있는지"만 본다). */
export function findPhraseForCondition(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST' | null,
  selectedIds?: readonly string[],
): Phrase | undefined {
  return scenario.phrases.find(
    (candidate) =>
      candidate.conditionId === conditionId &&
      (candidate.side ?? 'FOR') === (side ?? 'FOR') &&
      !(selectedIds?.includes(candidate.id) ?? false),
  );
}

/** REACTIONS: 조건을 제안하는 현재 입장의 추천 답변 인덱스(없으면 -1). */
export function findFollowUpIndexForCondition(
  scenario: Scenario,
  conditionId: string,
  side: 'FOR' | 'AGAINST',
  selectedOptionIds?: readonly string[],
): number {
  return scenario.followUp.options.findIndex(
    (option, idx) =>
      option.proposeConditionId === conditionId &&
      !option.keepPrevious &&
      (option.side ?? 'FOR') === side &&
      !(selectedOptionIds?.includes(String(idx)) ?? false),
  );
}
