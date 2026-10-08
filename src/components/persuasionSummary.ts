// 결과 화면 "이사님의 조건이 임원 표를 몇 명 바꿨는지" 요약과, 부결된 임원의 "한 끗
// 차이" 안내(T96, 2026-10-08 사용자 지시 "내 의견과 조건으로 임원을 설득하는 것임을
// 참가자가 느끼게").
//
// Codex 27차 검토 P2-2: 처음에는 "첫 의견 때의 입장(openingStance)"과 최종 표를
// 비교했는데, CAIO처럼 첫 의견이 'UNDECIDED'(미정)인 임원은 조건을 하나도 안 붙여도
// voteRules의 always 분기로 표결 시점에는 반드시 YES/NO 중 하나가 되므로 "조건이
// 바꾼 표"로 잘못 셌다. resultSummary.ts의 execRows.changed(T43 게이지)가 이미 쓰는
// "같은 최종안에서 조건만 뺀 표(baseline)와 비교"(domain/voting.ts의
// countVotesChangedByConditions, decideMember(...baselineCtx) 패턴)를 그대로 재사용해
// 실제로 조건 때문에 결과가 달라진 임원만 센다. live는 이 "조건 없는 안건" 가정 자체가
// 성립하지 않아(LLM이 실제로 판단한 결과이지 규칙표가 아니다, resultSummary.ts의
// execRows.changed와 같은 전제) 0으로 둔다.

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Session, Stance, Statement } from '../domain/types';
import { EXEC_MEMBER_ORDER, countVotesChangedByConditions, requiredConditionsFor } from '../domain/voting';
import { buildConditionRecommendation } from './conditionRecommendation';
import { openingStanceOf } from './openingStance';
import { findPhraseForCondition } from './recommendMatch';

function voteToFinalStance(vote: Vote): Stance | null {
  if (vote === 'YES') return 'FOR';
  if (vote === 'NO') return 'AGAINST';
  return null;
}

/** live 결과 요약(PR #20 Codex 33차 P2-1) — live는 조건 없는 대조 표결이 없어 "조건이 표를
 * 바꿨다"는 인과를 계산할 수 없다. 관측 가능한 것만 말한다: 임원의 첫 OPINIONS 입장과 최종
 * 표가 다른 사람 수. 표를 못 낸 임원(UNCAST)은 세지 않는다. */
export function liveStanceChangeLine(
  scenario: Scenario,
  statements: readonly Statement[],
  execVotes: readonly { memberId: ExecMemberId; vote: Vote }[],
): string {
  let changed = 0;
  for (const { memberId, vote } of execVotes) {
    const finalStance = voteToFinalStance(vote);
    if (finalStance === null) continue;
    if (openingStanceOf(scenario, memberId, 'live', statements) !== finalStance) {
      changed += 1;
    }
  }
  return changed > 0
    ? `임원 ${changed}명의 입장이 이사님의 발언 뒤 바뀌었습니다`
    : '임원 입장은 처음과 같았습니다';
}

/** 임원 4명 중 지금 최종안(조건 포함)과 조건 없는 baseline의 표가 다른 사람 수(T96).
 * scripted만 계산하고(live는 규칙표로 "조건 없었다면"을 가정할 수 없어 0) */
export function countVotesChangedByFinalConditions(
  scenario: Scenario,
  session: Pick<Session, 'mode' | 'finalMotion'>,
): number {
  if (session.mode !== 'scripted' || !session.finalMotion) {
    return 0;
  }
  return countVotesChangedByConditions(scenario, session.finalMotion);
}

/** 부결(NO)한 임원이 조건 1~2개만 더 있었으면 찬성이었을지(T96, "한 끗 차이"). scripted
 * voteRules 기준 계산이라 호출부가 session.mode === 'scripted'일 때만 쓴다. */
export function oneStepAwayNote(
  scenario: Scenario,
  memberId: ExecMemberId,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
): string | null {
  // 반대 참가자에게 "찬성이었을 텐데"는 목표와 반대 방향이라 보여주지 않는다.
  if (participantStance === 'AGAINST') {
    return null;
  }
  const required = requiredConditionsFor(scenario, memberId, finalConditionIds, participantStance);
  if (required.persuaded || required.conditionIds === null) {
    return null;
  }
  const ids = required.conditionIds;
  if (ids.length < 1 || ids.length > 2) {
    return null;
  }
  const labels = ids.map((id) => scenario.conditions.find((condition) => condition.id === id)?.label ?? id);
  return labels.length === 1
    ? `'${labels[0]}' 하나만 더 있었으면 찬성`
    : `'${labels.join('·')}'만 더 있었으면 찬성`;
}

/** 임원 표를 하나도 바꾸지 못했을 때(countVotesChangedFromOpening === 0) "다음엔 이런
 * 조건을 붙여 보세요"에 쓸 조건 라벨 하나. 아직 설득되지 않은 임원 중 가장 먼저 찾은
 * (EXEC_MEMBER_ORDER 순서) 필요 조건의 첫 항목이다. 전원 설득 불가(조건으로는 안 됨)면
 * null. */
export function nextTrySuggestionLabel(
  scenario: Scenario,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
  /** 최종 표로 본 임원 입장(반대 참가자 추천 계산에 쓴다). 없으면 모두 찬성으로 본다. */
  finalStances?: Record<ExecMemberId, Stance>,
): string | null {
  if (participantStance === 'AGAINST') {
    // 반대 목표: 임원을 NO로 돌리는 조건 중 이 입장에서 실제로 적용할 문구가 있는 것만.
    const stances =
      finalStances ?? { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' };
    const recommendation = buildConditionRecommendation(
      scenario,
      finalConditionIds,
      'AGAINST',
      'scripted',
      stances as Record<ExecMemberId, Stance>,
    );
    const row = recommendation.rows.find(
      (candidate) => findPhraseForCondition(scenario, candidate.conditionId, 'AGAINST') !== undefined,
    );
    return row?.label ?? null;
  }
  for (const memberId of EXEC_MEMBER_ORDER) {
    const required = requiredConditionsFor(scenario, memberId, finalConditionIds, participantStance);
    const firstId = required.conditionIds?.[0];
    if (!required.persuaded && firstId) {
      return scenario.conditions.find((condition) => condition.id === firstId)?.label ?? firstId;
    }
  }
  return null;
}
