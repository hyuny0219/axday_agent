// orchestrator/runner.ts: 가짜 어댑터·가짜 시계로 정상 반영, 일부 실패, 리셋 후 늦은 응답
// 폐기, FINALIZE_RESULT 타이밍(먼저 온 쪽 우선)을 확인한다. scripted 어댑터를 직접 넣어
// 지연 없이 즉시 반영되는지도 함께 본다. AGENT_BOARDROOM_SPEC.md 3·6장.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestRegistry } from '../../src/app/requests';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import { fakeClock, type FakeClock } from '../../src/domain/clock';
import { createInitialSession, reduce, type SessionAction } from '../../src/domain/session';
import type { Session, SessionMode, Statement } from '../../src/domain/types';
import { EXEC_MEMBER_ORDER } from '../../src/domain/voting';
import { createScriptedBoardAgentsAdapter } from '../../src/services/boardAgents/scripted';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  StatementOutcome,
} from '../../src/services/boardAgents/types';
import {
  createOrchestrator,
  FINAL_VOTE_WAIT_MS,
  type OrchestratorStore,
} from '../../src/services/orchestrator/runner';

function selectScenario(clock: FakeClock, mode: SessionMode): Session {
  let session = createInitialSession(clock.now());
  session = reduce(session, { type: 'START' }, clock.now());
  session = reduce(session, { type: 'SET_MODE', mode }, clock.now());
  session = reduce(
    session,
    { type: 'SELECT_SCENARIO', scenarioId: aiAssistantScenario.id },
    clock.now(),
  );
  return session;
}

function toOpinionsStage(clock: FakeClock, mode: SessionMode = 'live'): Session {
  const session = selectScenario(clock, mode);
  return reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // BRIEFING -> OPINIONS
}

function toVoteStage(clock: FakeClock): Session {
  let session = toOpinionsStage(clock, 'live');
  session = reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // OPINIONS -> DISCUSS
  session = reduce(
    session,
    {
      type: 'SUBMIT_OPINION',
      originalText: '검토했습니다. 작은 범위로 시작하는 데 동의합니다.',
      selectedPhraseIds: [],
      confirmedConditionIds: [],
    },
    clock.now(),
  ); // DISCUSS -> REACTIONS
  session = reduce(session, { type: 'KEEP_PREVIOUS' }, clock.now()); // REACTIONS -> MOTION
  session = reduce(
    session,
    { type: 'FREEZE_MOTION', scenario: aiAssistantScenario, confirmedConditionIds: [] },
    clock.now(),
  ); // MOTION -> VOTE (live: 임원표 비어 있고 roleStatus pending)
  return session;
}

function createStore(
  initial: Session,
  clock: FakeClock,
): OrchestratorStore & { dispatched: SessionAction[] } {
  let current = initial;
  const dispatched: SessionAction[] = [];
  return {
    dispatched,
    getSession: () => current,
    dispatch: (action: SessionAction) => {
      dispatched.push(action);
      current = reduce(current, action, clock.now());
    },
  };
}

function getScenario(id: string) {
  return id === aiAssistantScenario.id ? aiAssistantScenario : undefined;
}

function fakeAdapter(overrides: Partial<BoardAgentsAdapter>): BoardAgentsAdapter {
  const notImplemented = (): never => {
    throw new Error('이 테스트의 가짜 어댑터에는 구현이 없습니다.');
  };
  return {
    initialOpinions: overrides.initialOpinions ?? notImplemented,
    reactions: overrides.reactions ?? notImplemented,
    followUp: overrides.followUp ?? notImplemented,
    finalVotes: overrides.finalVotes ?? notImplemented,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function answeredStatement(roleId: (typeof EXEC_MEMBER_ORDER)[number]): Statement {
  return {
    id: `stub-${roleId}`,
    roleId,
    stage: 'OPINIONS',
    text: `${roleId}의 초기 의견입니다.`,
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'live',
    createdAt: 0,
  };
}

describe('runner.runRound', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('임원 4명이 모두 응답하면 발언을 반영하고 역할 상태를 모두 answered로 만든다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const adapter = fakeAdapter({
      initialOpinions: async () =>
        EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
          roleId,
          status: 'answered',
          statement: answeredStatement(roleId),
        })),
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    await orchestrator.runRound('OPINIONS');

    const session = store.getSession();
    expect(session.transcript.statements).toHaveLength(4);
    expect(session.transcript.revision).toBe(1);
    for (const roleId of EXEC_MEMBER_ORDER) {
      expect(session.roleStatus[roleId]).toBe('answered');
    }
  });

  it('SET_ROLE_STATUS dispatch는 pending·결과 두 시점 모두 stage를 싣는다(회의록 패널 roundLog, T41)', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const adapter = fakeAdapter({
      initialOpinions: async () =>
        EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => {
          if (roleId === 'CAIO') {
            return { roleId, status: 'failed', failReason: 'timeout' };
          }
          return { roleId, status: 'answered', statement: answeredStatement(roleId) };
        }),
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    await orchestrator.runRound('OPINIONS');

    const roleStatusActions = store.dispatched.filter(
      (action): action is Extract<SessionAction, { type: 'SET_ROLE_STATUS' }> =>
        action.type === 'SET_ROLE_STATUS',
    );
    // pending 4건(라운드 시작) + 결과 4건(응답 반영) = 8건, 모두 stage:'OPINIONS'를 싣는다.
    expect(roleStatusActions).toHaveLength(8);
    expect(roleStatusActions.every((action) => action.stage === 'OPINIONS')).toBe(true);
    const caioResult = roleStatusActions.find(
      (action) => action.roleId === 'CAIO' && action.status === 'failed',
    );
    expect(caioResult?.stage).toBe('OPINIONS');
  });

  it('1명만 실패로 응답하면 그 역할만 failed로 남고 나머지 3명 발언만 반영한다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const adapter = fakeAdapter({
      initialOpinions: async () =>
        EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => {
          if (roleId === 'CAIO') {
            return { roleId, status: 'failed', failReason: 'timeout' };
          }
          return { roleId, status: 'answered', statement: answeredStatement(roleId) };
        }),
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    await orchestrator.runRound('OPINIONS');

    const session = store.getSession();
    expect(session.transcript.statements).toHaveLength(3);
    expect(session.roleStatus.CAIO).toBe('failed');
    expect(session.roleStatus.CEO).toBe('answered');
    expect(session.roleStatus.CFO).toBe('answered');
    expect(session.roleStatus.CISO).toBe('answered');
  });

  it('세션 리셋 뒤 도착한 응답은 폐기하고 아무것도 반영하지 않는다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const pending = deferred<StatementOutcome[]>();
    const adapter = fakeAdapter({ initialOpinions: () => pending.promise });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    const roundPromise = orchestrator.runRound('OPINIONS');
    // 어댑터가 아직 응답하기 전에 운영자가 세션을 초기화한다.
    store.dispatch({ type: 'OPERATOR_RESET', nextSessionId: 'reset-in-test' });
    pending.resolve(
      EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
        roleId,
        status: 'answered',
        statement: answeredStatement(roleId),
      })),
    );
    await roundPromise;

    const session = store.getSession();
    expect(session.stage).toBe('ATTRACT');
    expect(session.transcript.statements).toHaveLength(0);
  });

  it('앞 라운드가 응답 전이면 다음 라운드는 그 뒤에 시작해 두 라운드 발언이 모두 남는다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const opinionsPending = deferred<StatementOutcome[]>();
    let reactionsCalls = 0;
    const adapter = fakeAdapter({
      initialOpinions: () => opinionsPending.promise,
      reactions: async () => {
        reactionsCalls += 1;
        return EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
          roleId,
          status: 'answered',
          statement: { ...answeredStatement(roleId), id: `re-${roleId}`, stage: 'REACTIONS' },
        }));
      },
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    const opinionsRound = orchestrator.runRound('OPINIONS');
    // 참가자가 OPINIONS 응답을 기다리지 않고 DISCUSS로 넘어가 의견을 낸다.
    store.dispatch({ type: 'NEXT_STAGE' });
    store.dispatch({
      type: 'SUBMIT_OPINION',
      originalText: '작은 범위로 먼저 시작합시다.',
      selectedPhraseIds: [],
      confirmedConditionIds: [],
    });
    const reactionsRound = orchestrator.runRound('REACTIONS');
    await Promise.resolve();
    // 앞 라운드가 끝나기 전에는 REACTIONS 어댑터를 부르지 않는다.
    expect(reactionsCalls).toBe(0);

    opinionsPending.resolve(
      EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
        roleId,
        status: 'answered',
        statement: answeredStatement(roleId),
      })),
    );
    await opinionsRound;
    await reactionsRound;

    const session = store.getSession();
    expect(reactionsCalls).toBe(1);
    expect(session.transcript.statements).toHaveLength(EXEC_MEMBER_ORDER.length * 2);
    expect(session.transcript.statements.filter((st) => st.stage === 'REACTIONS')).toHaveLength(
      EXEC_MEMBER_ORDER.length,
    );
  });

  it('라운드 진행 중 참가자가 표결까지 끝내 RESULT가 되면 늦은 응답을 버리고 대기 중인 라운드는 시작하지 않는다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock, 'scripted'), clock);
    const opinionsPending = deferred<StatementOutcome[]>();
    let reactionsCalls = 0;
    const adapter = fakeAdapter({
      initialOpinions: () => opinionsPending.promise,
      reactions: async () => {
        reactionsCalls += 1;
        return [];
      },
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    const opinionsRound = orchestrator.runRound('OPINIONS');
    const reactionsRound = orchestrator.runRound('REACTIONS');
    // 응답이 오기 전에 참가자가 표결까지 끝낸다(sessionId·revision은 그대로인 채 RESULT로
    // 간다 — scripted는 FREEZE_MOTION에서 임원표를 바로 채우므로 CONFIRM_VOTE로 즉시
    // 집계된다).
    store.dispatch({ type: 'NEXT_STAGE' }); // OPINIONS -> DISCUSS
    store.dispatch({
      type: 'SUBMIT_OPINION',
      originalText: '작은 범위로 먼저 시작합시다.',
      selectedPhraseIds: [],
      confirmedConditionIds: [],
    }); // DISCUSS -> REACTIONS
    store.dispatch({ type: 'KEEP_PREVIOUS' }); // REACTIONS -> MOTION
    store.dispatch({
      type: 'FREEZE_MOTION',
      scenario: aiAssistantScenario,
      confirmedConditionIds: [],
    }); // MOTION -> VOTE
    store.dispatch({ type: 'SELECT_VOTE', vote: 'YES' });
    store.dispatch({ type: 'CONFIRM_VOTE' }); // VOTE -> RESULT
    expect(store.getSession().stage).toBe('RESULT');

    opinionsPending.resolve(
      EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
        roleId,
        status: 'answered',
        statement: answeredStatement(roleId),
      })),
    );
    await opinionsRound;
    await reactionsRound;

    const session = store.getSession();
    expect(session.stage).toBe('RESULT');
    expect(session.transcript.statements).toHaveLength(0);
    expect(reactionsCalls).toBe(0);
  });

  it('runRound promise가 어댑터 응답 뒤에 settle된다(T46 후속 대기 게이트가 기대는 보장)', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const pending = deferred<StatementOutcome[]>();
    let settled = false;
    const adapter = fakeAdapter({ initialOpinions: () => pending.promise });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    const roundPromise = orchestrator.runRound('OPINIONS').then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    // 어댑터가 아직 응답하지 않았으면 promise도 settle되지 않는다.
    expect(settled).toBe(false);

    pending.resolve(
      EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
        roleId,
        status: 'answered',
        statement: answeredStatement(roleId),
      })),
    );
    await roundPromise;
    expect(settled).toBe(true);
  });

  it('scripted 어댑터는 지연 없이 즉시 발언을 반영한다', async () => {
    const clock = fakeClock(0);
    const store = createStore(toOpinionsStage(clock), clock);
    const orchestrator = createOrchestrator({
      adapter: createScriptedBoardAgentsAdapter(),
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    await orchestrator.runRound('OPINIONS');

    const session = store.getSession();
    expect(session.transcript.statements).toHaveLength(aiAssistantScenario.initialOpinions.length);
    expect(session.transcript.statements.every((s) => s.source === 'scripted')).toBe(true);
    expect(session.roleStatus.CEO).toBe('answered');
  });
});

describe('runner.startFinalVotes / awaitResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('4표가 8초 전에 모두 도착하면 기다리지 않고 바로 FINALIZE_RESULT를 반영한다', async () => {
    const clock = fakeClock(0);
    const session = toVoteStage(clock);
    const motion = session.finalMotion;
    if (!motion) throw new Error('테스트 전제: finalMotion이 있어야 합니다.');
    const store = createStore(session, clock);
    const adapter = fakeAdapter({
      finalVotes: async () =>
        EXEC_MEMBER_ORDER.map((roleId): BallotOutcome => ({
          roleId,
          status: 'answered',
          ballot: {
            memberId: roleId,
            motionId: motion.id,
            motionHash: motion.hash,
            vote: 'YES',
            confirmedAt: 0,
            source: 'live',
            reason: '자료를 검토했고 동의합니다.',
            remainingConcerns: [],
          },
        })),
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    void orchestrator.startFinalVotes();
    await orchestrator.awaitResult();

    const finalSession = store.getSession();
    expect(finalSession.stage).toBe('RESULT');
    const execBallots = finalSession.ballots.filter((b) => b.memberId !== 'PARTICIPANT');
    expect(execBallots).toHaveLength(4);
    expect(execBallots.every((b) => b.vote === 'YES')).toBe(true);
    expect(finalSession.outcome).toBe('PASS');
  });

  it('대기 중인 REACTIONS 라운드가 있으면 그 발언이 반영된 뒤에 최종표를 요청한다', async () => {
    const clock = fakeClock(0);
    let session = toOpinionsStage(clock);
    session = reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // OPINIONS -> DISCUSS
    session = reduce(
      session,
      {
        type: 'SUBMIT_OPINION',
        originalText: '검토했습니다. 작은 범위로 시작하는 데 동의합니다.',
        selectedPhraseIds: [],
        confirmedConditionIds: [],
      },
      clock.now(),
    ); // DISCUSS -> REACTIONS
    const store = createStore(session, clock);

    const reactionsPending = deferred<StatementOutcome[]>();
    const voteContexts: number[] = [];
    let motionRef: { id: string; hash: string } | null = null;
    const adapter = fakeAdapter({
      reactions: () => reactionsPending.promise,
      finalVotes: async (ctx) => {
        voteContexts.push(ctx.session.transcript.statements.length);
        return EXEC_MEMBER_ORDER.map((roleId): BallotOutcome => ({
          roleId,
          status: 'answered',
          ballot: {
            memberId: roleId,
            motionId: motionRef!.id,
            motionHash: motionRef!.hash,
            vote: 'YES',
            confirmedAt: 0,
            source: 'live',
            reason: '반응까지 읽고 동의합니다.',
            remainingConcerns: [],
          },
        }));
      },
    });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    const reactionsRound = orchestrator.runRound('REACTIONS');
    // 참가자는 임원 반응을 기다리지 않고 안건을 고정한다.
    store.dispatch({ type: 'KEEP_PREVIOUS' });
    store.dispatch({
      type: 'FREEZE_MOTION',
      scenario: aiAssistantScenario,
      confirmedConditionIds: [],
    });
    const frozen = store.getSession().finalMotion;
    if (!frozen) throw new Error('테스트 전제: finalMotion이 있어야 합니다.');
    motionRef = { id: frozen.id, hash: frozen.hash };

    const votes = orchestrator.startFinalVotes();
    await Promise.resolve();
    expect(voteContexts).toHaveLength(0); // 반응이 반영되기 전에는 표를 요청하지 않는다.

    reactionsPending.resolve(
      EXEC_MEMBER_ORDER.map((roleId): StatementOutcome => ({
        roleId,
        status: 'answered',
        statement: { ...answeredStatement(roleId), id: `re-${roleId}`, stage: 'REACTIONS' },
      })),
    );
    await reactionsRound;
    await votes;

    expect(voteContexts).toEqual([EXEC_MEMBER_ORDER.length]); // 표 요청의 회의 기록에 반응 4건이 들어 있다.
    const execBallots = store.getSession().ballots.filter((b) => b.memberId !== 'PARTICIPANT');
    expect(execBallots).toHaveLength(4);
  });

  it('임원 표가 도착하지 않으면 8초 뒤 UNCAST로 채워 FINALIZE_RESULT를 반영한다', async () => {
    const clock = fakeClock(0);
    const session = toVoteStage(clock);
    const store = createStore(session, clock);
    const neverResolves = deferred<BallotOutcome[]>();
    const adapter = fakeAdapter({ finalVotes: () => neverResolves.promise });
    const orchestrator = createOrchestrator({
      adapter,
      clock,
      requests: createRequestRegistry(),
      store,
      getScenario,
    });

    void orchestrator.startFinalVotes();
    const resultPromise = orchestrator.awaitResult();
    await vi.advanceTimersByTimeAsync(FINAL_VOTE_WAIT_MS);
    await resultPromise;

    const finalSession = store.getSession();
    expect(finalSession.stage).toBe('RESULT');
    const execBallots = finalSession.ballots.filter((b) => b.memberId !== 'PARTICIPANT');
    expect(execBallots).toHaveLength(4);
    expect(execBallots.every((b) => b.vote === 'UNCAST')).toBe(true);
  });
});
