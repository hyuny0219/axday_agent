// 앱 골격: SessionProvider(useReducer + appClock + useTicker)와 stage별 화면 라우팅.
// ATTRACT~RESULT의 아홉 화면 모두 여기서 StageRouter로 연결한다(T09·T10). T11에서
// 타이머 표시, 무입력 안내·복귀, 운영 메뉴, 활동 감지, 요청 레지스트리를 붙였다.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { touch } from '../domain/clock';
import { createInitialSession, reduce } from '../domain/session';
import type { SessionAction } from '../domain/session';
import type { Session } from '../domain/types';
import { scenarios } from '../content/scenarios';
import { useTicker } from './useTicker';
import { appClock } from './testClock';
import { createRequestRegistry } from './requests';
import { Header } from '../components/parts/Header';
import { IdleNotice } from '../components/parts/IdleNotice';
import { Nameplate } from '../components/parts/Nameplate';
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
 * 앱 전체 공유 레지스트리. 이 카드에서는 아직 실제 요청 발신자가 없다. */
const requestRegistry = createRequestRegistry();

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

  useTicker({
    session,
    clock: appClock,
    dispatch: (clockAction) => {
      if (clockAction === 'IDLE_RESET') {
        dispatch({ type: 'IDLE_RESET' });
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
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;

  switch (session.stage) {
    case 'ATTRACT':
      return <AttractScreen onStart={() => dispatch({ type: 'START' })} />;

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
      return <OpinionsScreen scenario={scenario} onNext={() => dispatch({ type: 'NEXT_STAGE' })} />;

    case 'DISCUSS':
      if (!scenario) {
        return null;
      }
      return (
        <DiscussScreen
          scenario={scenario}
          onSubmit={(payload) => dispatch({ type: 'SUBMIT_OPINION', ...payload })}
        />
      );

    case 'REACTIONS':
      if (!scenario) {
        return null;
      }
      return (
        <ReactionsScreen
          scenario={scenario}
          opinions={session.opinions}
          onSubmitFollowup={(payload) => dispatch({ type: 'SUBMIT_FOLLOWUP', ...payload })}
          onKeepPrevious={() => dispatch({ type: 'KEEP_PREVIOUS' })}
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
          onReset={() => dispatch({ type: 'IDLE_RESET' })}
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

function AppShell() {
  const { session, dispatch, touchActivity } = useSession();
  return (
    <div className="app-shell">
      <Header
        session={session}
        clock={appClock}
        onOperatorReset={() => dispatch({ type: 'OPERATOR_RESET' })}
      />
      {session.stage !== 'ATTRACT' && <Nameplate />}
      <main className="app-main">
        <StageRouter />
      </main>
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
