// 임원 "…" 뜸 들이기 연결(T148). 화면(Opinions·Reactions)이 훅으로 함께 고민한 뒤 한 번에 공개하고, 아직 안 뜬 임원
// 자리를 이 문맥에 알리면 무대(StageBand)가 그 자리 말풍선을 "…"로 둔다. 자동 진행(AutoPlayHost)은
// busy가 풀린 뒤(마지막 발언이 뜬 뒤)에 시작한다. 규칙(시간)은 domain/thinking.ts에 있다.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { thinkingRevealTimes } from '../../domain/thinking';

export interface ThinkingState {
  /** 어느 단계 화면이 알렸는지('OPINIONS'|'REACTIONS'). */
  scope: string;
  /** 아직 발언이 뜨지 않은 자리 id(임원 id 또는 'FOLLOWUP'). */
  hidden: readonly string[];
}

interface ThinkingContextValue {
  state: ThinkingState | null;
  report: (state: ThinkingState | null) => void;
}

const ThinkingContext = createContext<ThinkingContextValue>({ state: null, report: () => {} });

export function ThinkingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThinkingState | null>(null);
  const value = useMemo(() => ({ state, report: setState }), [state]);
  return <ThinkingContext.Provider value={value}>{children}</ThinkingContext.Provider>;
}

/** 무대가 읽는다: 그 단계에서 아직 안 뜬 자리. */
export function useThinkingHidden(scope: string): readonly string[] {
  const { state } = useContext(ThinkingContext);
  return state && state.scope === scope ? state.hidden : NONE;
}

/** 자동 진행이 읽는다: 아직 뜰 발언이 남아 있다. */
export function useThinkingBusy(): boolean {
  const { state } = useContext(ThinkingContext);
  return state !== null && state.hidden.length > 0;
}

const NONE: readonly string[] = [];

export interface ThinkingReveal {
  /** 지금 발언이 떠 있는 자리 수(order 앞에서부터). */
  shownCount: number;
  /** 지금 "…" 중인 자리 id들(함께 고민하므로 아직 안 뜬 자리 전부). 다 떴으면 빈 배열. */
  thinkingIds: readonly string[];
  done: boolean;
}

/**
 * order의 자리 모두가 함께 "…"로 고민한 뒤 한 번에 공개한다. enabled가 false(지난 화면·reduced-motion·live)면 뜸 없이 모두 보인다.
 * key가 바뀌면 처음부터 다시 센다.
 */
export function useThinkingReveal(scope: string, order: readonly string[], enabled: boolean, key: string): ThinkingReveal {
  const total = order.length;
  const [shown, setShown] = useState<{ key: string; count: number }>({ key, count: enabled ? 0 : total });
  const { report } = useContext(ThinkingContext);

  useEffect(() => {
    if (!enabled) {
      setShown({ key, count: total });
      return;
    }
    setShown({ key, count: 0 });
    const timers = thinkingRevealTimes(total).map((at, index) =>
      window.setTimeout(() => setShown((prev) => ({ key, count: Math.max(prev.key === key ? prev.count : 0, index + 1) })), at),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [enabled, key, total]);

  // 키가 바뀐 첫 렌더에는 낡은 count를 믿지 않는다.
  const count = enabled ? (shown.key === key ? shown.count : 0) : total;
  const hiddenKey = order.slice(count).join(',');
  useLayoutEffect(() => {
    report({ scope, hidden: hiddenKey === '' ? [] : hiddenKey.split(',') });
  }, [scope, hiddenKey, report]);
  useLayoutEffect(() => () => report(null), [report]);

  return { shownCount: count, thinkingIds: order.slice(count), done: count >= total };
}
