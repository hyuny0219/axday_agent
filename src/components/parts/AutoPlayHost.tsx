// 자동 진행 연결부(T144). 세션·화면 상태로 domain/autoPlay.ts의 동작 목록을 고르고, 주입된 Clock으로
// 흐른 시간을 재어 지금 동작을 정한 뒤 화면(문맥)과 표시(AutoOverlay)에 알린다. 동작 중에는 화면
// 본문을 inert로 막는다(운영 메뉴는 헤더라 열려 있다). 규칙은 도메인에 있고 여기는 연결만 한다.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { scenarios } from '../../content/scenarios';
import { AUTO_CLICK_LABELS, type AutoClickKey } from '../../content/autoPlay';
import type { Clock } from '../../domain/clock';
import { autoPlan, autoProgress, motionAutoPlan, typedCaption, type AutoAction } from '../../domain/autoPlay';
import type { Session } from '../../domain/types';
import { collectConfirmedConditionIds } from '../opinionConditions';
import { AutoOverlay } from './AutoOverlay';
import { AutoRunContext, INACTIVE_AUTO_RUN, type AutoRunState } from './autoRunContext';
import { useDialogOpen } from './useDialogOpen';

export interface AutoPlayHostProps {
  session: Session;
  /** 보기 모드(지난 화면)에서는 표시하지 않는다. */
  paused: boolean;
  clock: Clock;
  children: ReactNode;
}

const TICK_MS = 100;

function selectorFor(action: AutoAction): { selector: string; nth: number } | null {
  switch (action.kind) {
    case 'OPEN_EVIDENCE':
      return { selector: `[data-testid="evidence-card-${action.targetId}"]`, nth: 0 };
    case 'HIGHLIGHT_EXEC':
      return { selector: `[data-arrival-card="${action.targetId}"]`, nth: 0 };
    case 'HIGHLIGHT_CONDITION':
      return action.targetId === ''
        ? { selector: '[data-testid="motion-card"]', nth: 0 }
        : { selector: '[data-testid="motion-conditions"] li, [data-testid="motion-objections"] li', nth: 0 };
    default:
      return null;
  }
}

/** 참가자 차례에 누를 버튼. 자동이 없는 단계·이미 눌린 뒤에는 null. */
function clickKeyFor(session: Session): AutoClickKey | null {
  switch (session.stage) {
    case 'BRIEFING':
      return 'briefing-next';
    case 'OPINIONS':
      return 'opinions-next';
    case 'MOTION':
      return 'motion-freeze';
    case 'VOTE':
      if (session.ballots.some((ballot) => ballot.memberId === 'PARTICIPANT')) return null;
      return session.pendingVote === null ? 'vote-stamps' : 'vote-confirm';
    case 'RESULT':
      return 'result-finish';
    default:
      return null;
  }
}

export function AutoPlayHost({ session, paused, clock, children }: AutoPlayHostProps) {
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;
  const stage = session.stage;
  const enabled = session.autoPlay && !paused && scenario !== null;
  const confirmedKey = collectConfirmedConditionIds(session.opinions, scenario ?? scenarios[0]).join(',');

  const plan = useMemo<AutoAction[]>(() => {
    if (!enabled || !scenario) return [];
    if (stage === 'BRIEFING' || stage === 'OPINIONS') return autoPlan(stage, scenario);
    if (stage === 'MOTION') return motionAutoPlan(scenario, confirmedKey === '' ? [] : confirmedKey.split(','));
    return [];
  }, [enabled, scenario, stage, confirmedKey]);

  // 단계가 바뀌면 그 시각을 시작점으로 잡는다. 시작점이 낡은 동안(키 불일치)은 흐른 시간 0으로 본다.
  const runKey = `${session.sessionId}:${stage}`;
  const [start, setStart] = useState<{ key: string; at: number }>(() => ({ key: runKey, at: clock.now() }));
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    setStart({ key: runKey, at: clock.now() });
    setNow(clock.now());
  }, [runKey, clock]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(clock.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled, clock]);

  const elapsed = start.key === runKey ? Math.max(0, now - start.at) : 0;
  const progress = autoProgress(plan, elapsed);
  const action = plan[progress.index] ?? null;
  const running = enabled && !progress.done;

  // 동작 중에는 화면 본문을 막는다. 헤더(운영 메뉴)는 이 안에 없다.
  useEffect(() => {
    if (!running) return;
    const live = document.querySelector('[data-live-screen]');
    live?.setAttribute('inert', '');
    return () => live?.removeAttribute('inert');
  }, [running]);

  const dialogOpen = useDialogOpen();
  const clickKey = enabled && progress.done ? clickKeyFor(session) : null;

  const value = useMemo<AutoRunState>(
    () => (enabled ? { enabled: true, running, done: progress.done, action } : INACTIVE_AUTO_RUN),
    [enabled, running, progress.done, action],
  );

  const target = action ? selectorFor(action) : null;
  const conditionIndex =
    action?.kind === 'HIGHLIGHT_CONDITION' ? plan.findIndex((item) => item === action) : 0;

  return (
    <AutoRunContext.Provider value={value}>
      {children}
      {running && action && (
        <AutoOverlay
          mode="run"
          selector={target?.selector ?? null}
          nth={action.kind === 'HIGHLIGHT_CONDITION' && action.targetId !== '' ? conditionIndex : 0}
          caption={typedCaption(action.caption, progress.actionElapsedMs)}
        />
      )}
      {clickKey && !dialogOpen && (
        <AutoOverlay
          mode="click"
          selector={`[data-auto-click="${clickKey}"]`}
          clickLabel={AUTO_CLICK_LABELS[clickKey]}
        />
      )}
    </AutoRunContext.Provider>
  );
}
