// T137(v20): 반대 참가자 경로의 임원별 표 방향 지시. 규칙표(decideMember) 방향과 항상 일치해야 하고,
// 입력이 모자라거나 찬성 참가자면 지시 없이 기존 공통 규칙으로 되돌아간다.
import { describe, expect, it } from 'vitest';
import { buildVoteDirectionRule, ruleVoteDirection } from '../../server/prompts/voteDirection';

const base = { scenarioId: 'ai-approval', participantStance: 'AGAINST' as const, followUpAnswered: true };
const dir = (roleId: string, ids: string[], extra = {}) =>
  ruleVoteDirection({ ...base, roleId, effectiveConditionIds: ids, ...extra });

describe('ruleVoteDirection(v20)', () => {
  it('반대 조건이 겨눈 임원은 NO, 나머지 고민 중·찬성 임원은 YES(안건 ①)', () => {
    expect(dir('CAIO', ['AG_AUDIT'])).toBe('NO');
    expect(dir('CISO', ['AG_AUDIT'])).toBe('YES');
    expect(dir('CEO', ['AG_AUDIT'])).toBe('YES');
    expect(dir('CISO', ['AG_TRUST'])).toBe('NO');
    expect(dir('CEO', ['AG_SCALE'])).toBe('NO');
    expect(dir('CFO', [])).toBe('NO');
  });

  it('안건 ②도 같다', () => {
    const ef = { scenarioId: 'experience-first' };
    expect(dir('CAIO', ['AG_WARN'], ef)).toBe('NO');
    expect(dir('CISO', ['AG_WHY'], ef)).toBe('NO');
    expect(dir('CEO', ['AG_SPLIT'], ef)).toBe('NO');
    expect(dir('CEO', ['AG_WARN', 'AG_WHY'], ef)).toBe('YES');
  });

  it('반대 쪽 함정은 네 임원 모두 YES', () => {
    for (const roleId of ['CEO', 'CFO', 'CAIO', 'CISO']) expect(dir(roleId, ['AG_BAN', 'AG_AUDIT'])).toBe('YES');
    for (const roleId of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      expect(dir(roleId, ['AG_NUMBERS'], { scenarioId: 'experience-first' })).toBe('YES');
    }
  });

  it('추가 질문에 답하지 않았으면 조건으로 돌아선 임원도 처음 표(YES)로 돌아간다', () => {
    expect(dir('CAIO', ['AG_AUDIT'], { followUpAnswered: false })).toBe('YES');
  });

  it('찬성 참가자·입장 없음·모르는 안건·모르는 역할은 null(공통 규칙으로 폴백, 찬성 경로 그대로)', () => {
    expect(dir('CAIO', ['LOG'], { participantStance: 'FOR' })).toBeNull();
    expect(dir('CAIO', [], { participantStance: undefined })).toBeNull();
    expect(dir('CAIO', [], { scenarioId: 'nope' })).toBeNull();
    expect(dir('XXXX', [])).toBeNull();
    expect(buildVoteDirectionRule(null)).toBeNull();
  });
});

describe('buildVoteDirectionRule(v20)', () => {
  it('두 방향 모두 "조건은 안건을 바꾸지 않는다"를 알리고, ID·규칙표 값을 싣지 않는다', () => {
    for (const direction of ['YES', 'NO'] as const) {
      const text = buildVoteDirectionRule(direction) ?? '';
      expect(text).toContain('안건 문장을 바꾸지 않습니다');
      expect(text).toContain('원안에 조건이 하나도 없다');
      expect(text).not.toMatch(/AG_|decideMember|voteRules/);
    }
    expect(buildVoteDirectionRule('NO')).toContain('반대(NO)입니다');
    expect(buildVoteDirectionRule('YES')).toContain('찬성(YES)입니다');
  });
});
