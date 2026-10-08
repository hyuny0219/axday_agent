// MOTION 단계 의장(CEO) 한 줄 — 무대 말풍선(App.tsx chairLineFor)과 회의록(minutes.ts
// 'chair-motion' 항목)이 **같은 문장**을 써야 한다. 조건이 없을 때 말풍선은 "원안 그대로
// 표결에 부칩니다"인데 회의록은 "이 조건으로 안건을 고정합니다"로 남아 서로 모순됐다
// (PR #20 Codex 3차 검토 P2). 실제로 반영된 조건 수·첫 조건명을 말한다(T85 #19).
// T92: 참가자가 반대 입장이면서 조건을 붙였으면(조건부 반대) "조건을 달아"가 아니라
// "반대 의견과 요구 조건을 달아"로 — 그 조건이 참가자의 요구였다는 점을 의장도 밝힌다.

import type { Scenario } from '../content/types';

export function chairMotionLine(
  scenario: Scenario | null,
  confirmedConditionIds: readonly string[],
  participantStance: 'FOR' | 'AGAINST' | null = null,
): string {
  if (confirmedConditionIds.length === 0) {
    return '처음 안 그대로 표결에 부칩니다';
  }
  const firstLabel =
    scenario?.conditions.find((condition) => condition.id === confirmedConditionIds[0])?.label ??
    confirmedConditionIds[0];
  if (participantStance === 'AGAINST') {
    return confirmedConditionIds.length === 1
      ? `이사님의 반대 의견과 요구 조건(${firstLabel})을 달아 표결에 부칩니다`
      : `이사님의 반대 의견과 요구 조건 ${confirmedConditionIds.length}개를 달아 표결에 부칩니다`;
  }
  return confirmedConditionIds.length === 1
    ? `${firstLabel} 조건을 달아 표결에 부칩니다`
    : `${firstLabel} 등 조건 ${confirmedConditionIds.length}개를 달아 표결에 부칩니다`;
}
