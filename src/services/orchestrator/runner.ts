// 라운드 실행기: BoardAgentsAdapter(scripted/live 동일 인터페이스)를 호출해 결과를 세션에
// 반영한다(AGENT_BOARDROOM_SPEC.md 3·6장). 판단은 어댑터(그리고 그 안의 서버/시나리오 데이터)가
// 만들고, 이 파일은 호출·시간 예산·세션 반영·늦은 응답 폐기만 담당한다.
//
// 세션을 직접 들고 있지 않고 매 호출마다 store.getSession()으로 최신 값을 읽는다. 어댑터 호출이
// 끝난 뒤 sessionId(리셋됐는지)·transcript.revision(다른 라운드가 먼저 반영됐는지) 또는
// finalMotion.hash(안건이 바뀌었는지)가 호출 시작 시점과 다르면 결과를 조용히 버리고 dispatch하지
// 않는다(자동 재시도 없음). Statement.createdAt·Ballot.confirmedAt은 여기서만 주입된 Clock으로
// 채운다 — 어댑터는 placeholder만 돌려준다.

import type { Scenario } from '../../content/types';
import type { RequestRegistry } from '../../app/requests';
import type { Clock } from '../../domain/clock';
import { remaining } from '../../domain/clock';
import type { SessionAction } from '../../domain/session';
import type { Session, Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from '../boardAgents/types';

/** 최종표 대기 상한(AGENT_BOARDROOM_SPEC.md 6장 "8초 또는 deadline을 넘지 않는다"). */
export const FINAL_VOTE_WAIT_MS = 8000;

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

function failedStatementOutcomes(reason: string): StatementOutcome[] {
  return EXEC_MEMBER_ORDER.map((roleId) => ({ roleId, status: 'failed' as const, failReason: reason }));
}

function failedBallotOutcomes(reason: string): BallotOutcome[] {
  return EXEC_MEMBER_ORDER.map((roleId) => ({ roleId, status: 'failed' as const, failReason: reason }));
}

/** scripted/live 어댑터를 같은 방식으로 호출해 세션에 반영하는 실행기를 만든다. */
export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  // startFinalVotes()가 시작한 호출의 완료 여부를 awaitResult()가 기다릴 수 있게 보관한다.
  // 아직 한 번도 시작하지 않았으면 즉시 settle되는 값으로 둔다.
  let finalVotesSettled: Promise<void> = Promise.resolve();

  async function runRound(stage: StatementStage): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const baseRevision = session.transcript.revision;
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (!scenario) {
      return;
    }

    for (const roleId of EXEC_MEMBER_ORDER) {
      deps.store.dispatch({ type: 'SET_ROLE_STATUS', roleId, status: 'pending' });
    }

    const handle = deps.requests.begin(sessionId);
    const ctx: BoardAgentsContext = {
      sessionId,
      requestId: handle.requestId,
      session,
      scenario,
      budgetMs: remaining(session, deps.clock.now()),
      signal: handle.signal,
    };

    let outcomes: StatementOutcome[];
    try {
      outcomes = await roundMethod(deps.adapter, stage)(ctx);
    } catch {
      outcomes = failedStatementOutcomes('adapter_error');
    } finally {
      deps.requests.finish(handle);
    }

    // 늦은 응답 폐기: 그 사이 세션이 리셋됐거나 다른 라운드가 먼저 revision을 올렸으면 아무
    // 것도 dispatch하지 않는다.
    const current = deps.store.getSession();
    if (current.sessionId !== sessionId || current.transcript.revision !== baseRevision) {
      return;
    }

    const now = deps.clock.now();
    const statements: Statement[] = outcomes
      .filter((outcome): outcome is StatementOutcome & { statement: Statement } =>
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
      });
    }
  }

  async function startFinalVotes(): Promise<void> {
    const session = deps.store.getSession();
    const sessionId = session.sessionId;
    const motion = session.finalMotion;
    if (!motion) {
      return;
    }
    const scenario = session.scenarioId ? deps.getScenario(session.scenarioId) : undefined;
    if (!scenario) {
      return;
    }

    const handle = deps.requests.begin(sessionId);
    const ctx: BoardAgentsContext = {
      sessionId,
      requestId: handle.requestId,
      session,
      scenario,
      budgetMs: remaining(session, deps.clock.now()),
      signal: handle.signal,
    };

    const run = (async () => {
      let outcomes: BallotOutcome[];
      try {
        outcomes = await deps.adapter.finalVotes(ctx);
      } catch {
        outcomes = failedBallotOutcomes('adapter_error');
      } finally {
        deps.requests.finish(handle);
      }

      // 늦은 응답 폐기: 세션이 리셋됐거나(다른 sessionId) 고정 안건이 바뀌었으면(다른 hash)
      // 도착한 표를 반영하지 않는다.
      const current = deps.store.getSession();
      if (current.sessionId !== sessionId || current.finalMotion?.hash !== motion.hash) {
        return;
      }

      const now = deps.clock.now();
      for (const outcome of outcomes) {
        if (outcome.status === 'answered' && outcome.ballot) {
          deps.store.dispatch({
            type: 'RECORD_EXEC_BALLOT',
            ballot: { ...outcome.ballot, confirmedAt: now },
          });
        } else {
          deps.store.dispatch({
            type: 'MARK_EXEC_UNAVAILABLE',
            roleId: outcome.roleId,
            reason: outcome.failReason ?? '응답을 받지 못했습니다.',
          });
        }
      }
    })();

    finalVotesSettled = run;
    await run;
  }

  async function awaitResult(): Promise<void> {
    const session = deps.store.getSession();
    if (session.stage !== 'VOTE') {
      return;
    }
    const waitMs = Math.min(FINAL_VOTE_WAIT_MS, remaining(session, deps.clock.now()));
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
    await Promise.race([finalVotesSettled, timeoutPromise]);

    const current = deps.store.getSession();
    if (current.sessionId === session.sessionId && current.stage === 'VOTE') {
      deps.store.dispatch({ type: 'FINALIZE_RESULT' });
    }
  }

  return { runRound, startFinalVotes, awaitResult };
}
