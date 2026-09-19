// RESULT 단계에서 클릭·키 입력이 오면 결론 도장 연출을 즉시 건너뛴다(DESIGN_SPEC.md
// v1.0 3절). ResultScreen의 5석 카드도 같은 규칙으로 자체 skip 상태를 갖는다
// (data-skip 속성 + CSS 선택자) — 도장은 T44에서 무대 열로 옮겨 별도 DOM 위치에
// 있으므로, 같은 규칙을 간단한 훅으로 다시 구현한다(값 자체는 로컬 useState, 세션
// 액션이 아니다).

import { useEffect, useState } from 'react';

/** active가 true인 동안만 리스너를 걸고, 클릭·키 입력이 오면 true를 돌려준다. */
export function useResultStampSkip(active: boolean): boolean {
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (!active || skip) {
      return;
    }
    function handleSkip() {
      setSkip(true);
    }
    window.addEventListener('click', handleSkip);
    window.addEventListener('keydown', handleSkip);
    return () => {
      window.removeEventListener('click', handleSkip);
      window.removeEventListener('keydown', handleSkip);
    };
  }, [active, skip]);

  return skip;
}
