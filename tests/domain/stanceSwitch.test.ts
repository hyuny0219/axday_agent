// T137(Codex P1): 입장 전환 뒤에도 규칙표·표시·안건·live 요청이 같은 조건 집합(새 입장 쪽)만 본다.
import { describe, expect, it } from 'vitest';
import { collectConfirmedConditionIds } from '../../src/components/opinionConditions';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { filterConditionIdsForStance } from '../../src/domain/conditions';
import { scriptedStances } from '../../src/domain/stance';
import type { Opinion } from '../../src/domain/types';

const sc = aiApprovalScenario;
const opinion = (ids: string[], stance: 'FOR' | 'AGAINST' | null): Opinion => ({
  id: 'o', originalText: '의견', selectedPhraseIds: [], confirmedConditionIds: ids, stance, createdAt: 0,
});

describe('filterConditionIdsForStance', () => {
  it('찬성·미선택은 찬성 조건만, 반대는 반대 쪽 조건만 남긴다', () => {
    const ids = ['LOG', 'AG_AUDIT', 'OWNER', 'AG_BAN'];
    expect(filterConditionIdsForStance(sc, ids, 'FOR')).toEqual(['LOG', 'OWNER']);
    expect(filterConditionIdsForStance(sc, ids, null)).toEqual(['LOG', 'OWNER']);
    expect(filterConditionIdsForStance(sc, ids, 'AGAINST')).toEqual(['AG_AUDIT', 'AG_BAN']);
  });
});

describe('입장 전환(반대 → 찬성) — 안건·표시·규칙표가 같은 집합을 본다', () => {
  // 반대로 시작해 AG_AUDIT을 붙였다가 추가 답변에서 찬성으로 바꾸고 LOG를 고른 경우(조건이 이어받아진 상태).
  const opinions = [opinion(['AG_AUDIT'], 'AGAINST'), opinion(['AG_AUDIT', 'LOG'], 'FOR')];

  it('확정 조건(안건·결과·live 요청의 기준)에는 새 입장 쪽 조건만 있다', () => {
    expect(collectConfirmedConditionIds(opinions, sc)).toEqual(['LOG']);
  });

  it('규칙표: AG_AUDIT이 LOG를 덮어 CAIO를 반대로 만들지 않고 CAIO는 찬성이다', () => {
    const stances = scriptedStances(sc, { stage: 'MOTION', opinions, followUpAnswered: true, followUpUsed: true });
    expect(stances.CAIO).toBe('FOR');
  });
});

describe('입장 전환(찬성 → 반대)', () => {
  const opinions = [opinion(['FULL_AUTO'], 'FOR'), opinion(['FULL_AUTO'], 'AGAINST')];

  it('찬성 쪽 조건은 버려지고 규칙표는 조건 없는 반대 경로로 계산한다', () => {
    expect(collectConfirmedConditionIds(opinions, sc)).toEqual([]);
    const stances = scriptedStances(sc, { stage: 'MOTION', opinions, followUpAnswered: true, followUpUsed: true });
    // FULL_AUTO가 남았다면 CEO가 NO였겠지만, 반대 경로에서는 조건 없이 CEO 찬성·고민 중 임원도 찬성이다.
    expect(stances.CEO).toBe('FOR');
    expect(stances.CAIO).toBe('FOR');
  });

  it('시나리오를 모르면(과거 호출) 걸러내지 않는다', () => {
    expect(collectConfirmedConditionIds(opinions)).toEqual(['FULL_AUTO']);
  });
});
