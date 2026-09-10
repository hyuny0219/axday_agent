// 여러 의견(DISCUSS·REACTIONS 후속)에 걸쳐 확정된 조건 ID를 모으는 표시용 유틸리티.
// 표결 규칙 자체는 domain/에 있고, 여기서는 이미 확정된 조건 ID를 순서대로 합칠 뿐이다.

import type { Opinion } from '../domain/types';

/** 등장 순서를 유지하며 중복 없이 조건 ID를 모은다. */
export function collectConfirmedConditionIds(opinions: readonly Opinion[]): string[] {
  const result: string[] = [];
  for (const opinion of opinions) {
    for (const id of opinion.confirmedConditionIds) {
      if (!result.includes(id)) {
        result.push(id);
      }
    }
  }
  return result;
}
