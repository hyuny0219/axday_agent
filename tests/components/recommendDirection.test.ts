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
import { decideMember } from '../../src/domain/voting';
import { findFollowUpIndexForCondition, findPhraseForCondition } from '../../src/components/recommendMatch';

function subsets<T>(items: readonly T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    for (const existing of [...result]) result.push([...existing, item]);
  }
  return result;
}

function opinionWith(stance: 'FOR' | 'AGAINST', conditionIds: string[]): Opinion {
  return { id: 'op-1', originalText: '', selectedPhraseIds: [], confirmedConditionIds: conditionIds, stance, createdAt: 0 };
}

const scenarios: Scenario[] = [aiApprovalScenario, experienceFirstScenario];
const sides: Array<'FOR' | 'AGAINST'> = ['FOR', 'AGAINST'];

const seenWording = { forMove: false, againstTurn: false };

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
              if (rec.rows.length > 0) {
                expect(rec.openingLine, where).toMatch(/반대로 돌리려면/);
                seenWording.againstTurn = true;
              }
            } else {
              expect(rec.openingLine, where).not.toMatch(/반대로 돌리/);
              if (rec.rows.length > 0) {
                expect(rec.openingLine, where).toMatch(/움직이려면/);
                seenWording.forMove = true;
              }
            }
          }
        });
      }
    }
  }
});

describe('T115 안내 문구 긍정 검사·입장 미선택·문구 side', () => {
  it('찬성 목표의 "움직이려면"과 반대 목표의 "반대로 돌리려면"이 실제로 한 번 이상 나온다', () => {
    expect(seenWording.forMove).toBe(true);
    expect(seenWording.againstTurn).toBe(true);
  });

  it('입장을 고르지 않았으면(participantStance=null) 어떤 조건도 추천하지 않는다', () => {
    for (const scenario of scenarios) {
      const stances = scriptedStances(scenario, { stage: 'DISCUSS', opinions: [] });
      for (const confirmed of subsets(scenario.conditions.map((c) => c.id))) {
        for (const mode of ['scripted', 'live'] as const) {
          const rec = buildConditionRecommendation(scenario, confirmed, null, mode, stances, { CFO: ['LIMIT'] });
          expect(rec.rows).toEqual([]);
          expect(rec.bundles).toEqual([]);
          expect(rec.openingLine).toMatch(/입장을 고르면/);
        }
      }
    }
  });

  it('추천 조건을 "적용"할 때 찾는 추천 문구·추천 답변은 항상 참가자 입장(side)과 같은 쪽이다', () => {
    for (const scenario of scenarios) {
      for (const side of sides) {
        for (const confirmed of subsets(scenario.conditions.map((c) => c.id))) {
          const stances = scriptedStances(scenario, {
            stage: 'REACTIONS',
            opinions: [opinionWith(side, confirmed)],
            followUpUsed: false,
            followUpAnswered: true,
          });
          const rec = buildConditionRecommendation(scenario, confirmed, side, 'scripted', stances);
          for (const id of [...rec.rows.map((r) => r.conditionId), ...rec.bundles.flatMap((b) => b.conditionIds)]) {
            const phrase = findPhraseForCondition(scenario, id, side);
            if (phrase) expect((phrase.side ?? 'FOR'), `${scenario.id}/${side}/${id} 문구`).toBe(side);
            const index = findFollowUpIndexForCondition(scenario, id, side);
            if (index >= 0) expect((scenario.followUp.options[index]?.side ?? 'FOR'), `${scenario.id}/${side}/${id} 답변`).toBe(side);
          }
        }
      }
    }
  });
});

describe('T115 live 경로 전수(제안 조건·발언 입장이 확정 조건과 어긋나는 조합)', () => {
  const allStances: Stance[][] = [];
  const kinds: Stance[] = ['FOR', 'AGAINST', 'UNDECIDED'];
  for (const a of kinds) for (const b of kinds) for (const c of kinds) for (const d of kinds) allStances.push([a, b, c, d]);

  for (const scenario of scenarios) {
    for (const side of sides) {
      it(`${scenario.id} · ${side}: 확정 조건 재제안·목표 쪽 임원 추천·빈 문장이 없다`, () => {
        const ids = scenario.conditions.map((c) => c.id);
        const targetStance: Stance = side === 'AGAINST' ? 'AGAINST' : 'FOR';
        for (const confirmed of subsets(ids)) {
          // 제안 조건이 확정 조건과 겹치는 경우(⊂ 확정), 전부 미확정인 경우, 비어 있는 경우를 모두 돈다.
          const hintSets: Array<string[] | undefined> = [undefined, [], confirmed, ids, ids.filter((id) => !confirmed.includes(id))];
          for (const arr of allStances) {
            const stances = { CEO: arr[0]!, CFO: arr[1]!, CAIO: arr[2]!, CISO: arr[3]! } as Record<ExecMemberId, Stance>;
            for (const hints of hintSets) {
              const suggested = hints ? { CEO: hints, CFO: hints, CAIO: hints, CISO: hints } : undefined;
              const rec = buildConditionRecommendation(scenario, confirmed, side, 'live', stances, suggested);
              const where = `${scenario.id}/${side}/[${confirmed}]/${arr}/hints=${hints}`;
              expect(rec.openingLine.trim().length, where).toBeGreaterThan(0);
              expect(rec.openingLine, where).not.toMatch(/undefined|''|'\s*'/);
              for (const row of rec.rows) {
                expect(confirmed, `${where} 확정 조건 재제안 ${row.conditionId}`).not.toContain(row.conditionId);
                expect(row.label.length, where).toBeGreaterThan(0);
                expect(row.movedMemberIds.length, where).toBeGreaterThan(0);
                for (const m of row.movedMemberIds) expect(stances[m], `${where} ${m}`).not.toBe(targetStance);
              }
            }
          }
        }
      });
    }
  }
});
