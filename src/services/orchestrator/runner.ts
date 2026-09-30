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
// session.deadline에 묶이지 않고 항상 stage별 상한(boardAgents/live.ts, T65: OPINIONS·VOTE
// 8초, REACTIONS·FOLLOWUP 12초)으로만 정해진다 — budgetMs는 그 값을 절대 깎지 않도록
// Infinity로 넘긴다.
//
// T65 "다시 요청": 실패한 역할만 다시 부르는 retryRound·retryFinalVotes를 추가했다. 표결
// 실패는 여기서 UNCAST를 바로 기록하지 않는다(MARK_EXEC_UNAVAILABLE을 쓰지 않는다) — 대신
// domain/session.ts의 FINALIZE_RESULT가 이미 하던 대로 확정 시점에 남은 미도착 역할을
// fillMissingBallots로 채운다(domain은 건드리지 않는다). 그래서 재요청이 성공하면 확정 전
// RECORD_EXEC_BALLOT으로 실제 표를 기록할 수 있고, 재요청을 안 쓰거나 실패해도 자동 확정
// (awaitResult, 최대 8초)이 그대로 UNCAST로 끝맺어 기존 동작과 같다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type { RequestRegistry } from '../../app/requests';
import type { Clock } from '../../domain/clock';
import type { SessionAction } from '../../domain/session';
import type { Session, Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from '../boardAgents/types';

/** 최종표 대기 상한(AGENT_BOARDROOM_SPEC.md 6장 "8초를 넘지 않는다"). */
export const FINAL_VOTE_WAIT_MS = 8000;
/** 실패한 역할이 있을 때 "미표결 임원 다시 요청"을 위해 자동 확정 전에 더 기다리는 시간
 * (T65, 스펙 6장 예외). 참가자가 이 안에 재요청을 누르면 그 결과가 끝날 때까지(자체
 * 타임아웃만큼) 기다렸다가 확정하고, 누르지 않으면 그대로 UNCAST로 확정한다 — 대기 시간이
 * 예측 가능하도록(부스 운영) 한 번 더 기다리는 상한을 둔다. */
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
  // VOTE 재요청 신호(T65): 매 VOTE 라운드 시작 시 새로 만든다. retryFinalVotes가 불리는
  // 즉시(네트워크 완료를 기다리지 않고) resolveVoteRetryStarted()를 호출해 awaitResult의
  // 대기(VOTE_RETRY_GRACE_MS)를 실제 재요청 완료 대기로 바꿔 준다. 한 번도 재요청하지
  // 않으면 이 promise는 그 VOTE 라운드 동안 계속 pending이라 grace 타이머만 작동한다.
  let voteRetryStarted: Promise<void> = new Promise(() => undefined);
  let resolveVoteRetryStarted: () => void = () => undefined;
  let voteRetryCompletion: Promise<void> = Promise.resolve();

  function resetVoteRetrySignal(): void {
    voteRetryStarted = new Promise((resolve) => {
      resolveVoteRetryStarted = resolve;
    });
    voteRetryCompletion = Promise.resolve();
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
    const run = roundChain.then(() => startFinalVotesNow());
    roundChain = run.catch(() => undefined);
    finalVotesSettled = run;
    return run;
  }

  async function startFinalVotesNow(): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const motion = session.finalMotion;
    // 라운드를 기다리는 사이 리셋됐으면(RESULT/ATTRACT) 표를 요청하지 않는다.
    if (!motion || session.stage !== 'VOTE') {
      return;
    }
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (!scenario) {
      return;
    }

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

    // awaitResult가 이 재요청이 끝날 때까지 확정을 미룰 수 있도록, 실제 호출 전에 먼저
    // "재요청을 시작했다"는 신호부터 보낸다.
    resolveVoteRetryStarted();

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

  async function awaitResult(): Promise<void> {
    const session = deps.store.getSession();
    if (session.stage !== 'VOTE') {
      return;
    }
    await Promise.race([finalVotesSettled, delay(FINAL_VOTE_WAIT_MS)]);

    // 실패한 역할이 있으면(execBallotsPending) 바로 확정하지 않고 "미표결 임원 다시
    // 요청"을 위해 한 번 더 기다린다(T65, 스펙 6장 예외). 재요청이 이미 시작됐으면 grace
    // 타이머 대신 그 완료를 기다리고, 시작되지 않았으면 grace 시간만큼만 기다린 뒤 그대로
    // 진행한다 — 어느 쪽이든 대기 시간은 예측 가능한 상한 안에서 끝난다.
    const afterVotes = deps.store.getSession();
    if (
      afterVotes.sessionId === session.sessionId &&
      afterVotes.stage === 'VOTE' &&
      afterVotes.execBallotsPending
    ) {
      const started = await Promise.race([
        delay(VOTE_RETRY_GRACE_MS).then(() => false as const),
        voteRetryStarted.then(() => true as const),
      ]);
      if (started) {
        await voteRetryCompletion;
      }
    }

    const current = deps.store.getSession();
    if (current.sessionId === session.sessionId && current.stage === 'VOTE') {
      deps.store.dispatch({ type: 'FINALIZE_RESULT' });
    }
  }

  return { runRound, startFinalVotes, awaitResult, retryRound, retryFinalVotes };
}
