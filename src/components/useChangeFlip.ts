// 입장이 "바뀐 순간"에만 머리띠·명패를 한 번 뒤집기 위한 횟수(T131). 처음 그려질 때는 0이라
// 뒤집지 않고, 값이 달라질 때마다 1씩 올라 호출부가 key로 쓰면 CSS 애니메이션이 그때 한 번만
// 다시 돈다. 움직임 줄이기 설정·지난 화면 보기(disabled)에서는 올리지 않아 움직임이 없다.
// matchMedia가 없는 환경(jsdom 등)은 움직임 줄이기가 꺼진 것으로 본다.

import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useChangeFlip(value: string, disabled = false): number {
  const previous = useRef(value);
  const wasDisabled = useRef(disabled);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 지난 화면 보기(disabled)에서 지금 화면으로 돌아오며 값이 달라진 것은 입장 변화가 아니라
    // 표시를 맞추는 것이다 — 뒤집지 않는다(PR #21 Codex P3).
    const leavingDisabled = wasDisabled.current && !disabled;
    wasDisabled.current = disabled;
    if (previous.current === value) {
      return;
    }
    previous.current = value;
    if (!disabled && !leavingDisabled && !prefersReducedMotion()) {
      setCount((current) => current + 1);
    }
  }, [value, disabled]);

  return count;
}
