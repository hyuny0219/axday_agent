// 화면이 코치에게 자기 상태(자료를 봤는지·입장·비서실장 사용 수 …)를 알리는 통로(T103).
// StageRouter가 상태를 쥐고 CoachHost가 읽는다. Provider 밖(단위 테스트 등)에서는 아무 일도
// 하지 않는다.

import { createContext, useContext, useEffect } from 'react';
import { EMPTY_COACH_UI, type CoachUi } from '../domain/coach';

export type CoachUiReporter = (patch: Partial<CoachUi>) => void;

export const CoachUiContext = createContext<CoachUiReporter | null>(null);

/**
 * 화면이 알려 줄 값을 코치 상태에 반영한다. 화면이 사라지거나 값이 바뀌면 알렸던 키를
 * 기본값으로 되돌려, 다른 화면의 오래된 값이 남지 않게 한다.
 */
export function useCoachReport(patch: Partial<CoachUi>): void {
  const report = useContext(CoachUiContext);
  const serialized = JSON.stringify(patch);
  useEffect(() => {
    if (!report) {
      return;
    }
    const value = JSON.parse(serialized) as Partial<CoachUi>;
    report(value);
    return () => {
      const reset: Record<string, unknown> = {};
      for (const key of Object.keys(value) as (keyof CoachUi)[]) {
        reset[key] = EMPTY_COACH_UI[key];
      }
      report(reset as Partial<CoachUi>);
    };
  }, [report, serialized]);
}
