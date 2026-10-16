// T137(v20): 반대 참가자 경로의 표결 방향 지시. v19 실측에서 live 최종표가 규칙표와 무관하게 "원안에 조건이
// 없다"는 이유로 전원 반대였다(docs/eval/tuning-v19.md). T132(첫 반응)처럼 규칙표(decideMember)로 그 임원의 표
// 방향을 계산해 방향 지시만 싣는다 — 규칙표 자체나 어떤 조건이 누구를 움직이는지는 싣지 않는다.

import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { ExecMemberId, Scenario } from '../../src/content/types';
import { decideMember } from '../../src/domain/voting';

const SCENARIOS: Record<string, Scenario> = {
  [aiApprovalScenario.id]: aiApprovalScenario,
  [experienceFirstScenario.id]: experienceFirstScenario,
};

export interface VoteDirectionInput {
  scenarioId: string;
  roleId: string;
  participantStance?: 'FOR' | 'AGAINST';
  effectiveConditionIds: readonly string[];
  followUpAnswered?: boolean;
}

/** 반대 참가자일 때만, 규칙표 기준 이 임원의 표(YES·NO). 그 밖(찬성·미선택·모르는 안건)은 null. */
export function ruleVoteDirection(input: VoteDirectionInput): 'YES' | 'NO' | null {
  if (input.participantStance !== 'AGAINST') return null;
  const rules = SCENARIOS[input.scenarioId]?.voteRules[input.roleId as ExecMemberId];
  if (!rules) return null;
  const vote = decideMember(rules, {
    conditionIds: [...input.effectiveConditionIds],
    executionMode: 'DEFAULT',
    participantStance: 'AGAINST',
    followUpAnswered: input.followUpAnswered !== false,
  });
  return vote === 'UNCAST' ? null : vote;
}

const NOT_AMENDED =
  'meeting_record의 "참가자가 내건 조건"은 안건 문장을 바꾸지 않습니다. 그래서 "원안에' +
  ' 조건이 하나도 없다"는 사실만으로는 반대할 이유가 되지 않습니다.';

export function buildVoteDirectionRule(direction: 'YES' | 'NO' | null): string | null {
  if (direction === null) return null;
  if (direction === 'NO') {
    return (
      NOT_AMENDED +
      ' 참가자가 내건 조건 가운데 당신의 우려와 맞닿은 것이 있어, 당신의 표는 반대(NO)입니다. 반드시 반대표를' +
      ' 던지고, 그 조건이 왜 우려를 키우는지 이유에 쓰십시오.'
    );
  }
  return (
    NOT_AMENDED +
    ' 참가자가 내건 조건은 당신의 우려를 키우지 못했거나 지나친 주장입니다(안건을 아예 막자는 말처럼).' +
    ' 당신의 표는 안건대로 찬성(YES)입니다. 반드시 찬성표를 던지십시오. 원안에 조건이 없다거나 책임·기록이' +
    ' 정해지지 않았다는 점은 반대표의 이유가 아닙니다(다른 임원이 맡을 몫이거나 운영하며 정할 일입니다).' +
    ' 이유에는 참가자의 조건이 약하거나 지나친 점을 쓰십시오.'
  );
}
