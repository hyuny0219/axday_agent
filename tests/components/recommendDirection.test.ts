// T115: AI 비서실장 조건 추천이 임원의 실제 방향과 참가자 목표에 맞는지 전수 확인한다.
// 참가자 입장(FOR/AGAINST) × 안건 2개 × 임원 4명 × 확정 조건 부분집합 전수에 대해,
// 비서실장이 추천한 조건을 적용하면 규칙표상 그 임원이 참가자 목표 쪽으로 움직여야 하고,
// 이미 목표 쪽이면 추천이 없어야 한다.

import { describe, expect, it } from 'vitest';
import { buildConditionRecommendation } from '../../src/components/conditionRecommendation';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { ExecMemberId, Scenario } from '../../src/content/types';
import { membersAwaitingAnswer, scriptedStances } from '../../src/domain/stance';
import type { Opinion, ParticipantStance, Stance } from '../../src/domain/types';
import { EXEC_MEMBER_ORDER, decideMember } from '../../src/domain/voting';

function subsets<T>(items: readonly T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    for (const existing of [...result]) result.push([...existing, item]);
  }
  return result;
}

function opinionWith(stance: 'FOR' | 'AGAINST', conditionIds: string[]): Opinion {
  return { stance, confirmedConditionIds: conditionIds } as unknown as Opinion;
}

const scenarios: Scenario[] = [aiApprovalScenario, experienceFirstScenario];
const sides: Array<'FOR' | 'AGAINST'> = ['FOR', 'AGAINST'];

describe('T115 조건 추천 방향 일치(scripted 전수)', () => {
  for (const scenario of scenarios) {
    for (const side of sides) {
      const target = side === 'AGAINST' ? 'NO' : 'YES';
      const targetStance: Stance = side === 'AGAINST' ? 'AGAINST' : 'FOR';
      for (const answered of [true, false]) {
        it(`${scenario.id} · ${side} · 답변 ${answered ? '뒤' : '전'}: 추천 조건은 그 임원을 목표 쪽으로 움직이고, 목표 쪽 임원에는 추천이 없다`, () => {
          for (const confirmed of subsets(scenario.conditions.map((c) => c.id))) {
            const session = {
              stage: 'REACTIONS' as const,
              opinions: [opinionWith(side, confirmed)],
              followUpUsed: false,
              followUpAnswered: answered,
            };
            const stances = scriptedStances(scenario, session);
            const awaiting = answered ? [] : membersAwaitingAnswer(scenario, session);
            const rec = buildConditionRecommendation(scenario, confirmed, side, 'scripted', stances, undefined, awaiting);
            const where = `${scenario.id}/${side}/answered=${answered}/[${confirmed.join(',')}]`;
            const voteWith = (m: ExecMemberId, ids: string[]) =>
              decideMember(scenario.voteRules[m], {
                conditionIds: ids,
                executionMode: 'DEFAULT',
                participantStance: side as ParticipantStance,
              });

            for (const row of rec.rows) {
              for (const m of row.movedMemberIds) {
                expect(stances[m], `${where} ${m} 이미 목표 쪽인데 추천: ${row.conditionId}`).not.toBe(targetStance);
                expect(voteWith(m, confirmed), `${where} ${m}/${row.conditionId} 현재 표`).not.toBe(target);
                expect(voteWith(m, [...confirmed, row.conditionId]), `${where} ${m}/${row.conditionId} 적용 뒤 표`).toBe(target);
              }
            }
            for (const bundle of rec.bundles) {
              for (const m of bundle.movedMemberIds) {
                expect(voteWith(m, [...confirmed, ...bundle.conditionIds]), `${where} ${m} 묶음 적용 뒤 표`).toBe(target);
              }
            }
            // 답을 기다리는 임원은 조건 추천에 끼지 않는다.
            for (const m of awaiting) {
              for (const row of rec.rows) expect(row.movedMemberIds).not.toContain(m);
            }
            // 안내 문구 방향: 찬성 목표면 '반대로 돌리려면'이, 반대 목표면 '움직이려면'(찬성 방향)이 나오면 안 된다.
            if (side === 'AGAINST') {
              expect(rec.openingLine, where).not.toMatch(/찬성이 아닌/);
            } else {
              expect(rec.openingLine, where).not.toMatch(/반대로 돌리/);
            }
          }
        });
      }
    }
  }
  void EXEC_MEMBER_ORDER;
});
