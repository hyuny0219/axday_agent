// "6개월 뒤" 에필로그 문구 선택(DESIGN_SPEC.md v1.0 8절, T47). 도장(resultStamp.ts)과
// 같은 기준으로 가결을 둘로 나눈다: 참가자가 확정한 조건이 최종안에 반영됐으면
// pass("이사회가 붙인 조건은 실행 점검표가…"), 없으면 passOriginal. live에서는 조건
// 없는 원안도 임원 모델 표로 PASS가 될 수 있어 조건을 전제한 문구를 무조건 쓰면 새
// 확정 사실이 된다(PR #8 Codex 2차 검토). outcome이 없으면(RESULT 전) null.

import type { SixMonthsLaterCopy } from '../content/types';
import type { Session } from '../domain/types';

export function epilogueText(
  outcome: Session['outcome'],
  hasReflectedConditions: boolean,
  copy: SixMonthsLaterCopy,
): string | null {
  if (outcome === 'PASS') {
    return hasReflectedConditions ? copy.pass : copy.passOriginal;
  }
  if (outcome === 'HOLD') {
    return copy.hold;
  }
  if (outcome === 'REJECT') {
    return copy.reject;
  }
  return null;
}
