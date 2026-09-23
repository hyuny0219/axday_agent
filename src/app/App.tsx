// 앱 골격: SessionProvider(useReducer + appClock)와 stage별 화면 라우팅.
// ATTRACT~RESULT의 아홉 화면 모두 여기서 StageRouter로 연결한다(T09·T10). T11에서
// 운영 메뉴, 요청 레지스트리를 붙였다. T50(2026-09-22 사용자 결정)에서 240초 만료·
// 75/90초 무입력 복귀와 그에 딸린 타이머 표시·활동 감지를 모두 제거했다 — 세션을
// 끝내는 경로는 결과 화면의 "체험 종료"와 운영 메뉴의 "새 체험"·"scripted로 새
// 체험"(OPERATOR_RESET)뿐이다.
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
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createInitialSession, newSessionId, reduce } from '../domain/session';
import type { SessionAction } from '../domain/session';
import type { Session } from '../domain/types';
import { scenarios } from '../content/scenarios';
import type { Scenario } from '../content/types';
import { appClock } from './testClock';
import { createRequestRegistry } from './requests';
import { detectInitialMode } from './mode';
import { isFollowUpGateActive } from './followUpGate';
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
import { ProgressStrip } from '../components/parts/ProgressStrip';
import { StageBand } from '../components/parts/StageBand';
import { MinutesPanel } from '../components/parts/MinutesPanel';
import { buildMinutes, upsertRoundLogEntry } from '../components/minutes';
import type { RoundLogEntry } from '../components/minutes';
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

interface SessionContextValue {
  session: Session;
  dispatch: (action: SessionAction) => void;
  /** live에서 후속 답 제출 뒤 runRound('FOLLOWUP')이 settle되기 전인가(T46, DESIGN_SPEC.md
   * v1.0 7절 "후속 대기 게이트"). MOTION 화면이 "이 안건으로 표결" CTA를 잠그는 데 쓴다. */
  followUpPending: boolean;
  /** stage가 실린 SET_ROLE_STATUS dispatch만 (stage, roleId) 기준으로 쌓은 라운드별
   * 임원 응답 기록(v1.0 7절 "회의록 패널", T41). AppShell이 buildMinutes에 넘긴다.
   * 공개 payload에는 포함하지 않는다(화면 쪽 상태일 뿐이다). */
  roundLog: RoundLogEntry[];
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
 * useReducer + appClock으로 세션을 관리하고 하위 트리에 제공한다. 리셋 액션
 * (OPERATOR_RESET)에서는 requestRegistry.abortAll()도 함께 호출한다.
 */
function SessionProvider({ children }: { children: ReactNode }) {
  const [session, rawDispatch] = useReducer(
    (state: Session, action: SessionAction): Session => {
      const now = appClock.now();
      if (action.type === 'OPERATOR_RESET') {
        requestRegistry.abortAll();
      }
      return reduce(state, action, now);
    },
    undefined,
    () => createInitialSession(appClock.now()),
  );

  // 회의록 패널의 라운드별 기록(roundLog, v1.0 7절, T41). stage가 실린 SET_ROLE_STATUS만
  // 골라 (stage, roleId) 기준 upsert한다 — 이 dispatch 래퍼를 지나는 모든 호출(외부
  // dispatch prop과 orchestratorStore.dispatch 둘 다 같은 함수를 쓴다)이 대상이다.
  // reducer 분기는 건드리지 않는 순수 화면 쪽 부기라 useReducer가 아니라 useState로 둔다.
  const [roundLog, setRoundLog] = useState<RoundLogEntry[]>([]);

  const dispatch = useCallback((action: SessionAction) => {
    rawDispatch(action);
    if (action.type === 'SET_ROLE_STATUS' && action.stage) {
      const { stage, roleId, status } = action;
      setRoundLog((previous) => upsertRoundLogEntry(previous, { stage, roleId, status }));
    }
  }, []);

  // sessionId가 바뀌면(리셋 포함) 이전 세션의 라운드 기록을 지운다.
  useEffect(() => {
    setRoundLog([]);
  }, [session.sessionId]);

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

  // 후속 대기 게이트(T46, DESIGN_SPEC.md v1.0 7절): state로는 "이 세션의 FOLLOWUP promise가
  // settle됐는가"(settle된 sessionId)만 들고, 게이트 자체는 isFollowUpGateActive가 세션
  // 상태에서 동기적으로 계산한다 — SUBMIT_FOLLOWUP 직후 MOTION의 첫 프레임부터 CTA가
  // 잠긴다(effect가 세우는 boolean은 첫 프레임에 false라 빠른 클릭이 새어 나갔다, PR #7
  // Codex 1차 검토). 리셋으로 sessionId가 바뀌면 비교가 어긋나 자동으로 다시 잠기고,
  // 만료(RESULT)에서는 stage 조건으로 꺼진다. 벽시계 타이머는 쓰지 않는다.
  const [followUpSettledSessionId, setFollowUpSettledSessionId] = useState<string | null>(null);
  const followUpPending = isFollowUpGateActive(session, followUpSettledSessionId);

  const followUpRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (session.mode !== 'live' || session.stage !== 'MOTION' || session.opinions.length < 2) {
      return;
    }
    if (followUpRoundRef.current === session.sessionId) {
      return;
    }
    followUpRoundRef.current = session.sessionId;
    const triggeredSessionId = session.sessionId;
    // 성공·실패 모두 settle로 본다. 리셋 뒤 늦게 settle돼도 이전 sessionId를 기록할 뿐이라
    // 다음 세션의 게이트를 열지 않는다.
    void orchestrator.runRound('FOLLOWUP').finally(() => {
      setFollowUpSettledSessionId(triggeredSessionId);
    });
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

  // 참가자가 최종 표를 확정한 뒤에만 8초 대기를 시작한다(스펙 6장
  // "참가자 확정과 함께 기다리되 8초를 넘지 않는다").
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

  const value = useMemo<SessionContextValue>(
    () => ({ session, dispatch, followUpPending, roundLog }),
    [session, dispatch, followUpPending, roundLog],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** stage별 화면 라우팅. */
function StageRouter() {
  const { session, dispatch, followUpPending } = useSession();
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
          freezeDisabled={session.mode === 'live' && followUpPending}
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
          onReset={() => dispatch({ type: 'OPERATOR_RESET', nextSessionId: newSessionId() })}
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

/** 회의록 패널을 렌더하는 단계(v1.0 7절). DISCUSS·REACTIONS는 입력이 왼쪽 열을 이미
 * 채우고, RESULT는 기록 3패널이 같은 역할을 하므로 두지 않는다. */
const MINUTES_STAGES: ReadonlySet<Session['stage']> = new Set([
  'BRIEFING',
  'OPINIONS',
  'MOTION',
  'VOTE',
]);

/**
 * SELECT 이후(BRIEFING~RESULT) 모든 화면은 왼쪽 무대+행동 열과 오른쪽 회의 정보
 * 열로 이뤄진 조종석 배치다(DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙",
 * T45). ATTRACT·SELECT는 무대가 없어 여전히 1열이다. 도장(result-stamp)은 무대 열
 * 우하단에 겹쳐 찍으므로 StageBand에 resultStamp로 넘긴다(components/resultStamp.ts,
 * ResultScreen과 공유하는 순수 함수).
 */
function AppShell() {
  const { session, dispatch, roundLog } = useSession();
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;
  const hasStageBand = STAGE_BAND_STAGES.has(session.stage) && scenario !== null;
  const showMinutes = MINUTES_STAGES.has(session.stage) && scenario !== null;
  const resultStamp = session.stage === 'RESULT' ? computeResultStamp(session) : null;

  const content = <StageRouter />;

  return (
    <div className="app-shell">
      <Header
        session={session}
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
                resultStamp={resultStamp}
              />
            </div>
            {content}
            {showMinutes && scenario && (
              <div className="app-body__minutes">
                <MinutesPanel entries={buildMinutes(session, scenario, roundLog)} stage={session.stage} />
              </div>
            )}
          </div>
        </main>
      ) : (
        <>
          <main className="app-main">{content}</main>
        </>
      )}
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
