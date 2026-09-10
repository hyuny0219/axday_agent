// 우선순위 규칙 평가기와 5석 집계. 표결 규칙은 데이터(VoteRule[])로 표현하고
// 이 파일은 그 데이터를 결정적으로 해석만 한다. LLM은 표를 정하지 않는다.

import type { ExecMemberId, Predicate, Scenario, Vote, VoteRule } from '../content/types';
import type { Ballot, MemberId, Motion } from './types';

export const EXEC_MEMBER_ORDER: readonly ExecMemberId[] = ['CEO', 'CFO_CAIO', 'CIO', 'CISO'];

export interface VoteContext {
  conditionIds: string[];
  executionMode: string;
}

/** 안건의 유효 조건·실행 방식 아래 술어(predicate) 하나를 평가한다. */
export function evalPredicate(predicate: Predicate, ctx: VoteContext): boolean {
  if ('has' in predicate) {
    return ctx.conditionIds.includes(predicate.has);
  }
  if ('all' in predicate) {
    return predicate.all.every((p) => evalPredicate(p, ctx));
  }
  if ('any' in predicate) {
    return predicate.any.some((p) => evalPredicate(p, ctx));
  }
  if ('not' in predicate) {
    return !evalPredicate(predicate.not, ctx);
  }
  if ('mode' in predicate) {
    return ctx.executionMode === predicate.mode;
  }
  return true; // { always: true }
}

/** 한 임원의 규칙 목록에서 위에서부터 처음 일치한 행의 표를 반환한다. 일치가 없으면 던진다. */
export function decideMember(rules: VoteRule[], ctx: VoteContext): Vote {
  for (const rule of rules) {
    if (evalPredicate(rule.when, ctx)) {
      return rule.vote;
    }
  }
  throw new Error('일치하는 표결 규칙이 없습니다. 규칙 목록의 총괄성을 확인하십시오.');
}

/** 임원 4명의 표를 고정된 순서(CEO/CFO·CAIO/CIO/CISO)로 확정한다. */
export function decideBoard(scenario: Scenario, motion: Motion): Ballot[] {
  const ctx: VoteContext = {
    conditionIds: motion.effectiveConditionIds,
    executionMode: motion.executionMode,
  };
  return EXEC_MEMBER_ORDER.map((memberId) => ({
    memberId,
    motionId: motion.id,
    vote: decideMember(scenario.voteRules[memberId], ctx),
    confirmedAt: motion.frozenAt,
  }));
}

export interface TallyResult {
  outcome: 'PASS' | 'HOLD' | 'REJECT';
  counts: { YES: number; NO: number; HOLD: number; UNCAST: number };
}

/** 5석 표를 집계한다. YES>=3 가결, NO>=3 부결, 그 외 보류. UNCAST는 별도 집계한다. */
export function tally(ballots: Ballot[]): TallyResult {
  if (ballots.length !== 5) {
    throw new Error('의석은 항상 5석이어야 합니다.');
  }
  const counts = { YES: 0, NO: 0, HOLD: 0, UNCAST: 0 };
  for (const ballot of ballots) {
    counts[ballot.vote] += 1;
  }
  let outcome: TallyResult['outcome'] = 'HOLD';
  if (counts.YES >= 3) {
    outcome = 'PASS';
  } else if (counts.NO >= 3) {
    outcome = 'REJECT';
  }
  return { outcome, counts };
}

/**
 * 참가자 표를 임원 4표에 더해 5석을 완성한다.
 * 최종 안건 ID가 없는 투표, 잘못된 안건 ID에 대한 투표, 중복 의석, 확정 후 재투표는 여기서 차단한다.
 */
export function castParticipant(ballots: Ballot[], motionId: string, vote: Vote): Ballot[] {
  if (!motionId) {
    throw new Error('최종 안건 ID가 없어 투표할 수 없습니다.');
  }
  const boardBallots = ballots.filter((b) => b.memberId !== 'PARTICIPANT');
  const referenceMotionId = boardBallots[0]?.motionId;
  if (referenceMotionId === undefined || motionId !== referenceMotionId) {
    throw new Error('잘못된 안건 ID에 대한 투표는 반영할 수 없습니다.');
  }
  // 참가자 의석은 생성 시 항상 confirmedAt이 채워지므로(reducer가 즉시 now로 덮어씀)
  // "이미 있지만 아직 미확정"인 상태는 나오지 않는다. 이미 의석이 있으면 재투표든
  // 중복 생성이든 같은 이유(의석 중복)로 막는다.
  if (ballots.some((b) => b.memberId === 'PARTICIPANT')) {
    throw new Error('참가자 의석은 중복으로 만들 수 없습니다.');
  }
  const participantBallot: Ballot = {
    memberId: 'PARTICIPANT' as MemberId,
    motionId,
    vote,
    confirmedAt: Date.now(),
  };
  return [...ballots, participantBallot];
}
