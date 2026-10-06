// 안건 문장 표시용 동적 구성(T84, Opus UX 검토 #3 + my#2). 조건을 붙여도 원안 문장이
// 고정 "…절차는 미정이다."로 끝나 반영 조건과 모순돼 보이는 문제를 표시 계층에서
// 고친다. domain/motion.ts의 motion.text(해시·서버 검증용, server/live.ts motionHash가
// 참조한다)는 절대 건드리지 않는다 — 이 파일은 MotionScreen·VoteScreen·ResultScreen이
// 화면에 보여줄 문장만 scenario.motionBreakdown·remainingTasks와 확정 조건 id로
// 다시 짓는다. 새 사실은 만들지 않고, 이미 조건 칩이 보여주는 조건을 문장에서 다시
// 나열하지도 않는다.

import type { Scenario, UndecidedItem } from '../content/types';
import type { SessionOutcome } from '../domain/types';

export interface MotionDisplay {
  /** "표결 안건" 상자에 보여줄 한 문장. 확정 조건이 1개 이상이면 조건 칩을 가리키는
   * 안내를 덧붙인다. */
  sentence: string;
  /** 확정 조건에 대응하는 항목(resolvedBy)을 뺀 "아직 정하지 않은 것" 텍스트만.
   * 모두 해소됐으면 빈 배열. */
  undecidedLabels: string[];
}

function filterUnresolved(
  items: readonly UndecidedItem[],
  confirmedConditionIds: readonly string[],
): string[] {
  return items
    .filter((item) => !item.resolvedBy || !confirmedConditionIds.includes(item.resolvedBy))
    .map((item) => item.text);
}

export function buildMotionDisplay(
  scenario: Scenario,
  confirmedConditionIds: readonly string[],
): MotionDisplay {
  const hasConditions = confirmedConditionIds.length > 0;
  const sentence = hasConditions
    ? `${scenario.motionBreakdown.proposal} 단, 아래 조건을 붙입니다.`
    : scenario.motionBreakdown.proposal;
  return {
    sentence,
    undecidedLabels: filterUnresolved(scenario.motionBreakdown.undecidedItems, confirmedConditionIds),
  };
}

/** 결과 화면 "남은 과제" 줄(T84) — buildMotionDisplay와 같은 로직으로 확정 조건에
 * 대응하는 과제를 뺀다. 단 **부결이면 붙인 조건도 승인된 것이 아니므로** 과제를 하나도
 * 빼지 않는다(PR #20 Codex 1차 검토 P2 — LIMIT만 붙인 수정안이 부결됐는데 "결재 범위·한도
 * 확정"이 남은 과제에서 사라졌다). */
export function buildRemainingTaskLabels(
  scenario: Scenario,
  confirmedConditionIds: readonly string[],
  outcome: SessionOutcome,
): string[] {
  const resolvedBy = outcome === 'PASS' ? confirmedConditionIds : [];
  return filterUnresolved(scenario.remainingTasks, resolvedBy);
}
