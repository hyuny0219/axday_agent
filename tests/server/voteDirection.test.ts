// T137(v20): 반대 참가자 경로의 임원별 표 방향 지시. 규칙표(decideMember) 방향과 항상 일치해야 하고,
// 입력이 모자라거나 찬성 참가자면 지시 없이 기존 공통 규칙으로 되돌아간다.
import { describe, expect, it } from 'vitest';
import { buildVoteDirectionRule, ruleVoteDirection } from '../../server/prompts/voteDirection';

const base = { scenarioId: 'ai-approval', participantStance: 'AGAINST' as const, followUpAnswered: true };
const dir = (roleId: string, ids: string[], extra = {}) =>
  ruleVoteDirection({ ...base, roleId, effectiveConditionIds: ids, ...extra });

describe('ruleVoteDirection(v21)', () => {
  it('반대 조건이 겨눈 임원은 조건 때문에 NO, 겨누지 않은 반대 임원(CFO)은 처음 우려 그대로 NO, 나머지는 약한 조건이라 YES(안건 ①)', () => {
    expect(dir('CAIO', ['AG_AUDIT'])).toBe('NO_BY_CONDITION');
    expect(dir('CFO', ['AG_AUDIT'])).toBe('NO_BASELINE');
    expect(dir('CISO', ['AG_AUDIT'])).toBe('YES_WEAK_CONDITION');
    expect(dir('CEO', ['AG_AUDIT'])).toBe('YES_WEAK_CONDITION');
    expect(dir('CISO', ['AG_TRUST'])).toBe('NO_BY_CONDITION');
    expect(dir('CEO', ['AG_SCALE'])).toBe('NO_BY_CONDITION');
  });

  it('조건이 없는 순수 반대: CFO는 처음 우려로 NO, 나머지는 조건이 없어 YES — 조건을 지어내지 않는다', () => {
    expect(dir('CFO', [])).toBe('NO_BASELINE');
    for (const roleId of ['CEO', 'CAIO', 'CISO']) expect(dir(roleId, [])).toBe('YES_NO_CONDITION');
    const text = buildVoteDirectionRule('YES_NO_CONDITION') ?? '';
    expect(text).toContain('설득할 만한 조건을 내지 않았습니다');
    expect(text).toContain('지어내지 마십시오');
    const baseline = buildVoteDirectionRule('NO_BASELINE') ?? '';
    expect(baseline).toContain('처음 우려가 그대로');
    expect(baseline).not.toContain('그 조건이 왜 우려를 키우는지');
  });

  it('안건 ②도 같다', () => {
    const ef = { scenarioId: 'experience-first' };
    expect(dir('CAIO', ['AG_WARN'], ef)).toBe('NO_BY_CONDITION');
    expect(dir('CISO', ['AG_WHY'], ef)).toBe('NO_BY_CONDITION');
    expect(dir('CEO', ['AG_SPLIT'], ef)).toBe('NO_BY_CONDITION');
    expect(dir('CEO', ['AG_WARN', 'AG_WHY'], ef)).toBe('YES_WEAK_CONDITION');
    expect(dir('CFO', [], ef)).toBe('NO_BASELINE');
  });

  it('반대 쪽 조건을 모두 내면 네 임원 모두 조건 때문에(또는 처음 우려로) 반대 — 함정은 없다(T138)', () => {
    const all = ['AG_AUDIT', 'AG_TRUST', 'AG_SCALE'];
    for (const roleId of ['CEO', 'CAIO', 'CISO']) expect(dir(roleId, all)).toBe('NO_BY_CONDITION');
    expect(dir('CFO', all)).toBe('NO_BASELINE');
  });

  it('추가 질문에 답하지 않았으면 조건으로 돌아선 임원도 처음 표(YES)로 돌아간다', () => {
    expect(dir('CAIO', ['AG_AUDIT'], { followUpAnswered: false })).toBe('YES_WEAK_CONDITION');
  });

  it('찬성 참가자·입장 없음·모르는 안건·모르는 역할은 null(공통 규칙으로 폴백, 찬성 경로 그대로)', () => {
    expect(dir('CAIO', ['LOG'], { participantStance: 'FOR' })).toBeNull();
    expect(dir('CAIO', [], { participantStance: undefined })).toBeNull();
    expect(dir('CAIO', [], { scenarioId: 'nope' })).toBeNull();
    expect(dir('XXXX', [])).toBeNull();
    expect(buildVoteDirectionRule(null)).toBeNull();
  });
});

describe('buildVoteDirectionRule(v21)', () => {
  it('모든 문구는 규칙표 값·ID를 싣지 않고, 조건이 있는 문구는 "안건을 바꾸지 않는다"를 알린다', () => {
    for (const direction of ['NO_BY_CONDITION', 'NO_BASELINE', 'YES_WEAK_CONDITION', 'YES_NO_CONDITION'] as const) {
      const text = buildVoteDirectionRule(direction) ?? '';
      expect(text).not.toMatch(/AG_|decideMember|voteRules/);
      if (direction !== 'NO_BASELINE') expect(text).toContain('안건 문장을 바꾸지 않습니다');
    }
    expect(buildVoteDirectionRule('NO_BY_CONDITION')).toContain('반대(NO)입니다');
    expect(buildVoteDirectionRule('YES_WEAK_CONDITION')).toContain('찬성(YES)입니다');
  });
});
