// 라운드 실행기: BoardAgentsAdapter(scripted/live 동일 인터페이스)를 호출해 결과를 세션에
// 반영한다(AGENT_BOARDROOM_SPEC.md 3·6장). 판단은 어댑터(그리고 그 안의 서버/시나리오 데이터)가
// 만들고, 이 파일은 호출·시간 예산·세션 반영·늦은 응답 폐기만 담당한다.
//
// 세션을 직접 들고 있지 않고 매 호출마다 store.getSession()으로 최신 값을 읽는다. 어댑터 호출이
// 끝난 뒤 sessionId(리셋됐는지)·transcript.revision(다른 라운드가 먼저 반영됐는지) 또는
// finalMotion.hash(안건이 바뀌었는지)가 호출 시작 시점과 다르면 결과를 조용히 버리고 dispatch하지
// 않는다(자동 재시도 없음). Statement.createdAt·Ballot.confirmedAt은 여기서만 주입된 Clock으로
// 채운다 — 어댑터는 placeholder만 돌려준다.
//
// T50(2026-09-22 사용자 결정)에서 240초 세션 만료를 없앴다. 라운드 시간 예산은 더 이상
// session.deadline에 묶이지 않고 항상 stage별 상한(boardAgents/live.ts, T65: 기본값은
// server/config.ts의 DEFAULT_ROUND_TIMEOUT_MS·DEFAULT_REACTION_TIMEOUT_MS, T91에서
// 8000/12000 → 15000/20000으로 올렸다)으로만 정해진다 — budgetMs는 그 값을 절대 깎지 않도록
// Infinity로 넘긴다.
//
// T65 "다시 요청": 실패한 역할만 다시 부르는 retryRound·retryFinalVotes를 추가했다. 표결
// 실패는 여기서 UNCAST를 바로 기록하지 않는다(MARK_EXEC_UNAVAILABLE을 쓰지 않는다) — 대신
// domain/session.ts의 FINALIZE_RESULT가 이미 하던 대로 확정 시점에 남은 미도착 역할을
// fillMissingBallots로 채운다(domain은 건드리지 않는다). 그래서 재요청이 성공하면 확정 전
// RECORD_EXEC_BALLOT으로 실제 표를 기록할 수 있고, 재요청을 안 쓰거나 실패해도 자동 확정
// (awaitResult, 최대 finalVoteWaitMs())이 그대로 UNCAST로 끝맺어 기존 동작과 같다.
//
// T136 "미표결 방지": 표 응답이 실패한 임원은 사람이 버튼을 누르지 않아도 awaitResult가 자동으로
// 1회 다시 요청한다(대기 상한은 finalVoteWaitMs() — 서버 VOTE 타임아웃 + 전송 여유). 그래도 끝내
// 표가 없으면 UNCAST로 두지 않고 규칙표(rulesFallbackBallot, source 'rules')로 정한 표를 기록한다.
// 수동 "다시 물어보기"는 자동 재요청이 시작되기 전 짧은 틈에만 보이고, 이미 재요청이 시작됐으면
// 자동 재요청은 건너뛴다(임원당 재요청은 최대 1회).
//
// PR #11 Codex 20차 P1: startFinalVotes()는 roundChain 뒤에 이어 붙기 때문에 REACTIONS·
// FOLLOWUP이 아직 응답 전이면 실제 표 호출은 그 라운드가 끝날 때까지(최대
// reactionTimeoutMs) 시작되지 않는다. 그런데 awaitResult()의 FINAL_VOTE_WAIT_MS 타이머는
// 참가자가 확정한 시점에 바로 시작됐었다 — 그래서 앞 라운드가 늦게 끝나면 표 호출이 시작되기도
// 전에(혹은 시작 직후) 그 대기+유예가 다 지나가 실제로 도착한 표까지 UNCAST로 덮어썼다.
// voteRoundStarted 신호로 "앞 라운드가 끝나 표 호출이 실제로 시작된 시점"을 표시하고,
// awaitResult()가 그 신호(또는 전체 settle)를 먼저 기다린 뒤에야 그 타이머를 시작하게
// 고쳤다 — 이 첫 대기는 roundChain 자체의 stage별 상한에 갇혀 있어 별도 delay 없이도
// 무한히 늘어나지 않는다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type { RequestRegistry } from '../../app/requests';
import type { Clock } from '../../domain/clock';
import type { SessionAction } from '../../domain/session';
import type { Session, Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER, rulesFallbackBallot } from '../../domain/voting';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from '../boardAgents/types';
import { getRoundTimeouts, TRANSPORT_MARGIN_MS } from '../transport/roundTimeouts';

/** 최종표 대기 상한의 기본값(문서·호환용 — getRoundTimeouts().roundTimeoutMs의 기본값(T91,
 * 15000)과 같다). 실제 대기는 finalVoteWaitMs()가 매번 현재 캐시된 값으로 계산한다: 운영자가
 * ROUND_TIMEOUT_MS를 이 값보다 크게 잡으면(DEPLOY.md) live 어댑터의 표 요청 자체도 그만큼
 * (+ TRANSPORT_MARGIN_MS) 더 걸릴 수 있는데, 이 상수를 그대로 썼다면 유효한 표 응답이
 * 도착하기 전에 UNCAST로 확정해버렸다(PR #11 Codex 25차 P2). */
export const FINAL_VOTE_WAIT_MS = 15000;

/** 최종표 최초 대기 = 서버 VOTE 타임아웃(roundTimeoutMs, /api/health로 갱신) + 클라이언트
 * 전송 여유(TRANSPORT_MARGIN_MS) — boardAgents/live.ts의 fetch abort 타이머와 정확히 같은
 * 길이를 쓴다. 이 값보다 짧게 기다리면 서버가 아직 응답할 시간이 남았는데도 미리 재요청
 * grace로 넘어가거나 UNCAST로 확정하게 된다. */
function finalVoteWaitMs(): number {
  return getRoundTimeouts().roundTimeoutMs + TRANSPORT_MARGIN_MS;
}

/** 최초 표 요청이 상한(finalVoteWaitMs())에 닿았는데 아직 settle되지 않았을 때 늦은 응답을 더
 * 기다리는 시간(T65). T136부터는 이 뒤에 자동 재요청이 이어지고, 재요청도 실패하면 규칙표로 정한다. */
export const VOTE_RETRY_GRACE_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OrchestratorStore {
  getSession(): Session;
  dispatch(action: SessionAction): void;
}

export interface OrchestratorDeps {
  adapter: BoardAgentsAdapter;
  clock: Clock;
  requests: RequestRegistry;
  store: OrchestratorStore;
  /** 세션의 scenarioId로 시나리오 데이터를 찾는다. 못 찾으면 라운드/표결을 조용히 건너뛴다
   * (호출부가 잘못된 scenarioId로 부른 경우이며, 정상 흐름에서는 일어나지 않는다). */
  getScenario(scenarioId: string): Scenario | undefined;
}

export interface Orchestrator {
  runRound(stage: StatementStage): Promise<void>;
  startFinalVotes(): Promise<void>;
  awaitResult(): Promise<void>;
  /** 실패한 역할만 같은 stage로 다시 부른다("응답 없는 임원 다시 요청", T65). 화면(호출부)이
   * roleStatus==='failed'인 역할을 골라 넘긴다 — 라운드당 1회 제한은 화면 쪽 상태다. */
  retryRound(stage: StatementStage, roleIds: ExecMemberId[]): Promise<void>;
  /** 미표결(UNCAST가 될) 역할만 최종표를 다시 요청한다("미표결 임원 다시 요청", T65, 1회). */
  retryFinalVotes(roleIds: ExecMemberId[]): Promise<void>;
}

function roundMethod(
  adapter: BoardAgentsAdapter,
  stage: StatementStage,
): (ctx: BoardAgentsContext) => Promise<StatementOutcome[]> {
  if (stage === 'OPINIONS') {
    return (ctx) => adapter.initialOpinions(ctx);
  }
  if (stage === 'REACTIONS') {
    return (ctx) => adapter.reactions(ctx);
  }
  return (ctx) => adapter.followUp(ctx);
}

function failedBallotOutcomes(roleIds: ExecMemberId[], reason: string): BallotOutcome[] {
  return roleIds.map((roleId) => ({
    roleId,
    status: 'failed' as const,
    failReason: reason,
  }));
}

/**
 * 라운드·표를 시작하거나 그 결과를 반영해도 되는 세션인가. ATTRACT·SELECT(아직 안건이 없음)와
 * RESULT(확정으로 끝남)에서는 새 모델 호출을 시작하지 않고, 늦게 온 응답도 버린다.
 */
function isSessionOpen(session: Session): boolean {
  return session.stage !== 'ATTRACT' && session.stage !== 'SELECT' && session.stage !== 'RESULT';
}

/** scripted/live 어댑터를 같은 방식으로 호출해 세션에 반영하는 실행기를 만든다. */
export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  // startFinalVotes()가 시작한 호출의 완료 여부를 awaitResult()가 기다릴 수 있게 보관한다.
  // 아직 한 번도 시작하지 않았으면 즉시 settle되는 값으로 둔다.
  let finalVotesSettled: Promise<void> = Promise.resolve();
  // 라운드는 직렬로 돈다. 앞 라운드(예: BRIEFING에서 미리 부른 OPINIONS)가 아직 응답 전인데
  // 참가자가 먼저 다음 단계로 넘어가 REACTIONS를 시작하면, 두 라운드가 같은 baseRevision을
  // 잡아 늦게 온 쪽이 stale로 폐기된다. 앞 라운드가 끝나 반영된 뒤에 다음 라운드가
  // baseRevision을 읽게 해서 발언이 사라지지 않게 한다. 리셋은 abortAll로 앞 라운드를 즉시
  // 끝내므로 대기가 길어지지 않는다.
  let roundChain: Promise<void> = Promise.resolve();
  // VOTE 재요청 완료 신호(T65): 매 VOTE 라운드 시작 시 새로 만든다. 재요청(수동·자동)이 시작되면
  // voteRetryCompletion이 그 완료를 가리켜, awaitResult가 확정 전에 그 끝을 기다릴 수 있다.
  let voteRetryCompletion: Promise<void> = Promise.resolve();
  // 이 VOTE 라운드에서 재요청(수동·자동)을 이미 시작했는지(T136) — 임원당 재요청은 1회다.
  let voteRetryUsed = false;

  function resetVoteRetrySignal(): void {
    voteRetryUsed = false;
    voteRetryCompletion = Promise.resolve();
  }

  // 표결 라운드가 실제로(roundChain을 다 드레인한 뒤) 시작됐다는 신호(PR #11 Codex 20차
  // P1). startFinalVotes()가 새 표결을 예약할 때마다 새로 만들고, startFinalVotesNow()가
  // 앞 라운드를 기다리고 세션 유효성 검사까지 통과한 바로 그 시점에 resolve한다.
  // awaitResult()는 finalVoteWaitMs() 타이머를 시작하기 전에 이 신호(또는 전체 settle)부터 기다린다.
  let voteRoundStarted: Promise<void> = new Promise(() => undefined);
  let resolveVoteRoundStarted: () => void = () => undefined;

  function resetVoteRoundStartedSignal(): void {
    voteRoundStarted = new Promise((resolve) => {
      resolveVoteRoundStarted = resolve;
    });
  }

  function runRound(stage: StatementStage): Promise<void> {
    const run = roundChain.then(() => runRoundNow(stage));
    roundChain = run.catch(() => undefined);
    return run;
  }

  /** 실패한 역할만 같은 stage로 다시 부른다(T65). 라운드 사슬 뒤에 이어 붙여 앞선 라운드·
   * 재요청과 순서가 섞이지 않게 한다. */
  function retryRound(stage: StatementStage, roleIds: ExecMemberId[]): Promise<void> {
    const run = roundChain.then(() => runRoundNow(stage, roleIds));
    roundChain = run.catch(() => undefined);
    return run;
  }

  /** roleIds가 없으면 임원 4명 전체(기존 동작), 있으면 그 역할만 부른다("다시 요청"). 두
   * 경우 모두 baseRevision·sessionId·stage 열림 여부로 늦은 응답을 버린다. */
  async function runRoundNow(stage: StatementStage, roleIds?: ExecMemberId[]): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const baseRevision = session.transcript.revision;
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    const targets = roleIds ?? EXEC_MEMBER_ORDER;
    // 대기 중이던 라운드가 차례를 받았을 때 세션이 이미 리셋·종료됐으면 모델을 부르지 않는다.
    // 재요청인데 넘어온 역할이 없으면(이미 다른 경로로 채워졌거나 잘못된 호출) 건너뛴다.
    if (!scenario || !isSessionOpen(session) || targets.length === 0) {
      return;
    }

    for (const roleId of targets) {
      deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId, status: 'pending', stage });
    }

    const handle = deps.requests.begin(sessionId);
    const ctx: BoardAgentsContext = {
      sessionId,
      requestId: handle.requestId,
      session,
      scenario,
      budgetMs: Number.POSITIVE_INFINITY,
      signal: handle.signal,
      roleIds,
    };

    let outcomes: StatementOutcome[];
    try {
      outcomes = await roundMethod(deps.adapter, stage)(ctx);
    } catch {
      outcomes = targets.map((roleId) => ({ roleId, status: 'failed' as const, failReason: 'adapter_error' }));
    } finally {
      deps.requests.finish(handle);
    }

    // 늦은 응답 폐기: 그 사이 세션이 리셋됐거나, 다른 라운드가 먼저 revision을 올렸거나,
    // 이미 RESULT로 끝났으면 아무것도 dispatch하지 않는다.
    const current = deps.store.getSession();
    if (
      current.sessionId !== sessionId ||
      current.transcript.revision !== baseRevision ||
      !isSessionOpen(current)
    ) {
      return;
    }

    const now = deps.clock.now();
    const statements: Statement[] = outcomes
      .filter(
        (outcome): outcome is StatementOutcome & { statement: Statement } =>
          outcome.status === 'answered' && outcome.statement !== undefined,
      )
      .map((outcome) => ({ ...outcome.statement, createdAt: now }));

    if (statements.length > 0) {
      deps.store.dispatch({ type: 'APPEND_STATEMENTS', stage, statements, baseRevision });
    }
    for (const outcome of outcomes) {
      deps.store.dispatch({
        type: 'SET_ROLE_STATUS',
        roleId: outcome.roleId,
        status: outcome.status === 'answered' ? 'answered' : 'failed',
        stage,
      });
    }
  }

  // 최종표도 라운드 사슬 뒤에 시작한다. 참가자가 임원 반응을 기다리지 않고 안건을 고정하면
  // REACTIONS·FOLLOWUP이 아직 대기 중일 수 있는데, 그 전에 스냅샷을 잡으면 표 요청의
  // 회의 기록에 참가자 의견에 대한 반응이 빠진다. finalVotesSettled는 동기적으로 잡아
  // awaitResult()가 호출 순서와 무관하게 같은 약속을 기다리게 한다.
  function startFinalVotes(): Promise<void> {
    resetVoteRoundStartedSignal();
    const run = roundChain.then(() => startFinalVotesNow());
    roundChain = run.catch(() => undefined);
    finalVotesSettled = run;
    return run;
  }

  async function startFinalVotesNow(): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const motion = session.finalMotion;
    // 라운드를 기다리는 사이 리셋됐으면(RESULT/ATTRACT) 표를 요청하지 않는다. 이 경우
    // voteRoundStarted는 resolve하지 않지만, awaitResult()는 finalVotesSettled(이 함수의
    // 반환)로 대신 깨어나므로 무한히 기다리지 않는다.
    if (!motion || session.stage !== 'VOTE') {
      return;
    }
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (!scenario) {
      return;
    }

    // 여기부터가 "표결 라운드가 실제로 시작"하는 시점이다 — awaitResult()의 finalVoteWaitMs() 타이머가
    // 이 신호를 기다렸다가 시작된다.
    resolveVoteRoundStarted();
    resetVoteRetrySignal();
    for (const roleId of EXEC_MEMBER_ORDER) {
      deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId, status: 'pending' });
    }

    const handle = deps.requests.begin(sessionId);
    const ctx: BoardAgentsContext = {
      sessionId,
      requestId: handle.requestId,
      session,
      scenario,
      budgetMs: Number.POSITIVE_INFINITY,
      signal: handle.signal,
    };

    const run = (async () => {
      let outcomes: BallotOutcome[];
      try {
        outcomes = await deps.adapter.finalVotes(ctx);
      } catch {
        outcomes = failedBallotOutcomes(EXEC_MEMBER_ORDER as ExecMemberId[], 'adapter_error');
      } finally {
        deps.requests.finish(handle);
      }

      // 늦은 응답 폐기: 세션이 리셋됐거나(다른 sessionId) 고정 안건이 바뀌었으면(다른 hash)
      // 도착한 표를 반영하지 않는다.
      const current = deps.store.getSession();
      if (current.sessionId !== sessionId || current.finalMotion?.hash !== motion.hash) {
        return;
      }

      applyVoteOutcomes(outcomes, sessionId, motion.hash);
    })();

    await run;
  }

  /** 표 응답을 세션에 반영한다. 실패한 역할은 여기서 UNCAST를 기록하지 않는다(도메인의
   * MARK_EXEC_UNAVAILABLE·RECORD_EXEC_BALLOT은 같은 역할의 표를 두 번 반영하지 못하게
   * 막는다) — 대신 roleStatus만 'failed'로 남겨 "다시 요청" 재시도가 그 역할의 표를 나중에
   * 기록할 수 있게 열어 둔다. 재요청을 쓰지 않거나 다시 실패해도 FINALIZE_RESULT(도메인,
   * 안 바꿈)의 fillMissingBallots가 확정 시점에 남은 역할을 UNCAST로 채운다. */
  function applyVoteOutcomes(outcomes: BallotOutcome[], sessionId: string, motionHash: string): void {
    const now = deps.clock.now();
    for (const outcome of outcomes) {
      const current = deps.store.getSession();
      if (current.sessionId !== sessionId || current.finalMotion?.hash !== motionHash) {
        return;
      }
      if (outcome.status === 'answered' && outcome.ballot) {
        deps.store.dispatch({
          type: 'RECORD_EXEC_BALLOT',
          ballot: { ...outcome.ballot, confirmedAt: now },
        });
        deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId: outcome.roleId, status: 'answered' });
      } else {
        deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId: outcome.roleId, status: 'failed' });
      }
    }
  }

  /** 미표결(실패) 역할만 최종표를 한 번 더 요청한다("미표결 임원 다시 요청", T65). 세션이
   * 이미 RESULT로 확정됐거나 안건이 바뀌었으면 아무 것도 하지 않는다(늦은 응답과 같은
   * 규칙) — 확정 뒤 도착한 표는 결과를 바꾸지 못한다(스펙 6장). */
  async function retryFinalVotes(roleIds: ExecMemberId[]): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const motion = session.finalMotion;
    if (!motion || session.stage !== 'VOTE' || roleIds.length === 0) {
      return;
    }
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (!scenario) {
      return;
    }

    voteRetryUsed = true;

    for (const roleId of roleIds) {
      deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId, status: 'pending' });
    }

    const handle = deps.requests.begin(sessionId);
    const ctx: BoardAgentsContext = {
      sessionId,
      requestId: handle.requestId,
      session,
      scenario,
      budgetMs: Number.POSITIVE_INFINITY,
      signal: handle.signal,
      roleIds,
    };

    const completion = (async () => {
      let outcomes: BallotOutcome[];
      try {
        outcomes = await deps.adapter.finalVotes(ctx);
      } catch {
        outcomes = failedBallotOutcomes(roleIds, 'adapter_error');
      } finally {
        deps.requests.finish(handle);
      }

      applyVoteOutcomes(outcomes, sessionId, motion.hash);
    })();
    voteRetryCompletion = completion;

    await completion;
  }

  function isVotePending(sessionId: string): boolean {
    const current = deps.store.getSession();
    return current.sessionId === sessionId && current.stage === 'VOTE' && current.execBallotsPending;
  }

  /** 아직 표가 기록되지 않은 임원(고정 순서). */
  function missingExecRoles(): ExecMemberId[] {
    const { ballots } = deps.store.getSession();
    return EXEC_MEMBER_ORDER.filter((roleId) => !ballots.some((b) => b.memberId === roleId));
  }

  /** 표가 없는 임원을 규칙표로 정한 표로 채운다(T136). live 요청과 같은 맥락(확정 조건·참가자
   * 입장·추가 질문 답변 여부)으로 decideMember를 평가한다. 도메인의 RECORD_EXEC_BALLOT이
   * 중복·다른 안건 해시를 막는다. */
  function recordRulesFallbackBallots(sessionId: string): void {
    const session = deps.store.getSession();
    const motion = session.finalMotion;
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (session.sessionId !== sessionId || session.mode !== 'live' || !motion || !scenario) {
      return;
    }
    const stance = session.opinions[session.opinions.length - 1]?.stance ?? null;
    const now = deps.clock.now();
    for (const roleId of missingExecRoles()) {
      deps.store.dispatch({
        type: 'RECORD_EXEC_BALLOT',
        ballot: rulesFallbackBallot(scenario, motion, roleId, stance, session.followUpAnswered, now),
      });
    }
  }

  async function awaitResult(): Promise<void> {
    const session = deps.store.getSession();
    if (session.stage !== 'VOTE') {
      return;
    }

    // 표결 라운드가 실제로 시작되기 전(앞선 REACTIONS·FOLLOWUP이 roundChain을 드레인하는
    // 동안)에는 finalVoteWaitMs() 타이머를 시작하지 않는다(PR #11 Codex 20차 P1). voteRoundStarted가
    // resolve되면 실제 표 호출이 막 시작된 것이고, startFinalVotesNow가 세션 유효성 검사에
    // 걸려 표를 아예 부르지 않았다면 finalVotesSettled가 먼저 끝나 대신 깨운다 — 어느 쪽이든
    // 이 대기는 roundChain 자체의 stage별 상한(reactionTimeoutMs)에 갇혀 있다.
    await Promise.race([voteRoundStarted, finalVotesSettled]);

    const afterStart = deps.store.getSession();
    if (afterStart.sessionId !== session.sessionId || afterStart.stage !== 'VOTE') {
      return;
    }

    await Promise.race([finalVotesSettled, delay(finalVoteWaitMs())]);

    // T136: 표가 비는 임원이 있으면 사람이 누르기를 기다리지 않고 자동으로 1회 다시 요청한다.
    // 최초 요청이 상한까지 settle되지 않았으면 늦은 응답을 VOTE_RETRY_GRACE_MS만 더 기다린 뒤
    // (그 사이 settle되면 바로) 빈 임원을 판단한다. 이미 수동 재요청이 시작됐으면 그 완료를 기다린다.
    // 재요청 대기는 finalVoteWaitMs()(서버 VOTE 타임아웃 + 전송 여유)를 넘기지 않는다.
    if (isVotePending(session.sessionId)) {
      await Promise.race([finalVotesSettled, delay(VOTE_RETRY_GRACE_MS)]);
    }
    if (isVotePending(session.sessionId)) {
      const missing = missingExecRoles();
      if (voteRetryUsed) {
        await Promise.race([voteRetryCompletion, delay(finalVoteWaitMs())]);
      } else if (missing.length > 0) {
        await Promise.race([retryFinalVotes(missing), delay(finalVoteWaitMs())]);
      }
    }

    // 자동 재요청까지 실패한 임원은 UNCAST 대신 규칙표로 정한 표를 기록한다(T136, live만).
    if (isVotePending(session.sessionId)) {
      recordRulesFallbackBallots(session.sessionId);
    }

    const current = deps.store.getSession();
    if (current.sessionId === session.sessionId && current.stage === 'VOTE') {
      deps.store.dispatch({ type: 'FINALIZE_RESULT' });
    }
  }

  return { runRound, startFinalVotes, awaitResult, retryRound, retryFinalVotes };
}
