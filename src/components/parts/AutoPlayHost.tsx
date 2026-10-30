// 자동 진행 연결부(T144). 세션·화면 상태로 domain/autoPlay.ts의 동작 목록을 고르고, 주입된 Clock으로
// 흐른 시간을 재어 지금 동작을 정한 뒤 화면(문맥)과 표시(AutoOverlay)에 알린다. 동작 중에는 화면
// 본문을 inert로 막는다(운영 메뉴는 헤더라 열려 있다). 규칙은 도메인에 있고 여기는 연결만 한다.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { scenarios } from '../../content/scenarios';
import { AUTO_CLICK_LABELS, AUTO_DISCUSS_STEP_LABELS, type AutoClickKey } from '../../content/autoPlay';
import type { Clock } from '../../domain/clock';
import {
  AUTO_LEAD_MS,
  assistantExplainPlan,
  autoPlan,
  autoProgress,
  motionAutoPlan,
  typedCaption,
  type AutoAction,
} from '../../domain/autoPlay';
import type { Session } from '../../domain/types';
import { collectConfirmedConditionIds } from '../opinionConditions';
import { AutoOverlay, type AutoStepItem } from './AutoOverlay';
import {
  AutoReportContext,
  AutoRunContext,
  INACTIVE_AUTO_RUN,
  type AutoAssistantEvent,
  type AutoReactionsStep,
  type AutoReporter,
  type AutoRunState,
  type AutoSide,
} from './autoRunContext';
import { useDialogOpen } from './useDialogOpen';

export interface AutoPlayHostProps {
  session: Session;
  /** 보기 모드(지난 화면)에서는 표시하지 않는다. */
  paused: boolean;
  clock: Clock;
  /** 참가자가 DISCUSS·REACTIONS에서 고른 입장(T145). */
  side?: AutoSide;
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
    case 'ADD_PHRASE':
      return { selector: `[data-testid="phrase-card-${action.targetId}"]`, nth: 0 };
    case 'OPEN_ASSISTANT':
      return { selector: '[data-testid="assistant-toggle"]', nth: 0 };
    case 'EXPLAIN_ASSISTANT':
      return { selector: `[data-testid="assistant-result-${action.targetId}"]`, nth: 0 };
    case 'PICK_FOLLOWUP':
      return { selector: `[data-testid="followup-option-${action.targetId}"]`, nth: 0 };
    default:
      return null;
  }
}

/** 비서실장에서 참가자가 지금까지 한 일(팝업이 알려 준다). */
interface AssistantFlags {
  opened: boolean;
  compare: boolean;
  refine: boolean;
  applied: boolean;
}
const NO_ASSISTANT_FLAGS: AssistantFlags = { opened: false, compare: false, refine: false, applied: false };

/** DISCUSS 진행 목록: 자동 동작 순번과 참가자가 한 일로 완료·지금·남음을 가른다. */
function discussSteps(plan: AutoAction[], index: number, done: boolean, flags: AssistantFlags): AutoStepItem[] {
  const phraseIdx = plan.flatMap((a, i) => (a.kind === 'ADD_PHRASE' ? [i] : []));
  const openIdx = plan.findIndex((a) => a.kind === 'OPEN_ASSISTANT');
  const phrases: AutoStepItem['state'] =
    phraseIdx.length === 0 ? 'done' : done || Math.max(...phraseIdx) < index ? 'done' : phraseIdx.includes(index) ? 'current' : 'todo';
  // 팝업은 동작이 시작되면 바로 열리므로(flags.opened) 이 동작이 진행 중인 동안은 '지금'으로 둔다.
  const open: AutoStepItem['state'] =
    !done && index === openIdx ? 'current' : flags.opened || done || index > openIdx ? 'done' : 'todo';
  const items: { id: string; label: string; state: AutoStepItem['state'] }[] = [
    { id: 'phrases', label: AUTO_DISCUSS_STEP_LABELS.phrases, state: phrases },
    { id: 'open', label: AUTO_DISCUSS_STEP_LABELS.open, state: open },
    { id: 'compare', label: AUTO_DISCUSS_STEP_LABELS.compare, state: flags.compare ? 'done' : 'todo' },
    { id: 'refine', label: AUTO_DISCUSS_STEP_LABELS.refine, state: flags.refine ? 'done' : 'todo' },
    { id: 'apply', label: AUTO_DISCUSS_STEP_LABELS.apply, state: flags.applied ? 'done' : 'todo' },
  ];
  // 자동 동작이 끝났으면 아직 안 한 첫 칸이 참가자가 누를 차례(지금).
  if (done) {
    const next = items.find((item) => item.state === 'todo');
    if (next) next.state = 'current';
  }
  return items;
}

/** 참가자 차례에 누를 버튼. 자동이 없는 단계·이미 눌린 뒤에는 null. */
function clickKeyFor(
  session: Session,
  side: AutoSide,
  flags: AssistantFlags,
  dialogOpen: boolean,
  reactionsStep: AutoReactionsStep,
): AutoClickKey | null {
  switch (session.stage) {
    case 'DISCUSS':
      if (side === null) return 'discuss-side';
      if (flags.applied) return 'discuss-submit';
      if (!dialogOpen) return flags.opened && !flags.compare && !flags.refine ? 'assistant-open' : 'discuss-submit';
      if (!flags.compare) return 'assistant-compare';
      if (!flags.refine) return 'assistant-refine';
      return 'assistant-apply';
    case 'REACTIONS':
      if (reactionsStep === 'listen') return 'reactions-advance';
      return side === null ? null : 'reactions-submit';
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

export function AutoPlayHost({ session, paused, clock, side = null, children }: AutoPlayHostProps) {
  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;
  const stage = session.stage;
  const enabled = session.autoPlay && !paused && scenario !== null;
  const confirmedKey = collectConfirmedConditionIds(session.opinions, scenario ?? scenarios[0]).join(',');
  // 반응 단계(1/2 듣기·2/2 답하기)는 화면이 알려 준다. 2/2에서만 추가 답변을 자동으로 고른다(T147).
  const [reactionsStep, setReactionsStep] = useState<AutoReactionsStep>('listen');
  const answerStep = stage === 'REACTIONS' && reactionsStep === 'answer';

  const plan = useMemo<AutoAction[]>(() => {
    if (!enabled || !scenario) return [];
    if (stage === 'BRIEFING' || stage === 'OPINIONS') return autoPlan(stage, scenario);
    if (stage === 'DISCUSS') return side === null ? [] : autoPlan(stage, scenario, side);
    if (stage === 'REACTIONS') return side === null || !answerStep ? [] : autoPlan(stage, scenario, side);
    if (stage === 'MOTION') return motionAutoPlan(scenario, confirmedKey === '' ? [] : confirmedKey.split(','));
    return [];
  }, [enabled, scenario, stage, confirmedKey, side, answerStep]);

  // 단계가 바뀌면 그 시각을 시작점으로 잡는다. 시작점이 낡은 동안(키 불일치)은 흐른 시간 0으로 본다.
  const runKey = `${session.sessionId}:${stage}:${stage === 'DISCUSS' || stage === 'REACTIONS' ? (side ?? '') : ''}:${answerStep ? 'answer' : ''}`;
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

  // 비서실장에서 참가자가 한 일(T147). 한 일이 처음 알려질 때 결과를 읽어 주는 자막(extra)을 이어 돌린다.
  const [flagState, setFlagState] = useState<{ key: string; flags: AssistantFlags }>({
    key: runKey,
    flags: NO_ASSISTANT_FLAGS,
  });
  const [extra, setExtra] = useState<{ key: string; plan: AutoAction[]; at: number } | null>(null);
  const flags = flagState.key === runKey ? flagState.flags : NO_ASSISTANT_FLAGS;
  const discussRun = enabled && stage === 'DISCUSS';
  const reporter = useMemo<AutoReporter>(
    () => ({
      assistant: (event: AutoAssistantEvent) => {
        if (!discussRun) return;
        setFlagState((previous) => {
          const base = previous.key === runKey ? previous.flags : NO_ASSISTANT_FLAGS;
          const key = event === 'OPENED' ? 'opened' : event === 'COMPARE' ? 'compare' : event === 'REFINE' ? 'refine' : 'applied';
          if (base[key]) return previous;
          return { key: runKey, flags: { ...base, [key]: true } };
        });
        if (event === 'COMPARE' || event === 'REFINE') {
          const feature = event === 'COMPARE' ? 'compare' : 'refine';
          setExtra((previous) =>
            previous?.key === runKey && previous.plan[0]?.targetId === feature
              ? previous
              : { key: runKey, plan: assistantExplainPlan(feature), at: clock.now() },
          );
        }
      },
      reactionsStep: setReactionsStep,
    }),
    [discussRun, runKey, clock],
  );

  const extraActive = extra !== null && extra.key === runKey ? extra : null;
  const activePlan = extraActive ? extraActive.plan : plan;
  const elapsed = extraActive
    ? Math.max(0, now - extraActive.at) + AUTO_LEAD_MS
    : start.key === runKey
      ? Math.max(0, now - start.at)
      : 0;
  const progress = autoProgress(activePlan, elapsed);
  const action = activePlan[progress.index] ?? null;
  const running = enabled && !progress.done;

  // 동작 중에는 화면 본문을 막는다. 헤더(운영 메뉴)는 이 안에 없다.
  useEffect(() => {
    if (!running) return;
    const live = document.querySelector('[data-live-screen]');
    live?.setAttribute('inert', '');
    // 팝업(비서실장)은 화면 본문 밖이라 inert가 닿지 않는다 — 동작 중 클릭만 막는다.
    document.body.setAttribute('data-auto-running', '');
    return () => {
      live?.removeAttribute('inert');
      document.body.removeAttribute('data-auto-running');
    };
  }, [running]);

  const dialogOpen = useDialogOpen();
  const clickKey = enabled && progress.done ? clickKeyFor(session, side, flags, dialogOpen, reactionsStep) : null;
  // 비서실장 팝업 안의 단계는 팝업이 열린 채로 누른다.
  const clickInDialog = clickKey !== null && (clickKey.startsWith('assistant-') && clickKey !== 'assistant-open');

  const value = useMemo<AutoRunState>(
    () => (enabled ? { enabled: true, running, done: progress.done, action } : INACTIVE_AUTO_RUN),
    [enabled, running, progress.done, action],
  );

  const target = action ? selectorFor(action) : null;
  const conditionIndex =
    action?.kind === 'HIGHLIGHT_CONDITION' ? plan.findIndex((item) => item === action) : 0;
  // DISCUSS 진행 목록은 자동 동작·설명 자막·참가자 차례 내내 보인다(side를 고른 뒤).
  const steps =
    enabled && stage === 'DISCUSS' && side !== null
      ? discussSteps(plan, extraActive ? plan.length : progress.index, extraActive ? true : progress.done, flags)
      : undefined;

  return (
    <AutoReportContext.Provider value={reporter}>
      <AutoRunContext.Provider value={value}>
        {children}
        {running && action && (
          <AutoOverlay
            mode="run"
            selector={target?.selector ?? null}
            nth={action.kind === 'HIGHLIGHT_CONDITION' && action.targetId !== '' ? conditionIndex : 0}
            caption={typedCaption(action.caption, progress.actionElapsedMs)}
            steps={steps}
          />
        )}
        {clickKey && (!dialogOpen || clickInDialog) && (
          <AutoOverlay
            mode="click"
            selector={clickSelector(clickKey)}
            clickLabel={AUTO_CLICK_LABELS[clickKey]}
            steps={steps}
          />
        )}
      </AutoRunContext.Provider>
    </AutoReportContext.Provider>
  );
}

/** CLICK 차례의 강조 대상. 비서실장 내용 안의 버튼은 팝업이 단 data-testid로 찾는다. */
function clickSelector(key: AutoClickKey): string {
  if (key === 'assistant-compare') return '[data-testid="assistant-action-compare"]';
  if (key === 'assistant-refine') return '[data-testid="assistant-action-refine"]';
  if (key === 'assistant-apply') return '[data-testid="assistant-apply-refine"]';
  return `[data-auto-click="${key}"]`;
}
