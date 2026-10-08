// live 회의 기록(transcript)에서 설득 현황판·조건 추천이 쓰는 값을 뽑는 순수 셀렉터
// (PR #20 Codex 28차 P2-3·P2-4). 컴포넌트 밖에 두어 단위 테스트로 확인한다.

import type { ExecMemberId } from '../content/types';
import type { Statement, Stance } from '../domain/types';

/** 역할별 가장 최근 발언의 suggestedConditionIds. 제안이 비어 있는 최신 발언이면 그
 * 역할은 값이 없는 것으로 둔다(추천 쪽이 규칙표 참고값으로 대체한다). */
export function latestSuggestedConditionIds(
  statements: readonly Statement[],
): Partial<Record<ExecMemberId, readonly string[]>> {
  const result: Partial<Record<ExecMemberId, readonly string[]>> = {};
  for (const statement of statements) {
    // 뒤에 오는 발언이 앞선 발언을 덮어쓴다(배열은 시간 순서).
    result[statement.roleId] = statement.suggestedConditionIds;
  }
  for (const roleId of Object.keys(result) as ExecMemberId[]) {
    if ((result[roleId] ?? []).length === 0) {
      delete result[roleId];
    }
  }
  return result;
}

/** live 임원의 "첫 의견" 입장 — 그 역할의 첫 OPINIONS 발언에 실린 stance. 발언이 없거나
 * stance가 없으면 undefined(호출부가 UNDECIDED로 본다). */
export function liveOpeningStance(statements: readonly Statement[], memberId: ExecMemberId): Stance | undefined {
  return statements.find((statement) => statement.roleId === memberId && statement.stage === 'OPINIONS')?.stance;
}
