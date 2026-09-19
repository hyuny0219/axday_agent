// 앱 골격: SessionProvider(useReducer + appClock + useTicker)와 stage별 화면 라우팅.
// ATTRACT~RESULT의 아홉 화면 모두 여기서 StageRouter로 연결한다(T09·T10). T11에서
// 타이머 표시, 무입력 안내·복귀, 운영 메뉴, 활동 감지, 요청 레지스트리를 붙였다.
// T12에서 DISCUSS·REACTIONS에 sessionId와 RECORD_ASSISTANT_ACTION dispatch를 얇게
// 연결해 AssistantPanel(src/components/parts)이 쓰도록 했다(AI 비서실장 사용 기록).
// T30에서 live/scripted 모드 감지(mode.ts)와 orchestrator(runRound/startFinalVotes/
// awaitResult)를 세션 단계 전환에 연결했다. 트리거는 dispatch 직후가 아니라 그 결과로
// 세션이 실제로 바뀐 뒤(useEffect)에 호출한다 — orchestrator가 store.getSession()으로
// 읽는 값이 dispatch 이전의 stale 값이 되지 않게 하기 위해서다(예: FREEZE_MOTION 직후
// startFinalVotes는 finalMotion이 실제로 채워진 뒤에만 불러야 한다).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { touch } from '../domain/clock';
import { createInitialSession, newSessionId, reduce } from '../domain/session';
import type { SessionAction } from '../domain/session';
import type { Session } from '../domain/types';
import { scenarios } from '../content/scenarios';
import type { Scenario } from '../content/types';
import { useTicker } from './useTicker';
import { appClock } from './testClock';
import { createRequestRegistry } from './requests';
import { detectInitialMode } from './mode';
import {
  createOrchestrator,
  type Orchestrator,
  type OrchestratorStore,
} from '../services/orchestrator/runner';
import { liveBoardAgentsAdapter } from '../services/boardAgents/live';
import { scriptedBoardAgentsAdapter } from '../services/boardAgents/scripted';
import type { BoardAgentsAdapter } from '../services/boardAgents/types';
import { liveAssistantAdapter } from '../services/assistant/live';
import { scriptedAssistantAdapter } from '../services/assistant/scripted';
import type { AssistantAdapter } from '../services/assistant/types';
import { Header } from '../components/parts/Header';
import { IdleNotice } from '../components/parts/IdleNotice';
import { Nameplate } from '../components/parts/Nameplate';
import { ProgressStrip } from '../components/parts/ProgressStrip';
import { StageBand } from '../components/parts/StageBand';
import { computeResultStamp } from '../components/resultStamp';
import { AttractScreen } from '../components/screens/AttractScreen';
import { SelectScreen } from '../components/screens/SelectScreen';
import { BriefingScreen } from '../components/screens/BriefingScreen';
import { OpinionsScreen } from '../components/screens/OpinionsScreen';
import { DiscussScreen } from '../components/screens/DiscussScreen';
import { ReactionsScreen } from '../components/screens/ReactionsScreen';
import { MotionScreen } from '../components/screens/MotionScreen';
import { VoteScreen } from '../components/screens/VoteScreen';
import { ResultScreen } from '../components/screens/ResultScreen';
import '../styles/screens/shell.css';

/** 리셋 시 진행 중인 비동기 요청(AI 비서실장 등, T12)을 모두 abort하기 위한
 * 앱 전체 공유 레지스트리. */
const requestRegistry = createRequestRegistry();

/** orchestrator가 요구하는 scenarioId -> Scenario 조회. 못 찾으면 라운드/표결을
 * 조용히 건너뛴다(runner.ts의 책임, 정상 흐름에서는 일어나지 않는다). */
function getScenarioById(scenarioId: string): Scenario | undefined {
  return scenarios.find((item) => item.id === scenarioId);
}

/** 세션 상태 전이용 액션에 순수 UI 활동(TOUCH)을 더한 내부 전용 액션. TOUCH는
 * lastActivityAt만 갱신하며 session.ts의 reduce로 넘기지 않는다(deadline 불변). */
type InternalAction = SessionAction | { type: 'TOUCH' };

interface SessionContextValue {
  session: Session;
  dispatch: (action: SessionAction) => void;
  touchActivity: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** 하위 화면에서 세션 상태와 dispatch를 읽기 위한 훅. Provider 밖에서 부르면 오류를 던진다. */
function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession은 SessionProvider 내부에서만 사용할 수 있습니다.');
  }
  return value;
}

/**
 * useReducer + appClock + useTicker로 세션을 관리하고 하위 트리에 제공한다.
 * 만료·무입력 판정 자체는 domain/clock.ts의 tick이 결정하며, 여기서는 그 결과 action을
 * session.ts가 이해하는 SessionAction으로 옮기기만 한다(EXPIRE에 scenario 채우기).
 * 리셋 액션(IDLE_RESET·OPERATOR_RESET)에서는 requestRegistry.abortAll()도 함께 호출한다.
 */
function SessionProvider({ children }: { children: ReactNode }) {
  const [session, rawDispatch] = useReducer(
    (state: Session, action: InternalAction): Session => {
      const now = appClock.now();
      if (action.type === 'TOUCH') {
        return touch(state, now);
      }
      if (action.type === 'IDLE_RESET' || action.type === 'OPERATOR_RESET') {
        requestRegistry.abortAll();
      }
      return reduce(state, action, now);
    },
    undefined,
    () => createInitialSession(appClock.now()),
  );

  const dispatch = useCallback((action: SessionAction) => rawDispatch(action), []);
  const touchActivity = useCallback(() => rawDispatch({ type: 'TOUCH' }), []);

  // orchestrator(services/orchestrator/runner.ts)가 비동기 호출 중간에도 항상 최신
  // 세션을 읽을 수 있게 한다 — 클로저로 session을 캡처하면 dispatch 직후에는 stale하다.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  const orchestratorStore = useMemo<OrchestratorStore>(
    () => ({
      getSession: () => sessionRef.current,
      dispatch: (action) => dispatch(action),
    }),
    [dispatch],
  );

  // live/scripted 두 어댑터 모두 세션 시작 전 고정된 session.mode를 그대로 따른다(스펙
  // 6장 "세션 시작 전에 live/scripted 모드를 고정"). orchestrator 자체는 한 번만 만들고,
  // 실제 호출 시점의 sessionRef.current.mode로 어느 어댑터를 쓸지 매번 고른다.
  const dynamicAdapter = useMemo<BoardAgentsAdapter>(() => {
    function currentAdapter(): BoardAgentsAdapter {
      return sessionRef.current.mode === 'live'
        ? liveBoardAgentsAdapter
        : scriptedBoardAgentsAdapter;
    }
    return {
      initialOpinions: (ctx) => currentAdapter().initialOpinions(ctx),
      reactions: (ctx) => currentAdapter().reactions(ctx),
      followUp: (ctx) => currentAdapter().followUp(ctx),
      finalVotes: (ctx) => currentAdapter().finalVotes(ctx),
    };
  }, []);

  const orchestrator: Orchestrator = useMemo(
    () =>
      createOrchestrator({
        adapter: dynamicAdapter,
        clock: appClock,
        requests: requestRegistry,
        store: orchestratorStore,
        getScenario: getScenarioById,
      }),
    [dynamicAdapter, orchestratorStore],
  );

  // 세션 시작 전(ATTRACT·SELECT)에 한 번만 서버 가용성을 확인해 모드를 고정한다
  // (mode.ts, AGENT_BOARDROOM_SPEC.md 6장). SET_MODE는 ATTRACT·SELECT 단계에서만
  // 반영되므로 이미 세션이 시작된 뒤 응답이 와도 reducer가 조용히 무시한다.
  useEffect(() => {
    let cancelled = false;
    detectInitialMode().then((action) => {
      if (!cancelled) {
        dispatch(action);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // live 모드에서만 라운드를 자동으로 돌린다: OPINIONS 진입 시 초기 의견, 참가자 의견
  // 전달 후 REACTIONS, 후속 보완 제출 후 FOLLOWUP(최대 1회 — opinions가 2건이 되는
  // 경우만 트리거한다. '이 의견으로 마무리'는 새 의견을 만들지 않으므로 돌지 않는다).
  // 각 ref는 세션당 한 번만 실행되도록 막는 가드다.
  const opinionsRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || session.stage !== 'OPINIONS') {
      return;
    }
    if (opinionsRoundRef.current === session.sessionId) {
      return;
    }
    opinionsRoundRef.current = session.sessionId;
    void orchestrator.runRound('OPINIONS');
  }, [session.mode, session.stage, session.sessionId, orchestrator]);

  const reactionsRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || session.stage !== 'REACTIONS') {
      return;
    }
    if (reactionsRoundRef.current === session.sessionId) {
      return;
    }
    reactionsRoundRef.current = session.sessionId;
    void orchestrator.runRound('REACTIONS');
  }, [session.mode, session.stage, session.sessionId, orchestrator]);

  const followUpRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || session.stage !== 'MOTION' || session.opinions.length < 2) {
      return;
    }
    if (followUpRoundRef.current === session.sessionId) {
      return;
    }
    followUpRoundRef.current = session.sessionId;
    void orchestrator.runRound('FOLLOWUP');
  }, [session.mode, session.stage, session.opinions.length, session.sessionId, orchestrator]);

  // 최종안이 고정되는 즉시(finalMotion이 채워지는 즉시) 임원 최종표를 병렬로 요청한다
  // (스펙 6장 "최종안 고정 후 바로 병렬 요청"). MOTION 화면의 표결 버튼은 FREEZE_MOTION만
  // dispatch하며, 이 효과가 그 결과(finalMotion 반영)를 보고 startFinalVotes를 잇는다.
  const finalVotesRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || !session.finalMotion) {
      return;
    }
    if (finalVotesRef.current === session.finalMotion.hash) {
      return;
    }
    finalVotesRef.current = session.finalMotion.hash;
    void orchestrator.startFinalVotes();
  }, [session.mode, session.finalMotion, orchestrator]);

  // 참가자가 최종 표를 확정한 뒤에만 8초(또는 남은 시간) 대기를 시작한다(스펙 6장
  // "참가자 확정과 함께 기다리되 8초 또는 deadline을 넘지 않는다").
  const awaitResultRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || session.stage !== 'VOTE' || !session.finalMotion) {
      return;
    }
    const participantVoted = session.ballots.some((ballot) => ballot.memberId === 'PARTICIPANT');
    if (!participantVoted) {
      return;
    }
    if (awaitResultRef.current === session.finalMotion.hash) {
      return;
    }
    awaitResultRef.current = session.finalMotion.hash;
    void orchestrator.awaitResult();
  }, [session.mode, session.stage, session.finalMotion, session.ballots, orchestrator]);

  useTicker({
    session,
    clock: appClock,
    dispatch: (clockAction) => {
      if (clockAction === 'IDLE_RESET') {
        dispatch({ type: 'IDLE_RESET', nextSessionId: newSessionId() });
        return;
      }
      const scenario = scenarios.find((item) => item.id === session.scenarioId);
      if (!scenario) {
        return;
      }
      dispatch({ type: 'EXPIRE', scenario });
    },
  });

  // 클릭·키 입력·실제 스크롤(wheel/scroll)만 활동으로 센다. 커서 이동(mousemove)은
  // 제외한다(CLAUDE_IMPLEMENTATION.md 3장 "현장 운영").
  useEffect(() => {
    function handleActivity() {
      touchActivity();
    }
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true, capture: true });
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('scroll', handleActivity, true);
    };
  }, [touchActivity]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, dispatch, touchActivity }),
    [session, dispatch, touchActivity],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** stage별 화면 라우팅. */
function StageRouter() {
  const { session, dispatch } = useSession();
  // AssistantPanel(AI 비서실장)도 board 라운드와 같은 원칙으로 live/scripted를 고른다:
  // 세션 시작 전 고정된 session.mode를 그대로 따른다(T31). orchestrator의 dynamicAdapter와
  // 달리 여기는 매 렌더에서 session.mode를 직접 읽을 수 있어 ref 트릭이 필요 없다.
  const assistantAdapter: AssistantAdapter =
    session.mode === 'live' ? liveAssistantAdapter : scriptedAssistantAdapter;
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;

  switch (session.stage) {
    case 'ATTRACT':
      return <AttractScreen mode={session.mode} onStart={() => dispatch({ type: 'START' })} />;

    case 'SELECT':
      return (
        <SelectScreen
          scenarios={scenarios}
          onEnter={(scenarioId) => dispatch({ type: 'SELECT_SCENARIO', scenarioId })}
        />
      );

    case 'BRIEFING':
      if (!scenario) {
        return null;
      }
      return (
        <BriefingScreen
          scenario={scenario}
          onSummaryShown={() => dispatch({ type: 'MARK_SUMMARY_SHOWN' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        />
      );

    case 'OPINIONS':
      if (!scenario) {
        return null;
      }
      return (
        <OpinionsScreen
          scenario={scenario}
          mode={session.mode}
          roleStatus={session.roleStatus}
          statements={session.transcript.statements}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        />
      );

    case 'DISCUSS':
      if (!scenario) {
        return null;
      }
      return (
        <DiscussScreen
          scenario={scenario}
          sessionId={session.sessionId}
          transcript={session.transcript}
          onSubmit={(payload) => dispatch({ type: 'SUBMIT_OPINION', ...payload })}
          onAssistantAction={(entry) => dispatch({ type: 'RECORD_ASSISTANT_ACTION', entry })}
          assistantAdapter={assistantAdapter}
        />
      );

    case 'REACTIONS':
      if (!scenario) {
        return null;
      }
      return (
        <ReactionsScreen
          scenario={scenario}
          sessionId={session.sessionId}
          opinions={session.opinions}
          mode={session.mode}
          roleStatus={session.roleStatus}
          statements={session.transcript.statements}
          transcriptRevision={session.transcript.revision}
          onSubmitFollowup={(payload) => dispatch({ type: 'SUBMIT_FOLLOWUP', ...payload })}
          onKeepPrevious={() => dispatch({ type: 'KEEP_PREVIOUS' })}
          onAssistantAction={(entry) => dispatch({ type: 'RECORD_ASSISTANT_ACTION', entry })}
          assistantAdapter={assistantAdapter}
        />
      );

    case 'MOTION':
      if (!scenario) {
        return null;
      }
      return (
        <MotionScreen
          scenario={scenario}
          opinions={session.opinions}
          onFreeze={(confirmedConditionIds) =>
            dispatch({ type: 'FREEZE_MOTION', scenario, confirmedConditionIds })
          }
        />
      );

    case 'VOTE':
      if (!scenario || !session.finalMotion) {
        return null;
      }
      return (
        <VoteScreen
          scenario={scenario}
          motion={session.finalMotion}
          pendingVote={session.pendingVote}
          mode={session.mode}
          execBallotsPending={session.execBallotsPending}
          onSelectVote={(vote) => dispatch({ type: 'SELECT_VOTE', vote })}
          onConfirmVote={() => dispatch({ type: 'CONFIRM_VOTE' })}
        />
      );

    case 'RESULT':
      if (!scenario) {
        return null;
      }
      return (
        <ResultScreen
          scenario={scenario}
          session={session}
          onReset={() => dispatch({ type: 'IDLE_RESET', nextSessionId: newSessionId() })}
        />
      );

    default:
      return (
        <section className="screen placeholder-screen">
          <p>다음 화면은 이후 작업에서 이어집니다. (단계: {session.stage})</p>
        </section>
      );
  }
}

/** BRIEFING·MOTION 단계에서 무대 띠 의장(CEO) 말풍선에 쓸 원문(v1.0 1절). 다른
 * 단계에서는 undefined를 돌려주고 StageBand가 그 단계 규칙대로 다른 문구를 고른다. */
function chairLineFor(stage: Session['stage'], scenario: Scenario | null): string | undefined {
  if (stage === 'BRIEFING') {
    return scenario?.chairBriefing.situation;
  }
  if (stage === 'MOTION') {
    return '이 조건으로 안건을 고정합니다';
  }
  return undefined;
}

const STAGE_BAND_STAGES: ReadonlySet<Session['stage']> = new Set([
  'BRIEFING',
  'OPINIONS',
  'DISCUSS',
  'REACTIONS',
  'MOTION',
  'VOTE',
  'RESULT',
]);

/**
 * SELECT 이후(BRIEFING~RESULT) 모든 화면은 왼쪽 무대+행동 열과 오른쪽 회의 정보
 * 열로 이뤄진 조종석 배치다(DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙",
 * T45). ATTRACT·SELECT는 무대가 없어 여전히 1열이다. 도장(result-stamp)은 무대 열
 * 우하단에 겹쳐 찍으므로 StageBand에 resultStamp로 넘긴다(components/resultStamp.ts,
 * ResultScreen과 공유하는 순수 함수).
 */
function AppShell() {
  const { session, dispatch, touchActivity } = useSession();
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;
  const hasStageBand = STAGE_BAND_STAGES.has(session.stage) && scenario !== null;
  const resultStamp = session.stage === 'RESULT' ? computeResultStamp(session) : null;

  const content = <StageRouter />;

  return (
    <div className="app-shell">
      <Header
        session={session}
        clock={appClock}
        onOperatorReset={() => dispatch({ type: 'OPERATOR_RESET', nextSessionId: newSessionId() })}
      />
      {session.stage !== 'ATTRACT' && session.stage !== 'SELECT' && (
        <ProgressStrip stage={session.stage} />
      )}
      {hasStageBand && scenario ? (
        // 조종석 배치(v1.0 6절, T45): .app-body는 3개 grid area(무대·왼쪽 아래 행동·
        // 오른쪽 정보)를 가진 단일 grid다. StageRouter가 렌더하는 개별 Screen
        // 컴포넌트는 각각 .app-body__actions·.app-body__content 두 wrapper div를
        // Fragment로 돌려주고(renderSplit 규칙), React Fragment는 DOM에 별도
        // wrapper를 만들지 않으므로 이 두 div는 여기 .app-body의 직계 grid item이
        // 된다 — StageBand와 정확히 같은 부모 아래에서 grid-area로 배치된다.
        <main className="app-main app-main--stage">
          <div className="app-body">
            <div className="app-body__stage">
              <StageBand
                stage={session.stage}
                mode={session.mode}
                roleStatus={session.roleStatus}
                statements={session.transcript.statements}
                opinions={session.opinions}
                scenario={scenario}
                ballots={session.stage === 'RESULT' ? session.ballots : undefined}
                chairLine={chairLineFor(session.stage, scenario)}
                deadline={session.deadline}
                clock={appClock}
                resultStamp={resultStamp}
              />
              <Nameplate className="nameplate--stage" />
            </div>
            {content}
          </div>
        </main>
      ) : (
        <>
          {session.stage !== 'ATTRACT' && <Nameplate />}
          <main className="app-main">{content}</main>
        </>
      )}
      <IdleNotice session={session} clock={appClock} onContinue={touchActivity} />
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
