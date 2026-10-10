// 임원 4명의 "지금 기울어 있는 쪽" 표정(T63). 표결 집계(voting.ts)는 손대지 않고,
// 그 위에서 무대 오버레이·본문 카드에 보여줄 표시용 값만 계산한다. scripted는 표결
// 규칙표(voteRules)로 미리 계산하고(2026-09-29 사용자 "AI 임원들이 안건을 보고 느낀
// 감정을 항상 표시"), live는 각 임원의 가장 최근 발언에 실린 stance 필드를 그대로 쓴다.

import type { ExecMemberId, Scenario, Vote } from '../content/types';
import type { Ballot, Opinion, Session, SessionStage, Stance } from './types';
import { EXEC_MEMBER_ORDER, decideMember, isGatedByUnanswered } from './voting';
import type { VoteContext } from './voting';

export type { Stance };

/** BRIEFING(과 그 이전 ATTRACT/SELECT)은 넷 다 UNDECIDED다. 이 이후 단계에서만 표결
 * 규칙표로 계산한다(OPINIONS 단계 진입 즉시 넷 함께, DISCUSS는 그대로 유지, REACTIONS는
 * 의견·후속 답이 들어올 때마다 갱신, MOTION·VOTE는 마지막 확정 집합으로 고정 — 아래 표는
 * session.opinions가 그 시점까지 쌓인 값을 그대로 읽기만 해도 자연히 성립한다). */
const STANCE_COMPUTED_STAGES: ReadonlySet<SessionStage> = new Set([
  'OPINIONS',
  'DISCUSS',
  'REACTIONS',
  'MOTION',
  'VOTE',
  'RESULT',
]);

const ALL_UNDECIDED: Record<ExecMemberId, Stance> = {
  CEO: 'UNDECIDED',
  CFO: 'UNDECIDED',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

function voteToStance(vote: Vote): Stance {
  if (vote === 'YES') return 'FOR';
  if (vote === 'NO') return 'AGAINST';
  return 'UNDECIDED';
}

/** 가장 최근 의견의 확정 조건 ID를 그대로 쓴다(합집합이 아니다) —
 * components/opinionConditions.ts의 collectConfirmedConditionIds와 같은 규칙이다.
 * 후속 보완에서 조건을 해제했을 때 그 조건이 되살아나지 않게 하기 위해서다. */
function latestConfirmedConditionIds(opinions: readonly Opinion[]): string[] {
  const latest = opinions[opinions.length - 1];
  if (!latest) {
    return [];
  }
  const result: string[] = [];
  for (const id of latest.confirmedConditionIds) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

/** 참가자가 아직 한 번도 의견을 전달하지 않은 동안(OPINIONS·DISCUSS) scenario의
 * initialOpinions[].openingStance를 그대로 쓴다. PR #13 Codex 3차 검토: voteRules를
 * 조건 없음(conditionIds=[])으로 평가한 "else/always" 분기는 표결 시점에 조건이 끝내
 * 없을 때의 판단이지, 임원이 아직 참가자 말을 듣기도 전에 내는 첫 반응과 같은 개념이
 * 아니다 — 두 안건의 문서가 CAIO의 첫 stance를 "미정"으로 명시했는데(voteRules의
 * always 분기는 NO) 예전 코드는 voteRules만으로 OPINIONS 표정을 계산해 이 차이를
 * 지웠다. opinions가 비어 있는 한(OPINIONS·DISCUSS 모두 해당 — 참가자가 DISCUSS에서야
 * 비로소 말하므로) 이 값을 쓰고, 참가자가 의견을 전달한 뒤(REACTIONS~)에는 그 시점의
 * confirmedConditionIds로 voteRules를 그대로 평가한다(조건이 비어 있어도 이 단계부터는
 * "첫 반응"이 아니라 "그때까지의 판단"이므로 always 분기가 맞다 — 기존 "조건 없이
 * 진행" 경로 테스트와 일치). */
function openingStances(scenario: Scenario): Record<ExecMemberId, Stance> {
  const result: Record<ExecMemberId, Stance> = { ...ALL_UNDECIDED };
  for (const opinion of scenario.initialOpinions) {
    result[opinion.memberId] = opinion.openingStance;
  }
  return result;
}

/** scriptedStances가 읽는 세션 필드. followUpUsed·followUpAnswered는 T110(두 단계 설득)에서
 * 더했다 — 조건이 맞아도 추가 질문에 답하기 전에는 "고민 중"까지만 움직인다. 두 필드를
 * 생략하면 "답을 이미 받은 상태"(followUpAnswered=true)로 본다: 의견 단계(OPINIONS·DISCUSS)와
 * 규칙표 자체를 확인하는 호출부는 값을 넘기지 않아도 되고, 실제 세션을 그대로 넘기는
 * App.tsx는 항상 두 값을 함께 넘긴다. */
export type ScriptedStanceSession = Pick<Session, 'stage' | 'opinions'> &
  Partial<Pick<Session, 'followUpUsed' | 'followUpAnswered'>>;

/** scripted 표결 규칙표로 임원 4명의 표정을 미리 계산한다(순수 함수). live와는 무관하다.
 *
 * T110(2026-10-09 사용자 지시 "처음 추천 문구를 선택해서 의견전달했을 때 전부 설득당하면
 * 재의견을 내지 않아도 성공하기 때문에, 난이도 조절을 해줘"): 조건 덕분에 참가자 쪽으로
 * 움직일 임원(찬성 참가자면 YES, 반대 참가자면 NO — 대칭)은 추가 질문에 답하기 전
 * (REACTIONS, 아직 답하지도 넘기지도 않음)에는 UNDECIDED(고민 중)까지만 보인다. 답을 전달하면
 * (followUpAnswered) 원래 규칙표 결과로, "답하지 않고 넘어가기"를 하면 표결과 같은 값(처음
 * 입장)으로 정해진다. 조건 없이도 같은 편인 임원은 영향이 없다. */
export function scriptedStances(scenario: Scenario, session: ScriptedStanceSession): Record<ExecMemberId, Stance> {
  if (!STANCE_COMPUTED_STAGES.has(session.stage)) {
    return ALL_UNDECIDED;
  }
  if (session.opinions.length === 0) {
    return openingStances(scenario);
  }
  const ctx: VoteContext = {
    conditionIds: latestConfirmedConditionIds(session.opinions),
    executionMode: 'DEFAULT',
    participantStance: session.opinions[session.opinions.length - 1]?.stance ?? null,
    followUpAnswered: session.followUpAnswered ?? true,
  };
  const waiting = session.stage === 'REACTIONS' && session.followUpUsed !== true;
  const result: Record<ExecMemberId, Stance> = { ...ALL_UNDECIDED };
  for (const memberId of EXEC_MEMBER_ORDER) {
    const rules = scenario.voteRules[memberId];
    if (waiting && isGatedByUnanswered(rules, ctx)) {
      result[memberId] = 'UNDECIDED';
      continue;
    }
    result[memberId] = voteToStance(decideMember(rules, ctx));
  }
  return result;
}

/** 지금 추가 질문의 답을 기다리느라 "고민 중"에 머문 임원(T110). 현황판의 "답변 뒤 찬성"
 * 표기와 반응 카드의 "조건은 좋습니다" 문구가 쓴다. scripted 전용이며 REACTIONS 단계에서
 * 아직 답하지도 넘기지도 않았을 때만 비어 있지 않다. */
export function membersAwaitingAnswer(scenario: Scenario, session: ScriptedStanceSession): ExecMemberId[] {
  if (session.stage !== 'REACTIONS' || session.followUpUsed === true || session.opinions.length === 0) {
    return [];
  }
  const ctx: VoteContext = {
    conditionIds: latestConfirmedConditionIds(session.opinions),
    executionMode: 'DEFAULT',
    participantStance: session.opinions[session.opinions.length - 1]?.stance ?? null,
    followUpAnswered: false,
  };
  return EXEC_MEMBER_ORDER.filter((memberId) => isGatedByUnanswered(scenario.voteRules[memberId], ctx));
}

/** 기울어진 방향(T118): 임원 → 참가자 목표 방향(FOR 참가자면 FOR, AGAINST 참가자면 AGAINST). */
export type LeaningMap = Partial<Record<ExecMemberId, 'FOR' | 'AGAINST'>>;

export type LeaningSession = ScriptedStanceSession & Partial<Pick<Session, 'mode'>>;

/** 첫 의견 뒤(REACTIONS, 아직 답하지도 넘기지도 않음) 임원이 참가자 쪽으로 "기울었는지"(T118,
 * 2026-10-10 사용자 지시 "찬반이 변경되었는지 알 수 있게"). 순수 클라이언트 계산이며 표결·서버
 * 규칙은 건드리지 않는다. 표시용 stance는 T110대로 고민 중(UNDECIDED)이지만, 조건이 맞아 답변만
 * 남은 임원에게는 목표 방향을 붙여 "반대 → 찬성 쪽"으로 보여준다.
 * - scripted: membersAwaitingAnswer에 든 임원.
 * - live: 모델 stance(liveCurrent)가 UNDECIDED인데 규칙표로 조건이 충족된(조건 없이는 목표 표가
 *   아닌) 임원. 이미 FOR·AGAINST로 말한 임원은 모델 말을 그대로 둔다. */
export function leaningStances(
  scenario: Scenario,
  session: LeaningSession,
  liveCurrent?: Record<ExecMemberId, Stance>,
  liveAnsweredIds: readonly ExecMemberId[] = [],
): LeaningMap {
  const result: LeaningMap = {};
  if (session.stage !== 'REACTIONS' || session.followUpUsed === true || session.opinions.length === 0) {
    return result;
  }
  const participantStance = session.opinions[session.opinions.length - 1]?.stance ?? null;
  const direction: 'FOR' | 'AGAINST' = participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  if (session.mode !== 'live') {
    for (const memberId of membersAwaitingAnswer(scenario, session)) {
      result[memberId] = direction;
    }
    return result;
  }
  const conditionIds = latestConfirmedConditionIds(session.opinions);
  const targetVote: Vote = direction === 'FOR' ? 'YES' : 'NO';
  for (const memberId of EXEC_MEMBER_ORDER) {
    // 이번 단계(REACTIONS)에 정상 응답(answered)한 임원만 후보다 — 실패·대기 임원은 이전 단계 stance로
    // 기울음을 만들지 않는다(Codex 100차 P2).
    if (!liveAnsweredIds.includes(memberId)) continue;
    if (liveCurrent && liveCurrent[memberId] !== 'UNDECIDED') continue;
    const rules = scenario.voteRules[memberId];
    const ctx: VoteContext = { conditionIds, executionMode: 'DEFAULT', participantStance, followUpAnswered: true };
    if (
      decideMember(rules, ctx) === targetVote &&
      decideMember(rules, { ...ctx, conditionIds: [] }) !== targetVote
    ) {
      result[memberId] = direction;
    }
  }
  return result;
}

/** live 임원의 가장 최근 발언(단계 무관, transcript 전체에서 그 임원의 마지막 항목)에
 * 실린 stance를 그대로 쓴다. 발언이 아직 없으면 UNDECIDED, 이번 라운드 응답이 실패하면
 * (새 발언이 기록되지 않으므로) 직전 발언의 stance가 그대로 남는다. */
export function liveStances(session: Pick<Session, 'transcript'>): Record<ExecMemberId, Stance> {
  const result: Record<ExecMemberId, Stance> = { ...ALL_UNDECIDED };
  for (const memberId of EXEC_MEMBER_ORDER) {
    const statements = session.transcript.statements.filter((item) => item.roleId === memberId);
    const last = statements[statements.length - 1];
    result[memberId] = last?.stance ?? 'UNDECIDED';
  }
  return result;
}

export interface PersuasionStamp {
  /** 내 표와 같은 표가 나를 포함해 3석 이상(5석 과반)이면 true. */
  earned: boolean;
  /** 내 표와 같은 값을 낸 좌석 수(참가자 포함, UNCAST 제외). */
  sameVoteSeats: number;
}

/** "설득 도장" 판정(T63). participantVote와 같은 표를 낸 좌석 수를 참가자 좌석까지
 * 포함해 센다(UNCAST는 세지 않는다). 표결 집계(tally) 자체는 바꾸지 않는다. */
export function persuasionStamp(ballots: readonly Ballot[], participantVote: Vote): PersuasionStamp {
  const sameVoteSeats = ballots.filter(
    (ballot) => ballot.vote !== 'UNCAST' && ballot.vote === participantVote,
  ).length;
  return { earned: sameVoteSeats >= 3, sameVoteSeats };
}

/** 이번 단계(stage)에 정상 응답(answered 상태이면서 그 단계 발언이 있는)한 임원 목록(T118, live 기울음 후보). */
export function answeredRoleIds(
  stage: SessionStage,
  roleStatus: Record<ExecMemberId, string>,
  statements: readonly { roleId: string; stage: string }[],
): ExecMemberId[] {
  return EXEC_MEMBER_ORDER.filter(
    (id) => roleStatus[id] === 'answered' && statements.some((item) => item.roleId === id && item.stage === stage),
  );
}
