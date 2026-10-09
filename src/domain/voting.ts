// 우선순위 규칙 평가기와 5석 집계. 표결 규칙은 데이터(VoteRule[])로 표현하고
// 이 파일은 그 데이터를 결정적으로 해석만 한다. LLM은 표를 정하지 않는다.

import type { ExecMemberId, Predicate, Scenario, Vote, VoteRule } from '../content/types';
import type { Ballot, BallotSource, MemberId, Motion } from './types';

export const EXEC_MEMBER_ORDER: readonly ExecMemberId[] = ['CEO', 'CFO', 'CAIO', 'CISO'];

export interface VoteContext {
  conditionIds: string[];
  executionMode: string;
  /** 참가자가 가장 최근에 밝힌 입장(T92). 생략하면 null(입장 미선택)과 같다. */
  participantStance?: 'FOR' | 'AGAINST' | null;
  /**
   * 참가자가 추가 질문에 답했는지(T110, 2026-10-09 사용자 지시 "처음 추천 문구를 선택해서
   * 의견전달했을 때 전부 설득당하면 재의견을 내지 않아도 성공하기 때문에, 난이도 조절을
   * 해줘"). **명시적으로 false일 때만** 조건 때문에 참가자 쪽으로 움직이는 표를 처음
   * 입장(조건 없을 때의 표)으로 되돌린다 — 생략·true는 "조건 규칙을 그대로 평가"라
   * 규칙표 자체를 보는 호출부(조건 추천·필요 조건 계산·기존 테스트)는 영향이 없다.
   * 실제 세션의 표결·표정 계산(session.ts·scripted.ts·stance.ts)은 session.followUpAnswered를
   * 반드시 넘긴다.
   */
  followUpAnswered?: boolean;
}

/** 참가자가 노리는 표: 반대 입장이면 NO, 그 외(찬성·미선택)는 YES(설득 도장·현황판과 같은 전제). */
export function participantTargetVote(participantStance: 'FOR' | 'AGAINST' | null | undefined): 'YES' | 'NO' {
  return participantStance === 'AGAINST' ? 'NO' : 'YES';
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
  if ('participantStance' in predicate) {
    return (ctx.participantStance ?? null) === predicate.participantStance;
  }
  return true; // { always: true }
}

/** 규칙표만으로 처음 일치한 행의 표(followUpAnswered를 보지 않는다). */
function decideByRules(rules: VoteRule[], ctx: VoteContext): Vote {
  for (const rule of rules) {
    if (evalPredicate(rule.when, ctx)) {
      return rule.vote;
    }
  }
  throw new Error('일치하는 표결 규칙이 없습니다. 규칙 목록의 총괄성을 확인하십시오.');
}

/**
 * 추가 질문 답변 게이트(T110). 답하지 않았다면(ctx.followUpAnswered === false) 조건 덕분에
 * 참가자가 노리는 표(찬성이면 YES, 반대면 NO)로 움직인 임원만 조건 없을 때의 표(처음
 * 입장)로 되돌린다. 조건 없이도 이미 목표 표인 임원(①CEO)과 목표 반대편으로 움직인 임원은
 * 그대로다. 반환값 gated가 true면 "답했다면 달랐을 표"라는 뜻이다.
 */
function decideWithGate(rules: VoteRule[], ctx: VoteContext): { vote: Vote; gated: boolean } {
  const vote = decideByRules(rules, ctx);
  if (ctx.followUpAnswered !== false || vote !== participantTargetVote(ctx.participantStance)) {
    return { vote, gated: false };
  }
  const baseline = decideByRules(rules, { ...ctx, conditionIds: [], followUpAnswered: true });
  return baseline === vote ? { vote, gated: false } : { vote: baseline, gated: true };
}

/** 한 임원의 규칙 목록에서 위에서부터 처음 일치한 행의 표를 반환한다. 일치가 없으면 던진다.
 * ctx.followUpAnswered가 false면 답변 게이트(T110)를 적용한다. */
export function decideMember(rules: VoteRule[], ctx: VoteContext): Vote {
  return decideWithGate(rules, ctx).vote;
}

/** 답변 게이트 때문에 표가 처음 입장으로 되돌아갔는지(T110). 표정 계산("고민 중")과 결과
 * 요약의 판단 이유가 쓴다. */
export function isGatedByUnanswered(rules: VoteRule[], ctx: VoteContext): boolean {
  return decideWithGate(rules, ctx).gated;
}

/** 임원 4명의 표를 고정된 순서(CEO/CFO/CAIO/CISO)로 확정한다. scripted 규칙 결과다.
 * participantStance(T92)를 생략하면 null(입장 미선택)과 같다 — 기존 호출부·테스트는
 * 입장을 쓰지 않는 규칙만 평가하므로 동작이 그대로다. */
export function decideBoard(
  scenario: Scenario,
  motion: Motion,
  participantStance: 'FOR' | 'AGAINST' | null = null,
  followUpAnswered = true,
): Ballot[] {
  const ctx: VoteContext = {
    conditionIds: motion.effectiveConditionIds,
    executionMode: motion.executionMode,
    participantStance,
    followUpAnswered,
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

/**
 * "내 조건이 바꾼 표" 게이지(T43, DESIGN_SPEC.md v1.0 3절)가 쓰는 순수 함수. 조건이
 * 하나도 없는 안건(effectiveConditionIds: [])의 decideBoard 결과와 실제 안건의
 * decideBoard 결과를 임원 4명 순서로 비교해, 표가 달라진 임원 수를 센다. executionMode는
 * 실제 안건 그대로 두고 조건만 비운다 — "조건이 표를 얼마나 바꿨는지"만 측정하기
 * 위해서다. 이 함수는 scripted 표시용이며 live 표와는 무관하다(호출부가 scripted에서만
 * 부른다).
 */
export function countVotesChangedByConditions(
  scenario: Scenario,
  motion: Motion,
  participantStance: 'FOR' | 'AGAINST' | null = null,
  followUpAnswered = true,
): number {
  const baseline: Motion = { ...motion, effectiveConditionIds: [] };
  const baselineBallots = decideBoard(scenario, baseline, participantStance);
  const actualBallots = decideBoard(scenario, motion, participantStance, followUpAnswered);
  let changed = 0;
  for (const memberId of EXEC_MEMBER_ORDER) {
    const baselineVote = baselineBallots.find((b) => b.memberId === memberId)?.vote;
    const actualVote = actualBallots.find((b) => b.memberId === memberId)?.vote;
    if (baselineVote !== actualVote) {
      changed += 1;
    }
  }
  return changed;
}

/** 조건 없는 baseline에서 참가자 목표(targetVote)가 아니었는데, 조건을 넣은 최종안에서는
 * 목표 표가 된 임원 목록(PR #20 Codex 46차 검토 P2 — 방향을 따지지 않는
 * countVotesChangedByConditions는 참가자 반대편으로 돌아간 변화까지 조건 성과로 셌다). */
export function membersChangedByConditionsToward(
  scenario: Scenario,
  motion: Motion,
  targetVote: Vote,
  participantStance: 'FOR' | 'AGAINST' | null = null,
  followUpAnswered = true,
): ExecMemberId[] {
  const baseline: Motion = { ...motion, effectiveConditionIds: [] };
  const baselineBallots = decideBoard(scenario, baseline, participantStance);
  const actualBallots = decideBoard(scenario, motion, participantStance, followUpAnswered);
  const changed: ExecMemberId[] = [];
  for (const memberId of EXEC_MEMBER_ORDER) {
    const baselineVote = baselineBallots.find((b) => b.memberId === memberId)?.vote;
    const actualVote = actualBallots.find((b) => b.memberId === memberId)?.vote;
    if (baselineVote !== targetVote && actualVote === targetVote) {
      changed.push(memberId);
    }
  }
  return changed;
}

export interface RequiredConditions {
  /** 이미 YES(찬성)로 설득됐으면 true — 더 필요한 조건이 없다. */
  persuaded: boolean;
  /** 아직 확정하지 않은 조건 중, 추가로 확정하면 YES로 바뀌는 가장 작은 조합(조건 id,
   * scenario.conditions 순서). 이미 확정한 조건이 이 임원을 영구히 NO로 묶어(예: 조건
   * 하나가 즉시 NO를 확정하는 규칙) 더는 어떤 조건으로도 YES에 이를 수 없으면 null —
   * 조건을 되돌릴 수 없으므로(T96) "설득할 조건 없음"과 같은 뜻이다. persuaded가
   * true면 항상 빈 배열이다. */
  conditionIds: string[] | null;
}

/**
 * 설득 현황판(T96, 2026-10-08 사용자 지시 "어떤 조건을 붙여야 AI 임원을 설득할 수
 * 있는지 표현")이 쓰는 순수 함수. 한 임원의 scripted voteRules에서, 지금까지 확정한
 * 조건(confirmedIds)에 조건을 몇 개 더 추가하면 YES(찬성)로 바뀌는지 가장 작은 조합을
 * 찾는다. 조합 크기를 0개부터 늘려가며 처음 YES가 되는 조합을 scenario.conditions
 * 순서대로 찾으므로 결과가 결정적이다. participantStance는 ctx.participantStance로
 * 그대로 넘긴다(지금 두 활성 시나리오의 voteRules는 이 값을 쓰지 않지만, 앞으로 쓸
 * 시나리오를 위해 그대로 받는다). executionMode는 motion.ts의 기본값과 같은 'DEFAULT'로
 * 고정한다(T96 범위의 두 시나리오 모두 이 값만 쓴다, stance.ts의 scriptedStances와 같은
 * 전제).
 */
export function requiredConditionsFor(
  scenario: Scenario,
  memberId: ExecMemberId,
  confirmedIds: readonly string[],
  participantStance: 'FOR' | 'AGAINST' | null = null,
): RequiredConditions {
  const rules = scenario.voteRules[memberId];
  function voteWith(extra: readonly string[]): Vote {
    const ctx: VoteContext = {
      conditionIds: [...confirmedIds, ...extra],
      executionMode: 'DEFAULT',
      participantStance,
    };
    return decideMember(rules, ctx);
  }
  if (voteWith([]) === 'YES') {
    return { persuaded: true, conditionIds: [] };
  }
  const candidates = scenario.conditions
    .map((condition) => condition.id)
    .filter((id) => !confirmedIds.includes(id));
  // 조합 크기를 늘려가며(1개부터) 처음 YES가 되는 조합을 찾는다. 후보 수가 두 활성
  // 시나리오 모두 5개 이하라 2^n 전수 탐색도 가볍다. 같은 크기에서는 candidates 순서
  // (= scenario.conditions 순서)대로 가장 먼저 찾은 조합을 쓴다(결정적).
  for (let size = 1; size <= candidates.length; size += 1) {
    const combo = findComboOfSize(candidates, size, (extra) => voteWith(extra) === 'YES');
    if (combo) {
      return { persuaded: false, conditionIds: combo };
    }
  }
  return { persuaded: false, conditionIds: null };
}

/** candidates에서 크기가 size인 조합을 앞에서부터 순서대로 찾아 predicate를 만족하는
 * 첫 조합을 돌려준다(없으면 null). requiredConditionsFor 전용 헬퍼. */
function findComboOfSize(
  candidates: readonly string[],
  size: number,
  predicate: (combo: string[]) => boolean,
): string[] | null {
  function search(start: number, chosen: string[]): string[] | null {
    if (chosen.length === size) {
      return predicate(chosen) ? [...chosen] : null;
    }
    for (let i = start; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (candidate === undefined) {
        continue;
      }
      const found = search(i + 1, [...chosen, candidate]);
      if (found) {
        return found;
      }
    }
    return null;
  }
  return search(0, []);
}

export interface MemberExplanation {
  vote: Vote;
  reason?: string;
}

/** 한 임원의 규칙 목록에서 처음 일치한 행의 표와 판단 이유를 함께 반환한다(T48,
 * "이사회 한 장 요약"). decideMember와 같은 평가 순서를 쓰되 reason도 돌려준다. */
export function explainMember(rules: VoteRule[], ctx: VoteContext): MemberExplanation {
  const { vote, gated } = decideWithGate(rules, ctx);
  if (gated) {
    // T110: 조건은 맞았지만 추가 질문에 답이 없어 처음 입장으로 돌아간 표. 처음 입장의
    // 규칙 문구("…없으면 반대합니다")는 조건이 있었던 사실과 모순되므로 쓰지 않는다.
    return {
      vote,
      reason:
        vote === 'NO'
          ? '조건은 좋았지만 추가 질문에 답이 없어 마음을 정하지 못하고 반대합니다'
          : '조건은 들었지만 추가 질문에 답이 없어 처음 입장대로 찬성합니다',
    };
  }
  for (const rule of rules) {
    if (evalPredicate(rule.when, ctx)) {
      return { vote: rule.vote, reason: rule.reason };
    }
  }
  throw new Error('일치하는 표결 규칙이 없습니다. 규칙 목록의 총괄성을 확인하십시오.');
}

export interface BoardExplanation {
  memberId: ExecMemberId;
  vote: Vote;
  reason?: string;
  /** 조건 없는 baseline(countVotesChangedByConditions와 같은 계산)과 표가 다르면 true. */
  changed: boolean;
}

/** 임원 4명의 표·판단 이유·바뀐 표 여부를 고정 순서(CEO/CFO/CAIO/CISO)로 반환한다
 * (T48, "이사회 한 장 요약"). changed는 조건이 하나도 없는 안건의 표와 비교한다 — 게이지
 * "내 조건이 바꾼 표 n명"과 같은 계산(countVotesChangedByConditions)이다. */
export function explainBoard(
  scenario: Scenario,
  motion: Motion,
  options: { participantStance?: 'FOR' | 'AGAINST' | null; followUpAnswered?: boolean } = {},
): BoardExplanation[] {
  const ctx: VoteContext = {
    conditionIds: motion.effectiveConditionIds,
    executionMode: motion.executionMode,
    participantStance: options.participantStance ?? null,
    followUpAnswered: options.followUpAnswered ?? true,
  };
  const baselineCtx: VoteContext = {
    conditionIds: [],
    executionMode: motion.executionMode,
    participantStance: options.participantStance ?? null,
  };
  return EXEC_MEMBER_ORDER.map((memberId) => {
    const { vote, reason } = explainMember(scenario.voteRules[memberId], ctx);
    const baselineVote = decideMember(scenario.voteRules[memberId], baselineCtx);
    return { memberId, vote, reason, changed: vote !== baselineVote };
  });
}

/**
 * 참가자 표가 결론을 정했는지(T48, "이사회 한 장 요약" 결정력 문구). 참가자 표를
 * YES/NO/UNCAST 각각으로 바꿔 tally했을 때 outcome이 실제와 하나라도 다르면
 * true다. 참가자 좌석이 없으면(결과 전) false.
 */
export function participantDecisive(ballots: Ballot[]): boolean {
  const participant = ballots.find((b) => b.memberId === 'PARTICIPANT');
  if (!participant) {
    return false;
  }
  const actualOutcome = tally(ballots).outcome;
  const alternativeVotes: Vote[] = ['YES', 'NO', 'UNCAST'];
  return alternativeVotes.some((vote) => {
    const alternativeBallots = ballots.map((b) =>
      b.memberId === 'PARTICIPANT' ? { ...b, vote } : b,
    );
    return tally(alternativeBallots).outcome !== actualOutcome;
  });
}

export interface TallyResult {
  outcome: 'PASS' | 'REJECT';
  counts: { YES: number; NO: number; UNCAST: number };
  /** 참가자가 아니라 임원 좌석에 UNCAST가 있는지(응답 장애로 판단이 제한됐는지). */
  limitedByUnavailable: boolean;
}

/** 5석 표를 집계한다. YES>=3(5석 과반)이면 가결, 그 외(UNCAST로 과반에 못 미친 경우 포함)는
 * 부결이다. UNCAST는 별도 집계한다. */
export function tally(ballots: Ballot[]): TallyResult {
  if (ballots.length !== 5) {
    throw new Error('의석은 항상 5석이어야 합니다.');
  }
  const counts = { YES: 0, NO: 0, UNCAST: 0 };
  for (const ballot of ballots) {
    counts[ballot.vote] += 1;
  }
  const outcome: TallyResult['outcome'] = counts.YES >= 3 ? 'PASS' : 'REJECT';
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
 * 안건에 대한 표는 버리고) 그 좌석도 UNCAST로 채운다. 임의로 YES·NO나 사전 표로
 * 대체하지 않는다(AGENT_BOARDROOM_SPEC.md 6장). FINALIZE_RESULT가 쓴다.
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
