// AI 비서실장 "조건 추천"(T96)이 쓰는 순수 함수. requiredConditionsFor와 scenario.reactions
// 문구를 조합해 "움직이는 임원"·"푸는 걱정"을 계산하는지 확인한다.

import { describe, expect, it } from 'vitest';
import { buildConditionRecommendation } from '../../src/components/conditionRecommendation';
import { aiApprovalScenario } from '../../src/content/scenarios';

describe('buildConditionRecommendation(T96, 안건①)', () => {
  it('조건이 없으면 LIMIT·REVIEW가 CFO를, LOG가 CAIO를, OWNER·LOG가 CISO를 움직인다', () => {
    const result = buildConditionRecommendation(aiApprovalScenario, [], 'FOR');
    const byId = new Map(result.rows.map((row) => [row.conditionId, row]));

    expect(byId.get('LIMIT')?.movedMemberIds).toEqual(['CFO']);
    expect(byId.get('REVIEW')?.movedMemberIds).toEqual(['CFO']);
    expect(byId.get('LOG')?.movedMemberIds).toEqual(['CAIO', 'CISO']);
    expect(byId.get('OWNER')?.movedMemberIds).toEqual(['CISO']);
    // "푸는 걱정"은 scenario.reactions 문구를 그대로 가져온다.
    expect(byId.get('LOG')?.worry).toContain('승인 사유를 남기면');
  });

  it('오프닝 한 줄에 아직 찬성이 아닌 임원 코드와 필요 조건 라벨이 들어간다', () => {
    const result = buildConditionRecommendation(aiApprovalScenario, [], 'FOR');
    expect(result.openingLine).toContain('CFO');
    expect(result.openingLine).toContain('CAIO');
    expect(result.openingLine).toContain('CISO');
    expect(result.openingLine).toContain('결재 금액 한도');
  });

  it('LOG·OWNER를 모두 확정하면 CAIO·CISO가 더는 움직일 대상에서 빠진다', () => {
    const result = buildConditionRecommendation(aiApprovalScenario, ['LOG', 'OWNER'], 'FOR');
    const byId = new Map(result.rows.map((row) => [row.conditionId, row]));
    expect(byId.has('LOG')).toBe(false); // 이미 확정한 조건은 추천 목록에서 뺀다.
    expect(byId.get('REVIEW')?.movedMemberIds).toEqual(['CFO']);
    expect(result.openingLine).toContain('CFO');
    expect(result.openingLine).not.toContain('CAIO');
  });

  it('임원 4명 모두 찬성이면 오프닝 한 줄이 그렇게 말하고 rows는 비어 있다', () => {
    const result = buildConditionRecommendation(aiApprovalScenario, ['LIMIT', 'REVIEW', 'LOG', 'OWNER'], 'FOR');
    expect(result.openingLine).toBe('지금 임원 4명 모두 찬성 쪽입니다.');
    expect(result.rows).toEqual([]);
  });
});
