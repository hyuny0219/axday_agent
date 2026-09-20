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
