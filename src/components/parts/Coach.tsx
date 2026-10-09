// 진행 도우미 말풍선(화면 사용법 안내, T103·T104). 어두운 덮개·스포트라이트·클릭 막음이
// 없다 — 무대 사진(왼쪽 열 맨 위, 장식)에 얹힌 카드 한 장이고, 카드 자체만 눌린다. 참가자는
// 카드가 떠 있어도 화면의 무엇이든 누를 수 있다. 문서 body로 portal해 화면 맞춤
// 축소(transform) 조상의 영향을 받지 않는다. 언제 보일지는 도메인(domain/coach.ts)이 정한다.

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COACH_ACK_LABEL, COACH_ICON_ARIA, COACH_ICON_TEXT } from '../../content/coach';
import '../../styles/screens/coach.css';

export interface CoachProps {
  step: number;
  total: number;
  title: ReactNode;
  /** 안내 줄. 둘 이상이면 번호 목록. */
  lines: readonly string[];
  /** 카드를 얹을 자리를 정하는 요소의 선택자(기본: 무대 사진). 없으면 왼쪽 위 고정 자리. */
  anchorSelector?: string;
  onAck: () => void;
  ackLabel?: string;
}

interface Box {
  left: number;
  top: number;
  width: number;
}

const INSET = 12;
const MAX_WIDTH = 460;
const FALLBACK: Box = { left: 48, top: 73, width: 460 };

function readAnchor(selector: string | undefined): Box {
  if (!selector) return FALLBACK;
  const el = document.querySelector(selector);
  if (!el) return FALLBACK;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return FALLBACK;
  return { left: r.left, top: r.top, width: r.width };
}

function sameBox(a: Box, b: Box): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width;
}

function useAnchorBox(anchorSelector: string | undefined): Box {
  const [box, setBox] = useState<Box>(() => readAnchor(anchorSelector));

  // 화면 배치가 바뀌는 어떤 이유(크기 조절·늦게 나타나는 무대)에도 따라가도록 프레임마다 읽고,
  // 값이 달라졌을 때만 상태를 바꾼다.
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const hasRaf = typeof window.requestAnimationFrame === 'function';
    const tick = () => {
      const next = readAnchor(anchorSelector);
      setBox((prev) => (sameBox(prev, next) ? prev : next));
      if (hasRaf) frame = window.requestAnimationFrame(tick);
      else timer = window.setTimeout(tick, 100);
    };
    tick();
    return () => {
      if (hasRaf) window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [anchorSelector]);
  return box;
}

/** 말풍선이 닫힌 뒤 같은 자리에 남는 작은 둥근 "안내" 버튼. 누르면 그 화면 안내를 다시 연다. */
export function CoachIcon({
  anchorSelector = '[data-testid="stage-band"]',
  onOpen,
}: {
  anchorSelector?: string;
  onOpen: () => void;
}) {
  const box = useAnchorBox(anchorSelector);
  return createPortal(
    <button
      type="button"
      className="coach-icon"
      data-testid="coach-icon"
      aria-label={COACH_ICON_ARIA}
      style={{ left: box.left + INSET, top: box.top + INSET }}
      onClick={onOpen}
    >
      {COACH_ICON_TEXT}
    </button>,
    document.body,
  );
}

export function Coach({
  step,
  total,
  title,
  lines,
  anchorSelector = '[data-testid="stage-band"]',
  onAck,
  ackLabel = COACH_ACK_LABEL,
}: CoachProps) {
  const box = useAnchorBox(anchorSelector);

  const style: CSSProperties = {
    left: box.left + INSET,
    top: box.top + INSET,
    width: Math.min(MAX_WIDTH, Math.max(240, box.width - INSET * 2)),
  };

  return createPortal(
    <div className="coach" data-testid="coach" data-step={step} style={style} role="group" aria-label="진행 도우미">
      <div className="coach__head">
        <span className="coach__progress" data-testid="coach-progress">
          안내 {step}/{total}
        </span>
      </div>
      <p className="coach__title" data-testid="coach-title">
        {title}
      </p>
      {lines.length > 1 ? (
        <ol className="coach__list" data-testid="coach-lines">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        <p className="coach__body" data-testid="coach-lines">
          {lines[0]}
        </p>
      )}
      <button type="button" className="coach__ack" onClick={onAck} data-testid="coach-ack">
        {ackLabel}
      </button>
    </div>,
    document.body,
  );
}
