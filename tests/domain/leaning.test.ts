// T118: 첫 의견 뒤 기울어진 방향(leaningStances). 표결 규칙표를 읽기만 하는 순수 계산이다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario as ai } from '../../src/content/scenarios/aiApproval';
import { leaningStances } from '../../src/domain/stance';
import type { ExecMemberId } from '../../src/content/types';
import type { Opinion, Stance } from '../../src/domain/types';

const ALL = ['LIMIT', 'REVIEW', 'LOG', 'OWNER'];
const op = (ids: string[], stance: 'FOR' | 'AGAINST'): Opinion => ({
  id: 'o',
  originalText: '',
  selectedPhraseIds: [],
  confirmedConditionIds: ids,
  stance,
  createdAt: 0,
});
const reactions = (opinions: Opinion[], extra: object = {}) => ({
  stage: 'REACTIONS' as const,
  opinions,
  followUpUsed: false,
  followUpAnswered: false,
  ...extra,
});
const undecided: Record<ExecMemberId, Stance> = { CEO: 'UNDECIDED', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' };

describe('leaningStances', () => {
  it('찬성 참가자: 조건이 맞아 답변만 남은 CFO·CAIO·CISO가 찬성 쪽으로 기울고 CEO는 기울음이 없다', () => {
    expect(leaningStances(ai, reactions([op(ALL, 'FOR')]))).toEqual({ CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' });
  });

  it('반대 참가자(대칭): 조건으로 돌아설 CEO가 반대 쪽으로 기운다', () => {
    expect(leaningStances(ai, reactions([op(['FULL_AUTO'], 'AGAINST')])).CEO).toBe('AGAINST');
  });

  it('조건이 미충족이면 기울음이 없다', () => {
    expect(leaningStances(ai, reactions([op([], 'FOR')]))).toEqual({});
    expect(leaningStances(ai, reactions([op(['LOG'], 'FOR')]))).toEqual({ CAIO: 'FOR' });
  });

  it('REACTIONS 이외 단계와 답변을 마친 뒤에는 비어 있다(MOTION·VOTE 봉인 유지)', () => {
    const opinions = [op(ALL, 'FOR')];
    for (const stage of ['OPINIONS', 'DISCUSS', 'MOTION', 'VOTE', 'RESULT'] as const) {
      expect(leaningStances(ai, { ...reactions(opinions), stage })).toEqual({});
    }
    expect(leaningStances(ai, reactions(opinions, { followUpUsed: true }))).toEqual({});
    expect(leaningStances(ai, reactions([]))).toEqual({});
  });

  it('live: 모델 stance가 UNDECIDED인 임원도 규칙표로 조건이 맞으면 기운다', () => {
    expect(leaningStances(ai, reactions([op(ALL, 'FOR')], { mode: 'live' }), undecided)).toEqual({
      CFO: 'FOR',
      CAIO: 'FOR',
      CISO: 'FOR',
    });
  });

  it('live: 모델이 이미 찬성·반대로 말한 임원은 그대로 두고, 조건이 모자라면 기울지 않는다', () => {
    const current: Record<ExecMemberId, Stance> = { ...undecided, CFO: 'AGAINST', CAIO: 'FOR' };
    expect(leaningStances(ai, reactions([op(ALL, 'FOR')], { mode: 'live' }), current)).toEqual({
      CISO: 'FOR',
    });
    expect(leaningStances(ai, reactions([op([], 'FOR')], { mode: 'live' }), undecided)).toEqual({});
  });
});
