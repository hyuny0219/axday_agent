import { describe, expect, it } from 'vitest';
import { collectConfirmedConditionIds, collectParticipantStance } from '../../src/components/opinionConditions';
import type { Opinion, ParticipantStance } from '../../src/domain/types';

function opinion(
  id: string,
  confirmedConditionIds: string[],
  createdAt: number,
  stance: ParticipantStance = null,
): Opinion {
  return { id, originalText: id, selectedPhraseIds: [], confirmedConditionIds, stance, createdAt };
}

describe('collectConfirmedConditionIds', () => {
  it('의견이 없으면 빈 배열', () => {
    expect(collectConfirmedConditionIds([])).toEqual([]);
  });

  it('의견이 하나면 그 확정 목록을 순서대로 돌려준다', () => {
    expect(collectConfirmedConditionIds([opinion('o1', ['ACCESS', 'REVIEW'], 1)])).toEqual([
      'ACCESS',
      'REVIEW',
    ]);
  });

  it('후속 의견에서 이전 조건을 해제하면 최종 목록에서 빠진다', () => {
    const opinions = [opinion('o1', ['ACCESS'], 1), opinion('o2', ['REVIEW'], 2)];
    expect(collectConfirmedConditionIds(opinions)).toEqual(['REVIEW']);
  });

  it('후속 의견에서 이전 조건을 유지하면 그대로 남는다', () => {
    const opinions = [opinion('o1', ['ACCESS'], 1), opinion('o2', ['ACCESS', 'REVIEW'], 2)];
    expect(collectConfirmedConditionIds(opinions)).toEqual(['ACCESS', 'REVIEW']);
  });

  it('중복 ID는 한 번만', () => {
    expect(collectConfirmedConditionIds([opinion('o1', ['PILOT', 'PILOT'], 1)])).toEqual(['PILOT']);
  });
});

// T92: 참가자 입장. 가장 최근 의견의 stance를 그대로 쓴다(합집합이 아니다).
describe('collectParticipantStance', () => {
  it('의견이 없으면 null', () => {
    expect(collectParticipantStance([])).toBe(null);
  });

  it('가장 최근 의견의 stance를 돌려준다', () => {
    const opinions = [opinion('o1', [], 1, 'FOR'), opinion('o2', [], 2, 'AGAINST')];
    expect(collectParticipantStance(opinions)).toBe('AGAINST');
  });

  it('최근 의견이 입장을 고르지 않았으면(null) null', () => {
    const opinions = [opinion('o1', [], 1, 'AGAINST'), opinion('o2', [], 2, null)];
    expect(collectParticipantStance(opinions)).toBe(null);
  });
});
