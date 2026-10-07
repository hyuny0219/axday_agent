// 임원의 "첫 의견" 입장(scenario.initialOpinions.openingStance) 조회. PersuasionBoard·
// resultSummary 양쪽이 같은 규칙을 쓰므로 여기 하나로 뽑아 둔다(T96).

import type { ExecMemberId, Scenario } from '../content/types';
import type { Stance } from '../domain/types';

export function openingStanceOf(scenario: Scenario, memberId: ExecMemberId): Stance {
  return (
    scenario.initialOpinions.find((opinion) => opinion.memberId === memberId)?.openingStance ?? 'UNDECIDED'
  );
}
