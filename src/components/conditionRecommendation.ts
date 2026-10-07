// AI 비서실장 "조건 추천"(T96, 2026-10-08 사용자 지시 "AI 비서실장을 잘 쓰면 안건의
// 여러 측면에 맞는 조건을 고르는 데 큰 도움이 된다고 느끼게")이 쓰는 순수 함수.
// scenario.voteRules(domain/voting.ts의 requiredConditionsFor)만으로 "아직 찬성이 아닌
// 임원을 움직이는 조건"과 "그 조건이 푸는 걱정"(scenario.reactions 문구 재사용)을
// 계산한다. scripted·live 공통이며 네트워크 호출이 없어 즉시 계산된다.

import type { ExecMemberId, Scenario } from '../content/types';
import type { ParticipantStance } from '../domain/types';
import { EXEC_MEMBER_ORDER, requiredConditionsFor } from '../domain/voting';

export interface ConditionRecommendationRow {
  conditionId: string;
  label: string;
  movedMemberIds: ExecMemberId[];
  worry: string | null;
}

export interface ConditionRecommendation {
  openingLine: string;
  rows: ConditionRecommendationRow[];
}

export function buildConditionRecommendation(
  scenario: Scenario,
  confirmedConditionIds: readonly string[],
  participantStance: ParticipantStance,
): ConditionRecommendation {
  const notYetForMembers = EXEC_MEMBER_ORDER.filter(
    (memberId) =>
      !requiredConditionsFor(scenario, memberId, confirmedConditionIds, participantStance).persuaded,
  );

  const rows: ConditionRecommendationRow[] = scenario.conditions
    .filter((condition) => !confirmedConditionIds.includes(condition.id))
    .map((condition) => {
      const movedMemberIds = notYetForMembers.filter((memberId) => {
        const required = requiredConditionsFor(scenario, memberId, confirmedConditionIds, participantStance);
        return required.conditionIds?.includes(condition.id) ?? false;
      });
      // "푸는 걱정"은 새 문구를 짓지 않고 시나리오 반응 문구를 그대로 쓴다 — 그 조건이
      // 확정됐을 때 임원이 하는 말 자체가 그 조건이 푸는 걱정을 담고 있다.
      const worry = scenario.reactions.find((reaction) => reaction.conditionId === condition.id)?.text ?? null;
      return { conditionId: condition.id, label: condition.label, movedMemberIds, worry };
    })
    .filter((row) => row.movedMemberIds.length > 0);

  const neededLabels: string[] = [];
  for (const row of rows) {
    if (!neededLabels.includes(row.label)) neededLabels.push(row.label);
  }

  const openingLine =
    notYetForMembers.length === 0
      ? '지금 임원 4명 모두 찬성 쪽입니다.'
      : neededLabels.length > 0
        ? `지금 반대인 ${notYetForMembers.join('·')}를 움직이려면 '${neededLabels.join("'·'")}'이 필요합니다`
        : `지금 반대인 ${notYetForMembers.join('·')}는 조건만으로는 움직이기 어렵습니다`;

  return { openingLine, rows };
}
