// 미디어 쿼리 일치 여부를 구독하는 훅. BriefingScreen이 1280px 이하에서 자료 카드
// details의 기본 접힘 여부를 결정하는 데 쓴다(DESIGN_SPEC.md v1.0 5절). 네이티브
// <details>의 열림 상태는 자식 CSS(display 등)로 덮어쓸 수 없어 — 닫힌 상태의
// 본문은 브라우저가 렌더 자체를 건너뛴다 — React state로 open을 직접 제어해야
// 한다. SPA라 SSR을 고려하지 않고 window가 항상 있다고 가정한다.

import { useEffect, useState } from 'react';

export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    function handleChange() {
      setMatches(mql.matches);
    }
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
