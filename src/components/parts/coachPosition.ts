// 코치 아이콘·말풍선을 끌어서 옮기는 자리 계산(T112). 옮긴 위치는 뷰포트 기준 비율(x, y)로
// sessionStorage('coach-pos')에 저장해 화면이 바뀌거나 말풍선↔아이콘이 바뀌어도 같은 자리에 둔다.
// 새 체험(sessionId 변경)이면 지우고 기본 자리(무대 사진 앵커)로 돌아간다.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export const COACH_POS_KEY = 'coach-pos';
export const DRAG_THRESHOLD = 4;
export const EDGE_MARGIN = 8;
export const NUDGE_STEP = 16;

export interface PosRatio {
  x: number;
  y: number;
}

export interface Point {
  left: number;
  top: number;
}

const listeners = new Set<() => void>();

export function loadCoachPos(): PosRatio | null {
  try {
    const raw = window.sessionStorage.getItem(COACH_POS_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PosRatio>;
    if (typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { x: value.x, y: value.y };
    }
  } catch {
    // 저장소를 못 읽으면 기본 자리를 쓴다.
  }
  return null;
}

function saveCoachPos(pos: PosRatio): void {
  try {
    window.sessionStorage.setItem(COACH_POS_KEY, JSON.stringify(pos));
  } catch {
    // 저장 실패는 무시한다(이번 화면에서만 옮겨진 채 남는다).
  }
}

/** 저장된 자리를 지우고, 떠 있는 아이콘·말풍선이 기본 자리로 돌아가게 알린다. */
export function clearCoachPos(): void {
  try {
    window.sessionStorage.removeItem(COACH_POS_KEY);
  } catch {
    // 무시.
  }
  listeners.forEach((listener) => listener());
}

/** 화면 안(여백 8px)에 들어오도록 자리를 조인다. 요소가 화면보다 크면 왼쪽 위 여백에 붙인다. */
export function clampPoint(point: Point, size: { width: number; height: number }, view: { width: number; height: number }): Point {
  const maxLeft = Math.max(EDGE_MARGIN, view.width - size.width - EDGE_MARGIN);
  const maxTop = Math.max(EDGE_MARGIN, view.height - size.height - EDGE_MARGIN);
  return {
    left: Math.min(Math.max(point.left, EDGE_MARGIN), maxLeft),
    top: Math.min(Math.max(point.top, EDGE_MARGIN), maxTop),
  };
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Point;
  moved: boolean;
}

export function useCoachPosition(defaultPoint: Point) {
  const ref = useRef<HTMLElement | null>(null);
  const [stored, setStored] = useState<PosRatio | null>(loadCoachPos);
  const [live, setLive] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const onResize = () => setView({ width: window.innerWidth, height: window.innerHeight });
    const onReset = () => {
      setStored(null);
      setLive(null);
    };
    window.addEventListener('resize', onResize);
    listeners.add(onReset);
    return () => {
      window.removeEventListener('resize', onResize);
      listeners.delete(onReset);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    // 렌더마다 크기를 다시 읽는다(같은 값이면 상태가 안 바뀌어 반복되지 않는다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  let point: Point = defaultPoint;
  if (live) point = clampPoint(live, size, view);
  else if (stored) point = clampPoint({ left: stored.x * view.width, top: stored.y * view.height }, size, view);

  const commit = useCallback(
    (next: Point) => {
      const clamped = clampPoint(next, size, view);
      const ratio = { x: clamped.left / view.width, y: clamped.top / view.height };
      saveCoachPos(ratio);
      setStored(ratio);
      setLive(null);
    },
    [size, view],
  );

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: point, moved: false };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // 캡처를 못 잡아도 창 안에서는 계속 따라온다.
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
    }
    setLive({ left: state.origin.left + dx, top: state.origin.top + dy });
  };

  const finish = (event: PointerEvent<HTMLElement>, save: boolean) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // 무시.
    }
    if (!state.moved) return; // 4px 미만: 그냥 클릭이다.
    setDragging(false);
    // 끌고 난 뒤 따라오는 click은 "열기"가 아니다.
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (save) commit({ left: state.origin.left + (event.clientX - state.startX), top: state.origin.top + (event.clientY - state.startY) });
    else setLive(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-NUDGE_STEP, 0],
      ArrowRight: [NUDGE_STEP, 0],
      ArrowUp: [0, -NUDGE_STEP],
      ArrowDown: [0, NUDGE_STEP],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    commit({ left: point.left + step[0], top: point.top + step[1] });
  };

  return {
    ref,
    point,
    dragging,
    /** 끌고 난 직후의 click이면 true(한 번 쓰면 자동으로 끝난다). */
    consumedByDrag: () => suppressClick.current,
    reset: clearCoachPos,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, false),
    },
    onKeyDown,
  };
}
