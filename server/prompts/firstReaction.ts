// T132(v16): 첫 반응(REACTIONS)에서 임원마다 다른 stance 지시를 붙인다. v12~v15는 모든 임원에게
// "UNDECIDED까지만"을 줘서 live 첫 반응이 거의 전원 고민 중이 됐다(docs/eval/tuning-v16.md).
// 판정은 표결 규칙표(src/content/scenarios의 voteRules)와 도메인 함수(decideMember)로 하며,
// 클라이언트 leaningStances와 같은 기준이다. 규칙표 값을 프롬프트에 싣지 않고 방향 지시만 싣는다.

import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { ExecMemberId, Scenario } from '../../src/content/types';
import { decideMember } from '../../src/domain/voting';
import { REACTIONS_FIRST_PASS_RULE } from './common';

export type FirstReactionKind = 'SAME_SIDE' | 'MAY_CROSS' | 'KEEP';

const SCENARIOS: Record<string, Scenario> = {
  [aiApprovalScenario.id]: aiApprovalScenario,
  [experienceFirstScenario.id]: experienceFirstScenario,
};

export interface FirstReactionInput {
  scenarioId: string;
  roleId: string;
  participantStance?: 'FOR' | 'AGAINST';
  /** 요청의 확정 조건. 없으면 판정하지 않는다(공통 규칙). */
  confirmedConditionIds?: readonly string[];
  /** 그 임원의 첫 의견 stance. 없으면 판정하지 않는다. */
  priorStance?: 'FOR' | 'AGAINST' | 'UNDECIDED';
}

/** 판정에 필요한 값이 없거나 규칙표를 못 찾으면 null(공통 규칙으로 폴백). */
export function classifyFirstReaction(input: FirstReactionInput): FirstReactionKind | null {
  const scenario = SCENARIOS[input.scenarioId];
  const rules = scenario?.voteRules[input.roleId as ExecMemberId];
  if (!rules || input.priorStance === undefined || input.confirmedConditionIds === undefined) {
    return null;
  }
  const direction: 'FOR' | 'AGAINST' = input.participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  if (input.priorStance === direction) {
    return 'SAME_SIDE';
  }
  const target = direction === 'FOR' ? 'YES' : 'NO';
  const ctx = {
    conditionIds: [...input.confirmedConditionIds],
    executionMode: 'DEFAULT',
    participantStance: input.participantStance ?? null,
    followUpAnswered: true,
  };
  return decideMember(rules, ctx) === target && decideMember(rules, { ...ctx, conditionIds: [] }) !== target
    ? 'MAY_CROSS'
    : 'KEEP';
}

const KEEP_PRIOR_TAIL =
  ' 이 지침은 위의 "첫 의견부터 방향을 밝히라"는 stance 지침보다 우선합니다.';

/** 임원별 첫 반응 지시. 판정 불가(null)면 기존 공통 규칙(v12~v15)을 그대로 쓴다. */
export function buildFirstReactionRule(kind: FirstReactionKind | null): string {
  switch (kind) {
    case 'SAME_SIDE':
      return (
        '이 반응은 참가자의 첫 의견에 대한 첫 반응입니다. 당신은 처음부터 참가자와 같은 편이었습니다.' +
        ' stance를 처음 입장(FOR 또는 AGAINST) 그대로 유지하고 UNDECIDED(고민 중)로 바꾸지 마십시오.' +
        ' 발언에서도 같은 편으로서 참가자의 주장을 받쳐 주십시오.' +
        KEEP_PRIOR_TAIL
      );
    case 'MAY_CROSS':
      return REACTIONS_FIRST_PASS_RULE;
    case 'KEEP':
      return (
        '이 반응은 참가자의 첫 의견에 대한 첫 반응입니다. 참가자가 낸 조건이나 근거로는 당신의 우려가' +
        ' 아직 풀리지 않았습니다. stance를 처음 입장 그대로 유지하십시오(반대였으면 AGAINST,' +
        ' 고민 중이었으면 UNDECIDED). 발언에는 아직 남은 우려를 평서문으로 이유와 함께 말하십시오.' +
        KEEP_PRIOR_TAIL
      );
    case null:
      return REACTIONS_FIRST_PASS_RULE;
  }
}
