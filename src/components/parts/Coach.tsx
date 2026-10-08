// 진행 도우미 말풍선 + 스포트라이트(T103, 게임 튜토리얼식 코치 A안). 대상 요소의
// getBoundingClientRect()를 읽어 그 둘레만 밝히고 나머지를 어둡게 덮는다. 구멍 안은
// 막지 않아(어두운 4개 패널로 둘러쌈) 대상을 그대로 누를 수 있다. 문서 body로 portal해
// 화면 맞춤 축소(transform) 조상의 영향을 받지 않는다. 어느 단계를 보여 줄지는 도메인
// (domain/coach.ts)이 정하고, 이 컴포넌트는 그리기만 한다.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COACH_SKIP_LABEL } from '../../content/coach';
import type { CoachPlacement } from '../../content/coach';
import '../../styles/screens/coach.css';

export interface CoachProps {
  step: number;
  total: number;
  /** 스포트라이트 대상. 요소 ref 또는 CSS 선택자. */
  targetRef?: React.RefObject<Element | null>;
  targetSelector?: string;
  title: ReactNode;
  body: ReactNode;
  placement: CoachPlacement;
  /** 있으면 "알겠어요 ▶" 버튼을 그린다(읽기 단계). */
  onAck?: () => void;
  ackLabel?: string;
  onSkip: () => void;
  /** 팝업 안에서 보여 주는 경우 true(어둡기 0.6, 팝업보다 위). */
  dim?: boolean;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 코치가 떠 있어도 누를 수 있어야 하는 요소(운영자가 안내를 끄는 통로). */
const EXEMPT_SELECTORS = ['.operator-menu__trigger', '.operator-menu__panel'];

const SPOT_PAD = 4;
const GAP = 18;
const MARGIN = 12;

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === null || b === null) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function readBox(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 대상 둘레 박스를 읽는다. 선택자에 맞는 요소가 여럿이면 화면에 보이는 첫 것을 쓴다. */
function resolveTarget(
  targetRef: CoachProps['targetRef'],
  targetSelector: string | undefined,
): Element | null {
  if (targetRef?.current) return targetRef.current;
  if (!targetSelector) return null;
  const all = Array.from(document.querySelectorAll(targetSelector));
  return all.find((el) => readBox(el) !== null) ?? null;
}

interface Placed {
  left: number;
  top: number;
  side: CoachPlacement;
  tail: number;
}

const OPPOSITE: Record<CoachPlacement, CoachPlacement> = {
  right: 'left',
  left: 'right',
  below: 'above',
  above: 'below',
};

/** 말풍선을 놓을 자리. 원하는 방향에 들어가지 않으면 반대편·나머지 방향을 차례로 본다. */
export function placeBubble(
  spot: Box,
  size: { width: number; height: number },
  preferred: CoachPlacement,
  viewport: { width: number; height: number },
): Placed {
  const order: CoachPlacement[] = [
    preferred,
    OPPOSITE[preferred],
    ...(['below', 'above', 'right', 'left'] as CoachPlacement[]).filter(
      (p) => p !== preferred && p !== OPPOSITE[preferred],
    ),
  ];
  const fits = (p: CoachPlacement): boolean => {
    switch (p) {
      case 'right':
        return spot.left + spot.width + GAP + size.width <= viewport.width - MARGIN;
      case 'left':
        return spot.left - GAP - size.width >= MARGIN;
      case 'below':
        return spot.top + spot.height + GAP + size.height <= viewport.height - MARGIN;
      case 'above':
        return spot.top - GAP - size.height >= MARGIN;
    }
  };
  const chosen = order.find(fits) ?? preferred;
  const cx = spot.left + spot.width / 2;
  const cy = spot.top + spot.height / 2;
  let left: number;
  let top: number;
  if (chosen === 'right') {
    left = spot.left + spot.width + GAP;
    top = cy - size.height / 2;
  } else if (chosen === 'left') {
    left = spot.left - GAP - size.width;
    top = cy - size.height / 2;
  } else if (chosen === 'below') {
    left = cx - size.width / 2;
    top = spot.top + spot.height + GAP;
  } else {
    left = cx - size.width / 2;
    top = spot.top - GAP - size.height;
  }
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, viewport.width - MARGIN - size.width));
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, viewport.height - MARGIN - size.height));
  // 아무 방향에도 못 들어가면(큰 대상) 대상과 겹치더라도 화면 안에 둔다. 꼬리는 그때도 대상 쪽.
  const horizontal = chosen === 'right' || chosen === 'left';
  const tail = horizontal
    ? Math.min(Math.max(cy - top, 24), size.height - 24)
    : Math.min(Math.max(cx - left, 24), size.width - 24);
  return { left, top, side: chosen, tail };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function Coach({
  step,
  total,
  targetRef,
  targetSelector,
  title,
  body,
  placement,
  onAck,
  ackLabel = '알겠어요 ▶',
  onSkip,
  dim = false,
}: CoachProps) {
  const [box, setBox] = useState<Box | null>(null);
  const [exempt, setExempt] = useState<Box[]>([]);
  const [view, setView] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [size, setSize] = useState({ width: 360, height: 160 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  // 대상 위치 추적: 화면 배치가 바뀌는 어떤 이유(크기 조절, 스크롤, 글자 줄바꿈, 늦게 나타나는
  // 요소)에도 따라가도록 프레임마다 읽고, 값이 달라졌을 때만 상태를 바꾼다.
  const measure = useCallback(() => {
    const next = readBox(resolveTarget(targetRef, targetSelector));
    setBox((prev) => (sameBox(prev, next) ? prev : next));
    // 운영 메뉴(운영 버튼과 열린 메뉴)는 항상 눌러 볼 수 있게 어둡게 덮지 않는다.
    const extra = EXEMPT_SELECTORS.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((el) => readBox(el)),
    ).filter((item): item is Box => item !== null);
    setExempt((prev) =>
      prev.length === extra.length && prev.every((item, index) => sameBox(item, extra[index] ?? null))
        ? prev
        : extra,
    );
    setView((prev) =>
      prev.width === window.innerWidth && prev.height === window.innerHeight
        ? prev
        : { width: window.innerWidth, height: window.innerHeight },
    );
  }, [targetRef, targetSelector]);

  useEffect(() => {
    measure();
    let frame = 0;
    let timer = 0;
    const hasRaf = typeof window.requestAnimationFrame === 'function';
    const tick = () => {
      measure();
      if (hasRaf) frame = window.requestAnimationFrame(tick);
      else timer = window.setTimeout(tick, 100);
    };
    if (hasRaf) frame = window.requestAnimationFrame(tick);
    else timer = window.setTimeout(tick, 100);
    return () => {
      if (hasRaf) window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [measure]);

  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
  });

  // Esc는 건너뛰기. 팝업(DialogShell)의 Esc 닫기보다 먼저 받아 그쪽으로 넘기지 않는다.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onSkip();
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onSkip]);

  // 포커스는 말풍선으로 옮기고, 끝나면 원래 있던 곳으로 돌려준다. 팝업 안에서는 팝업이
  // 정한 포커스를 빼앗지 않는다.
  useEffect(() => {
    if (dim) return;
    const previous = document.activeElement as HTMLElement | null;
    bubbleRef.current?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (
        previous &&
        previous.isConnected &&
        (active === document.body || active === null || bubbleRef.current?.contains(active) || active === bubbleRef.current)
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [step, dim]);

  if (!box) {
    return null;
  }

  const spot: Box = {
    left: box.left - SPOT_PAD,
    top: box.top - SPOT_PAD,
    width: box.width + SPOT_PAD * 2,
    height: box.height + SPOT_PAD * 2,
  };
  const placed = placeBubble(spot, size, placement, view);
  // 어두운 덮개는 한 장이고, 대상(과 운영 메뉴) 자리는 clip-path로 구멍을 뚫어 비운다.
  // clip-path 밖은 클릭도 통과하므로 구멍 안의 대상은 그대로 누를 수 있다.
  const holes = [spot, ...exempt.map((item) => ({ ...item }))];
  const clipPath = `path(evenodd, "M0 0H${view.width}V${view.height}H0Z ${holes
    .map((h) => `M${h.left} ${h.top}h${h.width}v${h.height}h${-h.width}Z`)
    .join(' ')}")`;

  const tailStyle: CSSProperties =
    placed.side === 'left' || placed.side === 'right' ? { top: placed.tail } : { left: placed.tail };

  return createPortal(
    <div
      className={`coach${dim ? ' coach--dialog' : ''}`}
      data-testid="coach"
      data-step={step}
      data-motion={reduced ? 'none' : 'normal'}
    >
      <div
        className="coach__dim"
        data-testid="coach-dim"
        data-holes={holes.map((h) => `${h.left},${h.top},${h.width},${h.height}`).join(';')}
        style={{ clipPath }}
      />
      <div
        className="coach__spot"
        data-testid="coach-spot"
        style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}
      />
      <div
        ref={bubbleRef}
        className={`coach__bubble coach__bubble--${placed.side}`}
        data-testid="coach-bubble"
        role="group"
        aria-label="진행 도우미"
        tabIndex={-1}
        style={{ left: placed.left, top: placed.top }}
      >
        <span className="coach__tail" style={tailStyle} aria-hidden="true" />
        <div className="coach__head">
          <span className="coach__progress" data-testid="coach-progress">
            진행 도우미 · {step}/{total}
          </span>
          <button type="button" className="coach__skip" onClick={onSkip} data-testid="coach-skip">
            {COACH_SKIP_LABEL}
          </button>
        </div>
        <p className="coach__title" data-testid="coach-title">
          {title}
        </p>
        <p className="coach__body">{body}</p>
        {onAck && (
          <button type="button" className="coach__ack" onClick={onAck} data-testid="coach-ack">
            {ackLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
