// 주입형 시계. CLAUDE_IMPLEMENTATION.md 3장을 따르던 240초 만료·75/90초 무입력 판정은
// T50(2026-09-22 사용자 결정)에서 제거했다 — 체험은 더 이상 시간으로 끝나지 않는다.
// 이 파일은 이제 Clock 자체만 담당한다: 서버 핸들러와 orchestrator가 지연 측정(라운드
// 대기 상한 등)에 여전히 주입형 Clock을 쓴다. 시간은 항상 여기 주입된 Clock의 now()로만
// 계산하고, setInterval 호출 횟수나 렌더링 횟수로 계산하지 않는다.

export interface Clock {
  now(): number;
}

/** 실제 시간을 반환하는 시계. 런타임 앱에서만 사용한다. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface FakeClock extends Clock {
  /** 테스트에서 시간을 ms만큼 앞으로 이동한다. */
  advance(ms: number): void;
}

/** 테스트 전용 결정적 시계. now()는 마지막으로 설정된 값만 반환한다. */
export function fakeClock(start: number): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}
