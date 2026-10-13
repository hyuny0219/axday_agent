// scripted 반응 조회 규칙(원래 ReactionsScreen 안의 지역 함수). 이전에 확정한 조건
// (previousConfirmedIds)에 연결된 반응만 고르고, 조건이 없으면 conditionId 'none'인
// 기본 반응을 고른다. ReactionsScreen과 회의록(components/minutes.ts)이 같은 규칙을
// 공유한다(DESIGN_SPEC.md v1.0 7절 "reactionsFor 규칙은 공용 함수로 뽑아 같이 쓴다").
// 동작은 T40 시절 ReactionsScreen의 지역 함수와 완전히 같다.

import type { ExecMemberId, FollowUpPrompt, Reaction, Scenario } from '../content/types';

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

/** 반응 카드 본문(T110). 1차 반응에서 "고민 중"에 머문 임원(pending)은 반응들의 pendingText를
 * 순서대로 이어 붙인 문구를 쓰고, pendingText가 하나도 없으면 일반 text로 되돌아간다. */
export function reactionBodyText(reactions: Reaction[], pending: boolean): string {
  if (pending) {
    const texts = reactions.map((reaction) => reaction.pendingText).filter((text): text is string => Boolean(text));
    if (texts.length > 0) {
      return texts.join(' ');
    }
  }
  return reactions.map((reaction) => reaction.text).join(' ');
}

/** 무대 말풍선용 핵심 구절(T110): pending이면 첫 pendingBubble, 없으면 일반 bubble. 둘 다 없으면 null. */
export function reactionBubble(reactions: Reaction[], pending: boolean): string | null {
  if (pending) {
    const bubble = reactions.find((reaction) => reaction.pendingBubble)?.pendingBubble;
    if (bubble) {
      return bubble;
    }
  }
  return reactions[0]?.bubble ?? null;
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

/** 반응 카드 "바뀜"의 원인 한 줄(T96, 2026-10-08 사용자 지시 "내 발언에 따라 임원
 * 입장이 변하는 것이 잘 보이게"). reactionsFor가 고른 반응 문구들의 conditionId를
 * 라벨로 바꿔 "이사님의 '라벨' 조건으로"를 만든다. 일치하는 조건이 없으면(예: 조건
 * 없이 입장이 바뀐 경우) "이사님 의견을 듣고"로 되돌아간다. */
export function changeCauseLabel(scenario: Scenario, reactions: Reaction[]): string {
  const labels: string[] = [];
  for (const reaction of reactions) {
    if (reaction.conditionId === 'none') continue;
    const label = scenario.conditions.find((condition) => condition.id === reaction.conditionId)?.label;
    const text = label ?? reaction.conditionId;
    if (!labels.includes(text)) labels.push(text);
  }
  if (labels.length === 0) {
    return '이사님 의견을 듣고';
  }
  return `이사님의 '${labels.join('·')}' 조건으로`;
}

/** 참가자 입장별 후속 질문(T93). `byStance`가 있는 시나리오는 참가자가 AGAINST일 때만
 * AGAINST 질문을, 그 외(FOR·UNDECIDED·null, 직접 입력만 등)는 FOR 질문을 쓴다. `byStance`가
 * 없는 과거 시나리오(anonBoard·aiAssistant)는 기존 question·askedBy로 그대로 되돌아간다. */
export function resolveFollowUpPrompt(
  scenario: Scenario,
  participantStance: 'FOR' | 'AGAINST' | null,
): FollowUpPrompt {
  const byStance = scenario.followUp.byStance;
  if (!byStance) {
    return { question: scenario.followUp.question, askedBy: scenario.followUp.askedBy };
  }
  return participantStance === 'AGAINST' ? byStance.AGAINST : byStance.FOR;
}
