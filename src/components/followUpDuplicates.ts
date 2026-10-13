// T120: 반응에 답하기(REACTIONS 2/2)의 추천 답변에서 첫 의견에 이미 낸 내용과 겹치는 카드를
// 가린다. 규칙은 화면이 아니라 여기에 둔다.
//  - 첫 의견에서 고른 추천 문구와 텍스트가 같은 카드는 입장과 무관하게 숨긴다.
//  - 첫 의견에서 고른 추천 문구가 제안한 조건과 같은 조건을 제안하는 카드는, 지금 고른 입장이
//    첫 의견 입장과 같을 때만 숨긴다(입장을 바꾸면 다른 입장의 문구라 중복이 아니다).
// 숨긴 카드의 조건은 첫 의견에서 이미 제안됐으므로 조건 도달 범위(T119)는 줄지 않는다.

import type { Scenario } from '../content/types';

export interface FirstOpinionRef {
  selectedPhraseIds: readonly string[];
  stance?: 'FOR' | 'AGAINST' | null;
}

/** 숨겨야 하는 followUp.options 인덱스 집합. */
export function duplicateFollowUpOptionIndexes(
  scenario: Scenario,
  firstOpinion: FirstOpinionRef | null,
  currentSide: 'FOR' | 'AGAINST' | null,
): Set<number> {
  const hidden = new Set<number>();
  if (!firstOpinion || firstOpinion.selectedPhraseIds.length === 0) {
    return hidden;
  }
  const picked = scenario.phrases.filter((phrase) => firstOpinion.selectedPhraseIds.includes(phrase.id));
  const pickedTexts = new Set(picked.map((phrase) => phrase.text.trim()));
  const pickedConditionIds = new Set(
    picked.map((phrase) => phrase.conditionId).filter((id): id is string => id !== null),
  );
  const sameSide = currentSide !== null && (firstOpinion.stance ?? 'FOR') === currentSide;
  scenario.followUp.options.forEach((option, index) => {
    if (option.keepPrevious) {
      return;
    }
    if (pickedTexts.has(option.text.trim())) {
      hidden.add(index);
      return;
    }
    if (sameSide && option.proposeConditionId !== null && pickedConditionIds.has(option.proposeConditionId)) {
      hidden.add(index);
    }
  });
  return hidden;
}
