// 결과 화면 "이사님의 조건이 임원 표를 몇 명 바꿨는지" 요약과, 부결된 임원의 "한 끗
// 차이" 안내(T96, 2026-10-08 사용자 지시 "내 의견과 조건으로 임원을 설득하는 것임을
// 참가자가 느끼게"). resultSummary.ts의 execRows.changed는 "조건이 하나도 없는 안건"
// 기준(countVotesChangedByConditions와 같은 계산, T43 게이지)이지만, 여기서는 참가자가
// 실제로 체감하는 "내 말에 설득됐나" — 첫 의견 때의 입장과 최종 표를 비교한다. 기준이
// 달라 resultSummary.ts를 고치지 않고 별도 파일로 둔다.

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Session, Stance } from '../domain/types';
import { EXEC_MEMBER_ORDER, requiredConditionsFor } from '../domain/voting';
import { openingStanceOf } from './openingStance';

function stanceMatchesVote(stance: Stance, vote: Vote): boolean {
  if (stance === 'FOR') return vote === 'YES';
  if (stance === 'AGAINST') return vote === 'NO';
  return false;
}

function firstLiveOpinionStance(
  session: Pick<Session, 'transcript'>,
  memberId: ExecMemberId,
): Stance {
  const first = session.transcript.statements.find(
    (item) => item.roleId === memberId && item.stage === 'OPINIONS',
  );
  return first?.stance ?? 'UNDECIDED';
}

/** 임원 4명 중 "첫 의견 때의 입장"과 최종 표가 다른 사람 수(T96). scripted는 시나리오
 * 데이터의 openingStance, live는 실제 OPINIONS 발언의 stance를 쓴다. 최종표가
 * UNCAST(미표결)면 세지 않는다 — 응답이 없었을 뿐 설득된 적도 없다. */
export function countVotesChangedFromOpening(
  scenario: Scenario,
  session: Pick<Session, 'mode' | 'transcript' | 'ballots'>,
): number {
  let changed = 0;
  for (const memberId of EXEC_MEMBER_ORDER) {
    const vote = session.ballots.find((b) => b.memberId === memberId)?.vote ?? 'UNCAST';
    if (vote === 'UNCAST') {
      continue;
    }
    const opening =
      session.mode === 'live' ? firstLiveOpinionStance(session, memberId) : openingStanceOf(scenario, memberId);
    if (!stanceMatchesVote(opening, vote)) {
      changed += 1;
    }
  }
  return changed;
}

/** 부결(NO)한 임원이 조건 1~2개만 더 있었으면 찬성이었을지(T96, "한 끗 차이"). scripted
 * voteRules 기준 계산이라 호출부가 session.mode === 'scripted'일 때만 쓴다. */
export function oneStepAwayNote(
  scenario: Scenario,
  memberId: ExecMemberId,
  finalConditionIds: string[],
  participantStance: 'FOR' | 'AGAINST' | null,
): string | null {
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
): string | null {
  for (const memberId of EXEC_MEMBER_ORDER) {
    const required = requiredConditionsFor(scenario, memberId, finalConditionIds, participantStance);
    const firstId = required.conditionIds?.[0];
    if (!required.persuaded && firstId) {
      return scenario.conditions.find((condition) => condition.id === firstId)?.label ?? firstId;
    }
  }
  return null;
}
