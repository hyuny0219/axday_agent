// 앱 골격: SessionProvider(useReducer + systemClock + useTicker)와 stage별 화면 라우팅.
// 토론·투표·결과 화면은 T09·T10에서 채운다.

import { createContext, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { systemClock } from '../domain/clock';
import { createInitialSession, reduce } from '../domain/session';
import type { SessionAction } from '../domain/session';
import type { Session } from '../domain/types';
import { scenarios } from '../content/scenarios';
import { useTicker } from './useTicker';
import { Header } from '../components/parts/Header';
import { Nameplate } from '../components/parts/Nameplate';
import { AttractScreen } from '../components/screens/AttractScreen';
import { SelectScreen } from '../components/screens/SelectScreen';
import { BriefingScreen } from '../components/screens/BriefingScreen';
import { OpinionsScreen } from '../components/screens/OpinionsScreen';
import '../styles/screens/shell.css';

interface SessionContextValue {
  session: Session;
  dispatch: (action: SessionAction) => void;
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
 * useReducer + systemClock + useTicker로 세션을 관리하고 하위 트리에 제공한다.
 * 만료·무입력 판정 자체는 domain/clock.ts의 tick이 결정하며, 여기서는 그 결과 action을
 * session.ts가 이해하는 SessionAction으로 옮기기만 한다(EXPIRE에 scenario 채우기).
 */
function SessionProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(
    (state: Session, action: SessionAction) => reduce(state, action, systemClock.now()),
    undefined,
    () => createInitialSession(systemClock.now()),
  );

  useTicker({
    session,
    clock: systemClock,
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

  const value = useMemo<SessionContextValue>(() => ({ session, dispatch }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** stage별 화면 라우팅. DISCUSS 이후 화면은 T09·T10에서 채운다. */
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

    default:
      return (
        <section className="screen placeholder-screen">
          <p>다음 화면은 이후 작업에서 이어집니다. (단계: {session.stage})</p>
        </section>
      );
  }
}

function AppShell() {
  const { session } = useSession();
  return (
    <div className="app-shell">
      <Header stage={session.stage} />
      {session.stage !== 'ATTRACT' && <Nameplate />}
      <main className="app-main">
        <StageRouter />
      </main>
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
