// T92: 순수 반대(조건 없이 안건 자체에 반대) 응답. 사용자 지적 "AI 임원들이 찬성 쪽으로
// 몰고 가는 경향"을 반응 문구에서도 고친다 — "앞서 말씀드린 입장 그대로입니다"만
// 반복하지 않고 임원마다 한 문장씩 답한다.
import { describe, expect, it } from 'vitest';
import { oppositionReactionText, reactionsFor } from '../../src/components/reactionsFor';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';

const scenario = aiApprovalScenario;

describe('oppositionReactionText', () => {
  it('반대 입장 + 조건 없음(순수 반대)이면 임원별 전용 문구를 돌려준다', () => {
    const text = oppositionReactionText(scenario, 'CEO', 'AGAINST', []);
    expect(text).toBe(scenario.oppositionReactions?.CEO);
    expect(text).not.toBe(undefined);
  });

  it('찬성 입장이면 undefined(기존 "none" 반응으로 되돌아간다)', () => {
    expect(oppositionReactionText(scenario, 'CEO', 'FOR', [])).toBe(undefined);
  });

  it('입장을 고르지 않았으면(null) undefined', () => {
    expect(oppositionReactionText(scenario, 'CEO', null, [])).toBe(undefined);
  });

  it('반대 입장이어도 조건이 있으면(조건부 반대) undefined — 조건 기반 반응이 대신 답한다', () => {
    expect(oppositionReactionText(scenario, 'CFO', 'AGAINST', ['LIMIT'])).toBe(undefined);
    expect(reactionsFor(scenario, 'CFO', ['LIMIT']).length).toBeGreaterThan(0);
  });

  it('임원 4명 모두 전용 문구가 있고, "입장 그대로"를 반복하지 않는다', () => {
    for (const memberId of ['CEO', 'CFO', 'CAIO', 'CISO'] as const) {
      const text = oppositionReactionText(scenario, memberId, 'AGAINST', []);
      expect(text).toBeTruthy();
      expect(text).not.toContain('앞서 말씀드린 입장 그대로');
    }
  });
});
