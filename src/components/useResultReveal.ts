// 결과 화면 임원 표 순차 공개(T114)의 "지금 몇 장이 열렸는가". 눈에 보이는 연출은 CSS
// animation-delay가 맡고, 이 훅은 스크린리더용 aria-hidden을 같은 시각에 풀기 위해 둔다
// (공개 전 결과가 낭독되면 연출이 무의미하다). 경과 시간은 렌더 횟수가 아니라 주입된
// Clock으로 재고, 타이머는 다음 공개 시각까지만 잡는다(언마운트 시 정리).
// prefers-reduced-motion·운영자 skip이면 처음부터(또는 skip 즉시) 전부 열린 것으로 본다.

import { useEffect, useRef, useState } from 'react';
import { systemClock, type Clock } from '../domain/clock';
import { EXEC_MEMBER_ORDER } from '../domain/voting';
import { ALL_EXEC_REVEALED_SECONDS, execRevealDelay } from './resultStamp';

export interface ResultRevealState {
  /** 열린 임원 표 수(0~4, EXEC_MEMBER_ORDER 순). */
  execRevealed: number;
  /** 집계·결론 문구가 나오는 시점 이후인가. */
  allRevealed: boolean;
}

const ALL_OPEN: ResultRevealState = { execRevealed: EXEC_MEMBER_ORDER.length, allRevealed: true };

/** 경과 시간(초)에 열려 있어야 할 상태 — 순수 함수. */
export function revealStateAt(elapsedSeconds: number): ResultRevealState {
  let execRevealed = 0;
  for (let index = 0; index < EXEC_MEMBER_ORDER.length; index += 1) {
    if (elapsedSeconds >= execRevealDelay(index)) execRevealed = index + 1;
  }
  return { execRevealed, allRevealed: elapsedSeconds >= ALL_EXEC_REVEALED_SECONDS };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function useResultReveal(skip: boolean, clock: Clock = systemClock): ResultRevealState {
  const reduced = useRef(prefersReducedMotion()).current;
  const startedAt = useRef(clock.now());
  const immediate = skip || reduced;
  const [state, setState] = useState<ResultRevealState>(() => (immediate ? ALL_OPEN : revealStateAt(0)));

  useEffect(() => {
    if (immediate) {
      setState(ALL_OPEN);
      return;
    }
    const milestones = [
      ...EXEC_MEMBER_ORDER.map((_, index) => execRevealDelay(index)),
      ALL_EXEC_REVEALED_SECONDS,
    ];
    const timers = milestones.map((seconds) => {
      const wait = Math.max(0, seconds * 1000 - (clock.now() - startedAt.current));
      return setTimeout(() => setState(revealStateAt((clock.now() - startedAt.current) / 1000 + 0.001)), wait);
    });
    return () => timers.forEach(clearTimeout);
  }, [immediate, clock]);

  return state;
}
