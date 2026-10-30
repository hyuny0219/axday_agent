// 자동 진행 표시(T144, copilot_secret_agent 참고): 자막 띠 + 노란 강조 상자 + 진행 목록, 그리고
// 참가자 차례의 'CLICK 눌러서 …' 알약(나머지 어둡게 + 흰 테두리). body로 portal해 화면 맞춤
// 축소(transform)의 영향을 받지 않는다. 클릭은 막지 않는다 — 입력 막기는 호스트가 맡는다.

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AUTO_BAR_LABEL, AUTO_PILL_PREFIX } from '../../content/autoPlay';
import '../../styles/screens/autoPlay.css';

export interface AutoStepItem {
  id: string;
  label: string;
  state: 'done' | 'current' | 'todo';
}

export interface AutoOverlayProps {
  mode: 'run' | 'click';
  /** 강조할 요소를 찾는 CSS 선택자. 여럿이면 nth번째. */
  selector: string | null;
  nth?: number;
  /** run: 이미 타이핑된 자막. */
  caption?: string;
  /** click: 알약에 쓸 버튼 이름. */
  clickLabel?: string;
  steps?: readonly AutoStepItem[];
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MARK: Record<AutoStepItem['state'], string> = { done: '✓', current: '▶', todo: '○' };

function measure(selector: string | null, nth: number): Rect | null {
  if (!selector) return null;
  const element = document.querySelectorAll(selector)[nth];
  if (!element) return null;
  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export function AutoOverlay({ mode, selector, nth = 0, caption = '', clickLabel = '', steps }: AutoOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  // 요소 위치를 따라간다. 시간 계산이 아니라 화면 위치 측정이라 실제 타이머를 써도 된다.
  const [measureTick, setMeasureTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setMeasureTick((value) => value + 1), 150);
    const onResize = () => setMeasureTick((value) => value + 1);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  useEffect(() => {
    if (!selector) return;
    document.querySelectorAll(selector)[nth]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selector, nth]);
  useLayoutEffect(() => {
    const next = measure(selector, nth);
    setRect((previous) => (sameRect(previous, next) ? previous : next));
  }, [selector, nth, measureTick]);

  const pad = mode === 'click' ? 6 : 4;
  const boxStyle = rect
    ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : undefined;

  return createPortal(
    <div className="auto-overlay" data-testid={mode === 'run' ? 'auto-overlay' : 'auto-click'} data-auto-mode={mode}>
      {boxStyle && <div className={mode === 'run' ? 'auto-box' : 'auto-spot'} style={boxStyle} />}
      {mode === 'click' && boxStyle && (
        <div
          className="auto-pill"
          data-testid="auto-pill"
          style={{
            left: boxStyle.left + boxStyle.width / 2,
            top: boxStyle.top > 64 ? boxStyle.top - 14 : boxStyle.top + boxStyle.height + 14,
            transform: boxStyle.top > 64 ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          <b>{AUTO_PILL_PREFIX}</b> {clickLabel}
        </div>
      )}
      {mode === 'run' && steps && steps.length > 0 && (
        <ol className="auto-steps" data-testid="auto-steps" aria-label="진행 목록">
          {steps.map((step) => (
            <li key={step.id} className={`auto-steps__item auto-steps__item--${step.state}`}>
              <span aria-hidden="true">{MARK[step.state]}</span> {step.label}
            </li>
          ))}
        </ol>
      )}
      {mode === 'run' && (
        <div className="auto-bar" data-testid="auto-bar" role="status" aria-live="polite">
          <span className="auto-bar__label">{AUTO_BAR_LABEL}</span>
          <span className="auto-bar__text">{caption}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
