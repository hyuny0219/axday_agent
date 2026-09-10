// 여러 의견(DISCUSS·REACTIONS 후속)에 걸쳐 확정된 조건 ID를 모으는 표시용 유틸리티.
// 표결 규칙 자체는 domain/에 있다.
//
// 후속 보완 의견은 이전에 확정된 조건을 칩으로 다시 보여주고 유지·해제하게 하므로
// (CLAUDE_IMPLEMENTATION.md 7장 "후속 보완은 누적 조건을 보여주고 유지·해제"),
// 가장 최근 의견의 confirmedConditionIds가 누적 상태 전체를 담는다. 따라서 합집합이
// 아니라 마지막 의견의 확정 목록을 그대로 쓴다. 합집합을 쓰면 후속에서 해제한 조건이
// 최종 안건에 되살아난다.

import type { Opinion } from '../domain/types';

/** 가장 최근 의견의 확정 조건 ID를 순서대로 돌려준다. 의견이 없으면 빈 배열. */
export function collectConfirmedConditionIds(opinions: readonly Opinion[]): string[] {
  const latest = opinions[opinions.length - 1];
  if (!latest) return [];
  const result: string[] = [];
  for (const id of latest.confirmedConditionIds) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}
