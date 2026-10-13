// 결과 보고서의 소리(T128): 임원 표 한 장 공개마다 revealB, 공개 중 BGM 덕킹, 가결·부결 도장음.
// 건너뛰기·감속 모드처럼 한꺼번에 열리면 공개음은 한 번만 낸다(여러 장을 겹쳐 내지 않는다).

import { useEffect, useRef } from 'react';
import { sound as defaultSound, type Sound } from './sound';

export function useResultSounds(
  state: { execRevealed: number; allRevealed: boolean },
  target: Sound = defaultSound,
): void {
  const prevRevealed = useRef(0);
  useEffect(() => {
    if (state.execRevealed > prevRevealed.current) target.play('revealB');
    prevRevealed.current = state.execRevealed;
  }, [state.execRevealed, target]);

  useEffect(() => {
    target.setDuck(!state.allRevealed);
    if (state.allRevealed) target.play('stamp');
    return () => target.setDuck(false);
  }, [state.allRevealed, target]);
}
