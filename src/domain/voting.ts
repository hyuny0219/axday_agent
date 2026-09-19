// 우선순위 규칙 평가기와 5석 집계. 표결 규칙은 데이터(VoteRule[])로 표현하고
// 이 파일은 그 데이터를 결정적으로 해석만 한다. LLM은 표를 정하지 않는다.

import type { ExecMemberId, Predicate, Scenario, Vote, VoteRule } from '../content/types';
import type { Ballot, BallotSource, MemberId, Motion } from './types';

export const EXEC_MEMBER_ORDER: readonly ExecMemberId[] = ['CEO', 'CFO', 'CAIO', 'CISO'];

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

/** 임원 4명의 표를 고정된 순서(CEO/CFO/CAIO/CISO)로 확정한다. scripted 규칙 결과다. */
export function decideBoard(scenario: Scenario, motion: Motion): Ballot[] {
  const ctx: VoteContext = {
    conditionIds: motion.effectiveConditionIds,
    executionMode: motion.executionMode,
  };
  return EXEC_MEMBER_ORDER.map((memberId) => ({
    memberId,
    motionId: motion.id,
    motionHash: motion.hash,
    source: 'scripted',
    vote: decideMember(scenario.voteRules[memberId], ctx),
    confirmedAt: motion.frozenAt,
  }));
}

export interface TallyResult {
  outcome: 'PASS' | 'HOLD' | 'REJECT';
  counts: { YES: number; NO: number; HOLD: number; UNCAST: number };
  /** 참가자가 아니라 임원 좌석에 UNCAST가 있는지(응답 장애로 판단이 제한됐는지). */
  limitedByUnavailable: boolean;
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
  const limitedByUnavailable = ballots.some(
    (ballot) => ballot.memberId !== 'PARTICIPANT' && ballot.vote === 'UNCAST',
  );
  return { outcome, counts, limitedByUnavailable };
}

/**
 * 참가자 표를 임원 표에 더한다. 최종 안건 ID가 없는 투표, 이미 기록된 임원 표와
 * 다른 안건을 가리키는 투표, 중복 의석, 확정 후 재투표는 여기서 차단한다.
 * live 모드에서는 임원 표가 아직 하나도 없을 수 있으므로(CONFIRM_VOTE가 먼저 옴) 그
 * 경우 안건 일치 검사는 건너뛴다.
 */
export function castParticipant(
  ballots: Ballot[],
  motion: Pick<Motion, 'id' | 'hash'>,
  vote: Vote,
  source: BallotSource,
): Ballot[] {
  if (!motion.id) {
    throw new Error('최종 안건 ID가 없어 투표할 수 없습니다.');
  }
  const boardBallots = ballots.filter((b) => b.memberId !== 'PARTICIPANT');
  const mismatched = boardBallots.some((b) => b.motionId !== motion.id);
  if (mismatched) {
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
    motionId: motion.id,
    motionHash: motion.hash,
    source,
    vote,
    confirmedAt: Date.now(),
  };
  return [...ballots, participantBallot];
}

/**
 * finalMotion 기준으로 아직 도착하지 않은 임원 좌석·참가자 좌석을 UNCAST(source:
 * 'unavailable')로 채워 5석을 완성한다. 다른 motionHash의 표는 재사용하지 않고(다른
 * 안건에 대한 표는 버리고) 그 좌석도 UNCAST로 채운다. HOLD나 사전 표로 대체하지
 * 않는다(AGENT_BOARDROOM_SPEC.md 6장). EXPIRE·FINALIZE_RESULT가 함께 쓴다.
 */
export function fillMissingBallots(
  ballots: Ballot[],
  motion: Motion,
  now: number,
  unavailableReason: string,
): Ballot[] {
  const matching = ballots.filter((b) => b.motionHash === motion.hash);
  const uncastBallot = (memberId: MemberId): Ballot => ({
    memberId,
    motionId: motion.id,
    motionHash: motion.hash,
    vote: 'UNCAST',
    source: 'unavailable',
    unavailableReason,
    confirmedAt: now,
  });
  const execBallots = EXEC_MEMBER_ORDER.map(
    (memberId) => matching.find((b) => b.memberId === memberId) ?? uncastBallot(memberId),
  );
  const participantBallot =
    matching.find((b) => b.memberId === 'PARTICIPANT') ?? uncastBallot('PARTICIPANT');
  return [...execBallots, participantBallot];
}
