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
import { EXEC_MEMBER_ORDER, decideMember, requiredConditionsFor } from '../domain/voting';

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

/** scripted voteRules 기준, confirmedIds에 conditionId 하나만 더했을 때 그 임원의 표가
 * 참가자 목표(찬성이면 YES, 반대면 NO)로 바뀌는지(복합 조합의 일부만으로는 바뀌지
 * 않음을 가른다). */
function singleAdditionReachesTarget(
  scenario: Scenario,
  memberId: ExecMemberId,
  confirmedIds: readonly string[],
  participantStance: ParticipantStance,
  conditionId: string,
  targetVote: 'YES' | 'NO',
): boolean {
  const voteWith = (ids: readonly string[]) =>
    decideMember(scenario.voteRules[memberId], {
      conditionIds: [...ids],
      executionMode: 'DEFAULT',
      participantStance,
    });
  // 이미 목표 표인 임원은 "조건이 움직였다"가 아니므로 지금 표가 목표와 다를 때만 센다.
  return voteWith(confirmedIds) !== targetVote && voteWith([...confirmedIds, conditionId]) === targetVote;
}

export function buildConditionRecommendation(
  scenario: Scenario,
  confirmedConditionIds: readonly string[],
  participantStance: ParticipantStance,
  mode: SessionMode,
  stances: Record<ExecMemberId, Stance>,
  liveSuggestedConditionIds?: Partial<Record<ExecMemberId, readonly string[]>>,
  /** 조건은 이미 맞았고 추가 질문의 답만 남은 임원(T110). "더 필요한 조건" 계산에서 빼고
   * 안내 줄에 "답하면 찬성(또는 반대)"으로 따로 말한다. */
  awaitingAnswerIds: readonly ExecMemberId[] = [],
  /** T119: 추천 문구·추가 답변 어디에도 없는 조건은 추천하지 않는다(방어적 — 콘텐츠 불변식
   * 덕에 보통은 모두 true). 없으면 모든 조건을 추천 후보로 본다. */
  isConditionOffered: (conditionId: string) => boolean = () => true,
): ConditionRecommendation {
  // (4) "아직 찬성이 아닌 임원"은 항상 실제 표정으로 가른다 — scripted는 stances 자체가
  // voteRules로 계산된 값이라 requiredConditionsFor(...).persuaded와 결과가 같고, live는
  // 실제 LLM 판단을 그대로 반영한다.
  // 참가자 목표(PersuasionBoard의 targetVote와 같다): AGAINST면 임원을 반대로, 그 외
  // (찬성·미선택)는 찬성으로 움직이는 것이다. 추천 대상·조건 방향·문구가 모두 이를 따른다
  // (PR #20 Codex 28차 P2-2).
  // T101: 입장을 아직 고르지 않았으면(DISCUSS side=null) 찬성을 목표로 가정해 계산하지 않는다.
  if (participantStance === null) {
    return {
      openingLine: '입장을 고르면 설득 목표에 맞는 조건을 추천해 드립니다',
      rows: [],
      bundles: [],
      usedRuleFallback: false,
    };
  }
  const targetStance: Stance = participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  const targetVote = targetStance === 'AGAINST' ? 'NO' : 'YES';
  // 반대 목표에서는 표정이 미정이어도 규칙표 표가 이미 NO인 임원은 돌릴 필요가 없어
  // 대상에서 뺀다(표정이 찬성인 임원은 규칙표와 무관하게 대상이다).
  const alreadyNoByRules = (memberId: ExecMemberId) =>
    targetStance === 'AGAINST' &&
    stances[memberId] !== 'FOR' &&
    decideMember(scenario.voteRules[memberId], {
      conditionIds: [...confirmedConditionIds],
      executionMode: 'DEFAULT',
      participantStance,
    }) === 'NO';
  const awaitingMembers = EXEC_MEMBER_ORDER.filter((memberId) => awaitingAnswerIds.includes(memberId));
  const notYetForMembers = EXEC_MEMBER_ORDER.filter(
    (memberId) =>
      stances[memberId] !== targetStance && !alreadyNoByRules(memberId) && !awaitingMembers.includes(memberId),
  );
  const candidates = scenario.conditions.filter(
    (condition) => !confirmedConditionIds.includes(condition.id) && isConditionOffered(condition.id),
  );

  let usedRuleFallback = false;

  // 임원별로 "이 조건 하나만 추가하면 움직인다"에 해당하는 조건 id 목록을 모은다.
  const singleMovesByMember = new Map<ExecMemberId, string[]>();
  for (const memberId of notYetForMembers) {
    // 발언의 suggestedConditionIds는 방향 정보가 없는 "찬성으로 움직이는 제안"이라 반대
    // 목표에서는 쓰지 않고 규칙표 참고값으로 대신한다(PR #20 Codex 28차 검토 보강).
    if (mode === 'live' && targetStance === 'AGAINST') {
      usedRuleFallback = true;
    } else if (mode === 'live') {
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
        singleAdditionReachesTarget(
          scenario,
          memberId,
          confirmedConditionIds,
          participantStance,
          condition.id,
          targetVote,
        ),
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
  if (mode === 'scripted' && targetStance === 'FOR') {
    for (const memberId of notYetForMembers) {
      if ((singleMovesByMember.get(memberId) ?? []).length > 0) {
        continue;
      }
      const required = requiredConditionsFor(scenario, memberId, confirmedConditionIds, participantStance);
      if (
        !required.conditionIds ||
        required.conditionIds.length < 2 ||
        !required.conditionIds.every(isConditionOffered)
      ) {
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

  const notYetText = notYetForMembers.join('·');
  let openingLine: string;
  if (targetStance === 'AGAINST') {
    // 반대 입장: 지금 반대가 아닌 임원을 반대로 돌리는 쪽으로 말한다.
    const currentWord = notYetForMembers.every((memberId) => stances[memberId] === 'FOR')
      ? '지금 찬성인'
      : '아직 반대가 아닌';
    openingLine =
      notYetForMembers.length === 0
        ? EXEC_MEMBER_ORDER.every((memberId) => stances[memberId] === 'AGAINST')
          ? '지금 임원 4명 모두 반대 쪽입니다.'
          : '지금 찬성 쪽인 임원이 없습니다.'
        : neededLabels.length > 0
          ? `${currentWord} ${notYetText}를 반대로 돌리려면 '${neededLabels.join("'·'")}'이 필요합니다`
          : `${currentWord} ${notYetText}는 조건만으로는 돌리기 어렵습니다`;
  } else {
    // 찬성 입장: 아직 찬성이 아닌 임원 중 고민 중(UNDECIDED)이 섞이면 '반대'라고 단정하지
    // 않는다 — 같은 화면의 입장 표시('고민 중')와 모순됐다(PR #20 Codex 39차 검토 P2).
    const currentWord = notYetForMembers.every((memberId) => stances[memberId] === 'AGAINST')
      ? '지금 반대인'
      : '아직 찬성이 아닌';
    openingLine =
      notYetForMembers.length === 0
        ? '지금 임원 4명 모두 찬성 쪽입니다.'
        : neededLabels.length > 0
          ? `${currentWord} ${notYetText}를 움직이려면 '${neededLabels.join("'·'")}'이 필요합니다`
          : `${currentWord} ${notYetText}는 조건만으로는 움직이기 어렵습니다`;
  }

  // T110: 조건은 맞고 답만 남은 임원은 조건이 아니라 "추가 질문 답변"이 필요하다고 따로 말한다.
  if (awaitingMembers.length > 0) {
    const awaitingLine = `${awaitingMembers.join('·')}는 ${targetStance === 'AGAINST' ? '반대' : '찬성'} 쪽으로 기울었습니다 · 추가 질문에 답하면 확정됩니다`;
    openingLine = notYetForMembers.length === 0 ? `${awaitingLine}.` : `${openingLine}. ${awaitingLine}`;
  }

  return { openingLine, rows, bundles, usedRuleFallback: mode === 'live' && usedRuleFallback };
}

/** 조건 추천이 보여준 조건 id(행·묶음, 중복 없이 처음 나온 순서). 사용 기록(T101)에 담아
 * 결과 화면 "AI가 도운 일"이 추천한 조건 이름을 보여주게 한다. */
export function recommendedConditionIds(recommendation: ConditionRecommendation): string[] {
  const ids: string[] = [];
  for (const row of recommendation.rows) {
    if (!ids.includes(row.conditionId)) ids.push(row.conditionId);
  }
  for (const bundle of recommendation.bundles) {
    for (const id of bundle.conditionIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}
