// AI 비서실장 "조건 추천"(T96, 2026-10-08 사용자 지시 "AI 비서실장을 잘 쓰면 안건의
// 여러 측면에 맞는 조건을 고르는 데 큰 도움이 된다고 느끼게")이 쓰는 순수 함수.
// scenario.voteRules(domain/voting.ts의 requiredConditionsFor)로 "아직 찬성이 아닌
// 임원을 움직이는 조건"과 "그 조건이 푸는 걱정"(scenario.reactions 문구 재사용)을
// 계산한다. scripted·live 공통이며 네트워크 호출이 없어 즉시 계산된다.
//
// PR #20(통합 브랜치) Codex 27차 검토 P2 반영:
// (1) 조건 하나를 지금 확정 집합에 "단독으로" 추가했을 때 실제로 표가 바뀌는 임원만
//     그 조건의 "움직이는 임원"으로 센다 — CFO처럼 LIMIT+REVIEW가 모두 있어야 YES인
//     임원은 LIMIT 단독·REVIEW 단독 어느 쪽도 움직이지 못하므로, 예전처럼 각 행에
//     따로 나타나면 "이 조건 하나만 있으면 된다"는 거짓 정보가 된다. 그런 임원은
//     `bundles`(복합 조합 묶음, "○○ + △△ 모두 있어야 움직임")로 따로 보여준다.
// (4) live는 scripted voteRules가 실제 결정권이 없다(LLM이 자유롭게 답한다) — "아직
//     찬성이 아닌 임원"은 규칙표가 아니라 실제 표정(`stances`, PersuasionBoard와 같은
//     입력)으로 가른다. 필요한 조건은 그 임원의 OPINIONS 발언 `suggestedConditionIds`
//     (있으면)를 우선 쓰고, 없을 때만 voteRules 값을 "참고"로 보여준다.

import type { ExecMemberId, Scenario } from '../content/types';
import type { ParticipantStance, SessionMode, Stance } from '../domain/types';
import { EXEC_MEMBER_ORDER, requiredConditionsFor } from '../domain/voting';

export interface ConditionRecommendationRow {
  conditionId: string;
  label: string;
  movedMemberIds: ExecMemberId[];
  worry: string | null;
}

/** 복합 조합(조건 2개 이상을 모두 확정해야 YES가 되는 임원)을 위한 묶음 추천. */
export interface ConditionBundleRecommendation {
  conditionIds: string[];
  labels: string[];
  movedMemberIds: ExecMemberId[];
}

export interface ConditionRecommendation {
  openingLine: string;
  rows: ConditionRecommendationRow[];
  bundles: ConditionBundleRecommendation[];
  /** live에서 실제 발언 제안(suggestedConditionIds)이 없어 scripted 규칙표 값을
   * 참고로 대신 썼으면 true — 호출부가 "(참고)" 안내를 붙이는 데 쓴다. */
  usedRuleFallback: boolean;
}

/** scripted voteRules 기준, confirmedIds에 conditionId 하나만 더했을 때 그 임원이
 * YES로 바뀌는지(복합 조합의 일부만으로는 바뀌지 않음을 가른다). */
function singleAdditionPersuades(
  scenario: Scenario,
  memberId: ExecMemberId,
  confirmedIds: readonly string[],
  participantStance: ParticipantStance,
  conditionId: string,
): boolean {
  return requiredConditionsFor(scenario, memberId, [...confirmedIds, conditionId], participantStance).persuaded;
}

export function buildConditionRecommendation(
  scenario: Scenario,
  confirmedConditionIds: readonly string[],
  participantStance: ParticipantStance,
  mode: SessionMode,
  stances: Record<ExecMemberId, Stance>,
  liveSuggestedConditionIds?: Partial<Record<ExecMemberId, readonly string[]>>,
): ConditionRecommendation {
  // (4) "아직 찬성이 아닌 임원"은 항상 실제 표정으로 가른다 — scripted는 stances 자체가
  // voteRules로 계산된 값이라 requiredConditionsFor(...).persuaded와 결과가 같고, live는
  // 실제 LLM 판단을 그대로 반영한다.
  const notYetForMembers = EXEC_MEMBER_ORDER.filter((memberId) => stances[memberId] !== 'FOR');
  const candidates = scenario.conditions.filter((condition) => !confirmedConditionIds.includes(condition.id));

  let usedRuleFallback = false;

  // 임원별로 "이 조건 하나만 추가하면 움직인다"에 해당하는 조건 id 목록을 모은다.
  const singleMovesByMember = new Map<ExecMemberId, string[]>();
  for (const memberId of notYetForMembers) {
    if (mode === 'live') {
      const hints = liveSuggestedConditionIds?.[memberId]?.filter((id) => !confirmedConditionIds.includes(id));
      if (hints && hints.length > 0) {
        singleMovesByMember.set(memberId, [...hints]);
        continue;
      }
      // 발언에 실린 제안이 없으면 참고용으로 scripted 규칙표 값을 대신 쓴다.
      usedRuleFallback = true;
    }
    const moves = candidates
      .filter((condition) =>
        singleAdditionPersuades(scenario, memberId, confirmedConditionIds, participantStance, condition.id),
      )
      .map((condition) => condition.id);
    singleMovesByMember.set(memberId, moves);
  }

  const rows: ConditionRecommendationRow[] = candidates
    .map((condition) => {
      const movedMemberIds = notYetForMembers.filter((memberId) =>
        singleMovesByMember.get(memberId)?.includes(condition.id),
      );
      // "푸는 걱정"은 새 문구를 짓지 않고 시나리오 반응 문구를 그대로 쓴다 — 그 조건이
      // 확정됐을 때 임원이 하는 말 자체가 그 조건이 푸는 걱정을 담고 있다.
      const worry = scenario.reactions.find((reaction) => reaction.conditionId === condition.id)?.text ?? null;
      return { conditionId: condition.id, label: condition.label, movedMemberIds, worry };
    })
    .filter((row) => row.movedMemberIds.length > 0);

  // (1) 단일 조건으로는 아무것도 못 움직이는 임원 — scripted 규칙표의 "가장 작은 조합"이
  // 2개 이상이면 묶음으로 보여준다. live는 발언 제안 기반이라 "조합" 개념이 없어 건너뛴다.
  const bundleMap = new Map<string, { ids: string[]; members: ExecMemberId[] }>();
  if (mode === 'scripted') {
    for (const memberId of notYetForMembers) {
      if ((singleMovesByMember.get(memberId) ?? []).length > 0) {
        continue;
      }
      const required = requiredConditionsFor(scenario, memberId, confirmedConditionIds, participantStance);
      if (!required.conditionIds || required.conditionIds.length < 2) {
        continue;
      }
      const key = required.conditionIds.join('+');
      const entry = bundleMap.get(key) ?? { ids: required.conditionIds, members: [] };
      entry.members.push(memberId);
      bundleMap.set(key, entry);
    }
  }
  const bundles: ConditionBundleRecommendation[] = Array.from(bundleMap.values()).map(({ ids, members }) => ({
    conditionIds: ids,
    labels: ids.map((id) => scenario.conditions.find((condition) => condition.id === id)?.label ?? id),
    movedMemberIds: members,
  }));

  const neededLabels: string[] = [];
  for (const row of rows) {
    if (!neededLabels.includes(row.label)) neededLabels.push(row.label);
  }
  for (const bundle of bundles) {
    const bundleLabel = bundle.labels.join(' + ');
    if (!neededLabels.includes(bundleLabel)) neededLabels.push(bundleLabel);
  }

  const openingLine =
    notYetForMembers.length === 0
      ? '지금 임원 4명 모두 찬성 쪽입니다.'
      : neededLabels.length > 0
        ? `지금 반대인 ${notYetForMembers.join('·')}를 움직이려면 '${neededLabels.join("'·'")}'이 필요합니다`
        : `지금 반대인 ${notYetForMembers.join('·')}는 조건만으로는 움직이기 어렵습니다`;

  return { openingLine, rows, bundles, usedRuleFallback: mode === 'live' && usedRuleFallback };
}
