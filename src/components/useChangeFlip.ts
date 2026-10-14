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
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (previous.current === value) {
      return;
    }
    previous.current = value;
    if (!disabled && !prefersReducedMotion()) {
      setCount((current) => current + 1);
    }
  }, [value, disabled]);

  return count;
}
