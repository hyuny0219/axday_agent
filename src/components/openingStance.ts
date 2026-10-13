// 임원의 "첫 의견" 입장 조회. PersuasionBoard가 "첫 의견 → 지금" 비교의 시작점으로 쓴다
// (T96). scripted는 scenario.initialOpinions.openingStance, live는 실제 모델이 낸 첫
// OPINIONS 발언의 stance다 — live에서 각본 값을 쓰면 모델 응답이 다를 때 입장 변화가
// 거짓으로 표시되거나 빠진다(PR #20 Codex 28차 P2-4).

import type { ExecMemberId, Scenario } from '../content/types';
import type { SessionMode, Stance, Statement } from '../domain/types';
import { liveOpeningStance } from './liveTranscript';

export function openingStanceOf(
  scenario: Scenario,
  memberId: ExecMemberId,
  mode: SessionMode = 'scripted',
  statements: readonly Statement[] = [],
): Stance {
  if (mode === 'live') {
    return liveOpeningStance(statements, memberId) ?? 'UNDECIDED';
  }
  return scenario.initialOpinions.find((opinion) => opinion.memberId === memberId)?.openingStance ?? 'UNDECIDED';
}
