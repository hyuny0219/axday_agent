// T119: 비서실장 "붙이는 곳" 안내 — 추천 문구 번호·추가 답변 안내, 닿을 곳이 없는 조건 걸러내기.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import {
  conditionSourceHint,
  isConditionOffered,
  phraseNumberForCondition,
} from '../../src/components/conditionSource';
import { buildConditionRecommendation } from '../../src/components/conditionRecommendation';
import { EXEC_MEMBER_ORDER } from '../../src/domain/voting';
import type { Stance } from '../../src/domain/types';
import type { ExecMemberId } from '../../src/content/types';

describe('conditionSourceHint', () => {
  it('DISCUSS에서 첫 단계 추천 문구에 있으면 보이는 순서의 번호를 말한다', () => {
    // 찬성 쪽 보이는 문구: P1 LIMIT, P2 LOG, P3 REVIEW, P6(요청)
    expect(phraseNumberForCondition(aiApprovalScenario, 'LIMIT', 'FOR')).toBe(1);
    expect(conditionSourceHint(aiApprovalScenario, 'REVIEW', 'FOR', 'DISCUSS')).toBe(
      '추천 문구 3번에서 고를 수 있습니다',
    );
  });

  it('첫 단계에 없고 추가 답변에만 있는 조건은 추가 답변을 안내한다', () => {
    expect(conditionSourceHint(aiApprovalScenario, 'OWNER', 'FOR', 'DISCUSS')).toBe(
      '다음 단계 추가 답변에서 고를 수 있습니다',
    );
    expect(conditionSourceHint(aiApprovalScenario, 'FULL_AUTO', 'AGAINST', 'REACTIONS')).toBe(
      '추가 답변에서 고를 수 있습니다',
    );
  });

  it('REACTIONS에서는 추천 문구 단계가 지나 추가 답변이 없으면 안내하지 않는다', () => {
    const withoutFollowUp = {
      ...aiApprovalScenario,
      followUp: { ...aiApprovalScenario.followUp, options: [] },
    };
    expect(conditionSourceHint(withoutFollowUp, 'REVIEW', 'FOR', 'REACTIONS')).toBeNull();
    expect(isConditionOffered(withoutFollowUp, 'OWNER', 'FOR')).toBe(false);
  });

  it('입장이 없으면 안내하지 않고, 두 안건의 모든 조건은 두 입장에서 닿는다', () => {
    expect(conditionSourceHint(aiApprovalScenario, 'LIMIT', null, 'DISCUSS')).toBeNull();
    for (const scenario of [aiApprovalScenario, experienceFirstScenario]) {
      for (const side of ['FOR', 'AGAINST'] as const) {
        for (const condition of scenario.conditions) {
          expect(isConditionOffered(scenario, condition.id, side), `${scenario.id} ${side} ${condition.id}`).toBe(true);
        }
      }
    }
  });
});

describe('조건 추천 — 닿을 곳이 없는 조건은 추천하지 않는다', () => {
  const stances = Object.fromEntries(EXEC_MEMBER_ORDER.map((id) => [id, 'AGAINST'])) as Record<ExecMemberId, Stance>;

  it('isConditionOffered가 false인 조건은 행·묶음에서 빠진다', () => {
    const all = buildConditionRecommendation(aiApprovalScenario, [], 'FOR', 'scripted', stances);
    expect(all.rows.length + all.bundles.length).toBeGreaterThan(0);
    const none = buildConditionRecommendation(aiApprovalScenario, [], 'FOR', 'scripted', stances, undefined, [], () => false);
    expect(none.rows).toEqual([]);
    expect(none.bundles).toEqual([]);
  });
});
