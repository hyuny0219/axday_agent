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

/** 표 방향과 그 이유가 어디서 왔는지(P2, v21). 조건이 없는데 "그 조건이 우려를 키운다"고 지어내지 않게 가른다. */
export type VoteDirection =
  | 'NO_BY_CONDITION' // 참가자가 내건 조건 때문에 반대로 돌아선 표
  | 'NO_BASELINE' // 조건과 무관하게 처음 우려가 그대로라서 반대인 표
  | 'YES_WEAK_CONDITION' // 조건이 있으나 약하거나 지나쳐서 안건대로 찬성
  | 'YES_NO_CONDITION'; // 참가자가 조건을 내지 않아 안건대로 찬성

/** 반대 참가자일 때만, 규칙표 기준 이 임원의 표 방향. 그 밖(찬성·미선택·모르는 안건)은 null. */
export function ruleVoteDirection(input: VoteDirectionInput): VoteDirection | null {
  if (input.participantStance !== 'AGAINST') return null;
  const rules = SCENARIOS[input.scenarioId]?.voteRules[input.roleId as ExecMemberId];
  if (!rules) return null;
  const ctx = {
    conditionIds: [...input.effectiveConditionIds],
    executionMode: 'DEFAULT',
    participantStance: 'AGAINST' as const,
    followUpAnswered: input.followUpAnswered !== false,
  };
  const vote = decideMember(rules, ctx);
  if (vote === 'UNCAST') return null;
  // 조건이 있을 때와 없을 때(같은 추가 질문 맥락)의 표를 비교해 조건이 표를 바꿨는지 본다.
  const baseline = decideMember(rules, { ...ctx, conditionIds: [] });
  const hasConditions = input.effectiveConditionIds.length > 0;
  if (vote === 'NO') return baseline === 'NO' ? 'NO_BASELINE' : 'NO_BY_CONDITION';
  return hasConditions ? 'YES_WEAK_CONDITION' : 'YES_NO_CONDITION';
}

const NOT_AMENDED =
  '참가자가 내건 조건은 안건 문장을 바꾸지 않습니다. 그래서 "원안에 조건이 하나도 없다"는 사실만으로는' +
  ' 반대할 이유가 되지 않습니다.';

export function buildVoteDirectionRule(direction: VoteDirection | null): string | null {
  switch (direction) {
    case null:
      return null;
    case 'NO_BY_CONDITION':
      return (
        NOT_AMENDED +
        ' 참가자가 내건 조건 가운데 당신의 우려와 맞닿은 것이 있어, 당신의 표는 반대(NO)입니다. 반드시 반대표를' +
        ' 던지고, 그 조건이 왜 우려를 키우는지 이유에 쓰십시오.'
      );
    case 'NO_BASELINE':
      return (
        '당신의 처음 우려는 참가자의 말로 풀리지 않았습니다. 당신의 표는 반대(NO)입니다. 반드시 반대표를 던지고,' +
        ' 이유에는 처음 우려가 그대로라는 점을 쓰십시오. 참가자가 낸 조건이 그 우려를 키웠다고 지어내지 마십시오.'
      );
    case 'YES_WEAK_CONDITION':
      return (
        NOT_AMENDED +
        ' 참가자가 내건 조건은 당신의 우려를 키우지 못했거나 지나친 주장입니다(안건을 아예 막자는 말처럼).' +
        ' 당신의 표는 안건대로 찬성(YES)입니다. 반드시 찬성표를 던지십시오. 원안에 조건이 없다거나 책임·기록이' +
        ' 정해지지 않았다는 점은 반대표의 이유가 아닙니다(다른 임원이 맡을 몫이거나 운영하며 정할 일입니다).' +
        ' 이유에는 참가자의 조건이 약하거나 지나친 점을 쓰십시오.'
      );
    case 'YES_NO_CONDITION':
      return (
        NOT_AMENDED +
        ' 참가자는 반대한다고만 했을 뿐 당신을 설득할 만한 조건을 내지 않았습니다. 당신의 표는 안건대로 찬성(YES)입니다.' +
        ' 반드시 찬성표를 던지고, 이유에는 설득할 만한 조건이 나오지 않았다는 점을 쓰십시오. 참가자가 낸 조건이' +
        ' 있었다고 지어내지 마십시오.'
      );
  }
}
