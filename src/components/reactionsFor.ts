// scripted 반응 조회 규칙(원래 ReactionsScreen 안의 지역 함수). 이전에 확정한 조건
// (previousConfirmedIds)에 연결된 반응만 고르고, 조건이 없으면 conditionId 'none'인
// 기본 반응을 고른다. ReactionsScreen과 회의록(components/minutes.ts)이 같은 규칙을
// 공유한다(DESIGN_SPEC.md v1.0 7절 "reactionsFor 규칙은 공용 함수로 뽑아 같이 쓴다").
// 동작은 T40 시절 ReactionsScreen의 지역 함수와 완전히 같다.

import type { ExecMemberId, Reaction, Scenario } from '../content/types';

export function reactionsFor(
  scenario: Scenario,
  memberId: ExecMemberId,
  previousConfirmedIds: string[],
): Reaction[] {
  if (previousConfirmedIds.length === 0) {
    return scenario.reactions.filter(
      (reaction) => reaction.memberId === memberId && reaction.conditionId === 'none',
    );
  }
  return scenario.reactions.filter(
    (reaction) => reaction.memberId === memberId && previousConfirmedIds.includes(reaction.conditionId),
  );
}

/** 순수 반대(조건 없이 안건 자체에 반대, T92)일 때 쓸 임원 한 명의 반응 한 문장. 참가자가
 * 반대 입장이 아니거나, 이미 확정 조건이 있거나(조건부 반대는 조건 기반 반응으로 답한다),
 * 시나리오에 전용 문구가 없으면(과거 시나리오) undefined — 호출부가 기존 "앞서 말씀드린
 * 입장 그대로입니다" 대체 문구로 되돌아간다. */
export function oppositionReactionText(
  scenario: Scenario,
  memberId: ExecMemberId,
  participantStance: 'FOR' | 'AGAINST' | null,
  previousConfirmedIds: string[],
): string | undefined {
  if (participantStance !== 'AGAINST' || previousConfirmedIds.length > 0) {
    return undefined;
  }
  return scenario.oppositionReactions?.[memberId];
}
