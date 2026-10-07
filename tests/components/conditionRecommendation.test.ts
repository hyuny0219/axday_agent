// AI 비서실장 "조건 추천"(T96)이 쓰는 순수 함수. requiredConditionsFor와 scenario.reactions
// 문구를 조합해 "움직이는 임원"·"푸는 걱정"을 계산하는지 확인한다.
//
// Codex 27차 검토 P2-1·P2-4 반영: (1) 복합 조합(LIMIT+REVIEW 둘 다 있어야 하는 CFO 등)이
// 필요한 임원은 단일 조건 행에 끼지 않고 bundles로 따로 나온다. (4) "아직 찬성이 아닌
// 임원"은 scripted여도 stances(실제 표정)로 가른다 — live는 scripted 규칙표가 아니라
// stances·liveSuggestedConditionIds를 우선 쓴다.

import { describe, expect, it } from 'vitest';
import { buildConditionRecommendation } from '../../src/components/conditionRecommendation';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { scriptedStances } from '../../src/domain/stance';
import type { Stance } from '../../src/domain/types';
import type { ExecMemberId } from '../../src/content/types';

const scenario = aiApprovalScenario;

describe('buildConditionRecommendation(T96, 안건①, scripted)', () => {
  it('조건이 없으면 LOG 단독으로 CAIO만 움직이고, CFO(LIMIT+REVIEW)·CISO(OWNER+LOG)는 묶음으로 따로 나온다', () => {
    const stances = scriptedStances(scenario, { stage: 'DISCUSS', opinions: [] });
    const result = buildConditionRecommendation(scenario, [], 'FOR', 'scripted', stances);
    const byId = new Map(result.rows.map((row) => [row.conditionId, row]));

    // 단일 조건 행 — LOG 하나만으로 실제로 표가 바뀌는 임원만 CAIO다.
    expect(byId.get('LOG')?.movedMemberIds).toEqual(['CAIO']);
    // LIMIT·REVIEW·OWNER는 단독으로 아무도 못 움직이므로 행 자체가 없다(묶음으로만 보인다).
    expect(byId.has('LIMIT')).toBe(false);
    expect(byId.has('REVIEW')).toBe(false);
    expect(byId.has('OWNER')).toBe(false);

    // 복합 조합 묶음(requiredConditionsFor는 scenario.conditions 순서로 조합을 찾으므로
    // CISO는 LOG가 OWNER보다 앞서 'LOG+OWNER' 순서로 나온다).
    const bundleByKey = new Map(result.bundles.map((b) => [b.conditionIds.join('+'), b]));
    expect(bundleByKey.get('LIMIT+REVIEW')?.movedMemberIds).toEqual(['CFO']);
    expect(bundleByKey.get('LOG+OWNER')?.movedMemberIds).toEqual(['CISO']);

    // "푸는 걱정"은 scenario.reactions 문구를 그대로 가져온다.
    expect(byId.get('LOG')?.worry).toContain('승인 사유를 남기면');
  });

  it('오프닝 한 줄에 아직 찬성이 아닌 임원 코드와 필요 조건 라벨(단일+묶음)이 들어간다', () => {
    const stances = scriptedStances(scenario, { stage: 'DISCUSS', opinions: [] });
    const result = buildConditionRecommendation(scenario, [], 'FOR', 'scripted', stances);
    expect(result.openingLine).toContain('CFO');
    expect(result.openingLine).toContain('CAIO');
    expect(result.openingLine).toContain('CISO');
    expect(result.openingLine).toContain('승인 사유 기록'); // LOG 라벨(단일)
    expect(result.openingLine).toContain('결재 금액 한도 + 사람 표본 재검토'); // LIMIT+REVIEW 묶음
  });

  it('LOG·OWNER를 모두 확정하면 CAIO·CISO는 이미 찬성이라 빠지고, CFO는 LIMIT+REVIEW 묶음만 남는다', () => {
    const opinions = [
      {
        id: 'op1',
        originalText: '',
        selectedPhraseIds: [],
        confirmedConditionIds: ['LOG', 'OWNER'],
        createdAt: 0,
      },
    ];
    const stances = scriptedStances(scenario, { stage: 'REACTIONS', opinions });
    const result = buildConditionRecommendation(scenario, ['LOG', 'OWNER'], 'FOR', 'scripted', stances);

    // 단일 조건으로는(LIMIT만, REVIEW만) CFO가 움직이지 않으므로 rows는 비어 있다.
    expect(result.rows).toEqual([]);
    expect(result.bundles).toHaveLength(1);
    const [bundle] = result.bundles;
    expect(bundle?.conditionIds).toEqual(['LIMIT', 'REVIEW']);
    expect(bundle?.movedMemberIds).toEqual(['CFO']);
    expect(result.openingLine).toContain('CFO');
    expect(result.openingLine).not.toContain('CAIO');
  });

  it('임원 4명 모두 찬성이면 오프닝 한 줄이 그렇게 말하고 rows·bundles는 비어 있다', () => {
    const opinions = [
      {
        id: 'op1',
        originalText: '',
        selectedPhraseIds: [],
        confirmedConditionIds: ['LIMIT', 'REVIEW', 'LOG', 'OWNER'],
        createdAt: 0,
      },
    ];
    const stances = scriptedStances(scenario, { stage: 'REACTIONS', opinions });
    const result = buildConditionRecommendation(
      scenario,
      ['LIMIT', 'REVIEW', 'LOG', 'OWNER'],
      'FOR',
      'scripted',
      stances,
    );
    expect(result.openingLine).toBe('지금 임원 4명 모두 찬성 쪽입니다.');
    expect(result.rows).toEqual([]);
    expect(result.bundles).toEqual([]);
  });
});

describe('buildConditionRecommendation(T96, live 모드, Codex 27차 검토 P2-4)', () => {
  it('live는 scripted 규칙표가 아니라 실제 stances로 "아직 찬성이 아닌 임원"을 가른다', () => {
    // scripted 규칙표라면 조건 없이 CFO·CAIO·CISO가 모두 아직 찬성이 아니지만, live는
    // 임원 에이전트가 실제로 찬성했다고 응답한 상태(stances)를 그대로 따른다.
    const liveStances: Record<ExecMemberId, Stance> = {
      CEO: 'FOR',
      CFO: 'FOR',
      CAIO: 'UNDECIDED',
      CISO: 'AGAINST',
    };
    const result = buildConditionRecommendation(scenario, [], 'FOR', 'live', liveStances);
    expect(result.openingLine).toContain('CISO');
    expect(result.openingLine).toContain('CAIO');
    expect(result.openingLine).not.toContain('CFO');
  });

  it('live는 임원 발언의 suggestedConditionIds가 있으면 그 값을 우선 쓰고 규칙표로 대체하지 않는다', () => {
    const liveStances: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'AGAINST' };
    const result = buildConditionRecommendation(scenario, [], 'FOR', 'live', liveStances, {
      CISO: ['LOG'],
    });
    const byId = new Map(result.rows.map((row) => [row.conditionId, row]));
    expect(byId.get('LOG')?.movedMemberIds).toEqual(['CISO']);
    expect(result.usedRuleFallback).toBe(false);
  });

  it('live에서 발언 제안이 없으면 scripted 규칙표 값을 참고로 쓰고 usedRuleFallback이 true다', () => {
    const liveStances: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'AGAINST' };
    const result = buildConditionRecommendation(scenario, [], 'FOR', 'live', liveStances);
    expect(result.usedRuleFallback).toBe(true);
  });
});
