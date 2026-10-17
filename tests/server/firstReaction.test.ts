// 프롬프트 v16(T132): 첫 반응(REACTIONS)에서 임원마다 다른 stance 지시를 붙인다.

import { describe, expect, it } from 'vitest';
import { handleRound, roundRequestSchema, type RoundRequest } from '../../server/handlers/round';
import { buildFirstReactionRule, classifyFirstReaction } from '../../server/prompts/firstReaction';
import { REACTIONS_FIRST_PASS_RULE } from '../../server/prompts/common';
import { createMockProvider } from '../../server/providers/mock';
import type { ModelProvider } from '../../server/providers/types';

const ALL_CONDITIONS = ['LIMIT', 'REVIEW', 'LOG', 'OWNER'];

describe('classifyFirstReaction', () => {
  it('(a) 처음부터 참가자와 같은 편이면 SAME_SIDE', () => {
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CEO',
        participantStance: 'FOR',
        confirmedConditionIds: [],
        priorStance: 'FOR',
      }),
    ).toBe('SAME_SIDE');
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CFO',
        participantStance: 'AGAINST',
        confirmedConditionIds: [],
        priorStance: 'AGAINST',
      }),
    ).toBe('SAME_SIDE');
  });

  it('(b) 이번 조건으로 표가 참가자 쪽으로 넘어갈 수 있으면 MAY_CROSS', () => {
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CFO',
        participantStance: 'FOR',
        confirmedConditionIds: ALL_CONDITIONS,
        priorStance: 'AGAINST',
      }),
    ).toBe('MAY_CROSS');
  });

  it('(c) 조건이 없거나 우려가 안 풀리면 KEEP', () => {
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CFO',
        participantStance: 'FOR',
        confirmedConditionIds: [],
        priorStance: 'AGAINST',
      }),
    ).toBe('KEEP');
  });

  it('(d2) 반대 참가자의 찬성 쪽 조건(LIMIT+REVIEW)을 이어받은 반대 참가자는 CFO가 목표 반대편으로 가 REVERSED이고, 지시는 FOR 쪽이다(T137)', () => {
    const kind = classifyFirstReaction({
      scenarioId: 'ai-approval',
      roleId: 'CFO',
      participantStance: 'AGAINST',
      confirmedConditionIds: ['LIMIT', 'REVIEW'],
      priorStance: 'AGAINST',
    });
    expect(kind).toBe('REVERSED');
    expect(buildFirstReactionRule(kind, 'AGAINST')).toContain('stance를 FOR로');
  });

  it('(d3) 반대 근거가 겨눈 고민 중·찬성 임원은 MAY_CROSS, 겨누지 않은 임원은 KEEP이다(T137)', () => {
    const base = { scenarioId: 'ai-approval', participantStance: 'AGAINST' as const, confirmedConditionIds: ['AG_AUDIT'] };
    expect(classifyFirstReaction({ ...base, roleId: 'CAIO', priorStance: 'UNDECIDED' })).toBe('MAY_CROSS');
    expect(classifyFirstReaction({ ...base, roleId: 'CISO', priorStance: 'UNDECIDED' })).toBe('KEEP');
    expect(classifyFirstReaction({ ...base, roleId: 'CEO', priorStance: 'FOR' })).toBe('KEEP');
    expect(classifyFirstReaction({ ...base, roleId: 'CFO', priorStance: 'AGAINST' })).toBe('SAME_SIDE');
    expect(
      classifyFirstReaction({ ...base, roleId: 'CEO', priorStance: 'FOR', confirmedConditionIds: ['AG_SCALE'] }),
    ).toBe('MAY_CROSS');
  });

  it('(d) 조건 때문에 표가 참가자에게서 멀어지는 임원은 같은 편이어도 REVERSED(함정 조건)', () => {
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CEO',
        participantStance: 'FOR',
        confirmedConditionIds: ['FULL_AUTO'],
        priorStance: 'FOR',
      }),
    ).toBe('REVERSED');
    expect(
      classifyFirstReaction({
        scenarioId: 'experience-first',
        roleId: 'CEO',
        participantStance: 'FOR',
        confirmedConditionIds: ['EXP_ONLY'],
        priorStance: 'FOR',
      }),
    ).toBe('REVERSED');
    // 같은 조건이어도 규칙표가 움직이지 않는 임원은 그대로 같은 편이다.
    expect(
      classifyFirstReaction({
        scenarioId: 'ai-approval',
        roleId: 'CFO',
        participantStance: 'FOR',
        confirmedConditionIds: ['FULL_AUTO'],
        priorStance: 'FOR',
      }),
    ).toBe('SAME_SIDE');
  });

  it('판정에 필요한 값이 없으면 null(공통 규칙으로 폴백)', () => {
    const base = { scenarioId: 'ai-approval', roleId: 'CFO', participantStance: 'FOR' as const };
    expect(classifyFirstReaction({ ...base, confirmedConditionIds: [] })).toBeNull();
    expect(classifyFirstReaction({ ...base, priorStance: 'AGAINST' })).toBeNull();
    expect(
      classifyFirstReaction({ ...base, scenarioId: 'nope', confirmedConditionIds: [], priorStance: 'AGAINST' }),
    ).toBeNull();
  });
});

describe('buildFirstReactionRule', () => {
  it('유형마다 다른 지시를 만들고 null과 MAY_CROSS는 기존 공통 규칙이다', () => {
    expect(buildFirstReactionRule(null)).toBe(REACTIONS_FIRST_PASS_RULE);
    // T138: MAY_CROSS는 공통 규칙 위에 "UNDECIDED로 적으십시오" 단정 지시를 더한다.
    expect(buildFirstReactionRule('MAY_CROSS')).toContain(REACTIONS_FIRST_PASS_RULE);
    expect(buildFirstReactionRule('MAY_CROSS')).toContain('반드시 UNDECIDED로 적고');
    expect(buildFirstReactionRule('SAME_SIDE')).toContain('UNDECIDED(고민 중)로 바꾸지 마십시오');
    expect(buildFirstReactionRule('KEEP')).toContain('처음 입장 그대로 유지');
    expect(buildFirstReactionRule('REVERSED')).toContain('받아들이기 어렵다는 쪽');
    expect(buildFirstReactionRule('REVERSED')).toContain('AGAINST');
    expect(buildFirstReactionRule('REVERSED')).not.toContain('바꾸지 마십시오');
    // PR #21 Codex P2: 반대 참가자의 조건이 임원의 우려를 풀어 찬성 쪽으로 가는 REVERSED는 뜻이 반대다.
    const opposed = buildFirstReactionRule('REVERSED', 'AGAINST');
    expect(opposed).toContain('우려를 풀어 줍니다');
    expect(opposed).toContain('stance를 FOR로');
    expect(opposed).not.toContain('키웁니다');
    expect(opposed).not.toContain('받아들이기 어렵다');
    expect(buildFirstReactionRule('REVERSED', 'FOR')).toBe(buildFirstReactionRule('REVERSED'));
    expect(buildFirstReactionRule('SAME_SIDE')).not.toContain('UNDECIDED(고민 중)까지만');
    expect(buildFirstReactionRule('KEEP')).not.toContain('UNDECIDED(고민 중)까지만');
  });
});

function capture(): { systems: Record<string, string>; provider: ModelProvider } {
  const systems: Record<string, string> = {};
  const provider: ModelProvider = {
    async complete(req) {
      const roleId = (JSON.parse(req.user) as { roleId?: string }).roleId ?? '?';
      systems[roleId] = req.system;
      return createMockProvider('mock-model').complete(req);
    },
  };
  return { systems, provider };
}

function input(overrides: Partial<RoundRequest>): RoundRequest {
  return {
    sessionId: 's',
    requestId: 'r',
    mode: 'live',
    stage: 'REACTIONS',
    transcript: { revision: 0, statements: [] },
    participantOpinion: '조건을 붙여 찬성합니다.',
    participantStance: 'FOR',
    scenarioId: 'ai-approval',
    budgetMs: 8000,
    ...overrides,
  };
}

describe('REACTIONS 시스템 프롬프트의 임원별 첫 반응 지시', () => {
  it('요청 스키마가 확정 조건·임원별 첫 의견 입장을 선택 필드로 받는다', () => {
    expect(roundRequestSchema.safeParse(input({})).success).toBe(true);
    expect(
      roundRequestSchema.safeParse(
        input({ confirmedConditionIds: ['LIMIT'], priorStances: { CEO: 'FOR', CFO: 'UNDECIDED' } }),
      ).success,
    ).toBe(true);
  });

  it('임원마다 다른 지시가 붙는다', async () => {
    const { systems, provider } = capture();
    await handleRound(
      input({
        confirmedConditionIds: ALL_CONDITIONS,
        priorStances: { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'UNDECIDED', CISO: 'FOR' },
      }),
      { provider },
    );
    expect(systems.CEO).toContain('바꾸지 마십시오');
    expect(systems.CFO).toContain('UNDECIDED(고민 중)까지만');
    expect(systems.CISO).toContain('바꾸지 마십시오');
  });

  it('조건이 없으면 반대 임원은 처음 입장 유지 지시를 받는다', async () => {
    const { systems, provider } = capture();
    await handleRound(
      input({ confirmedConditionIds: [], priorStances: { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' } }),
      { provider },
    );
    expect(systems.CFO).toContain('처음 입장 AGAINST(반대 쪽) 그대로입니다');
    expect(systems.CFO).not.toContain('UNDECIDED(고민 중)까지만');
  });

  it('함정 조건이 붙으면 CEO는 입장 유지 대신 REVERSED 지시를 받고 나머지는 그대로다', async () => {
    const { systems, provider } = capture();
    await handleRound(
      input({
        confirmedConditionIds: ['FULL_AUTO'],
        priorStances: { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' },
      }),
      { provider },
    );
    expect(systems.CEO).toContain('받아들이기 어렵다는 쪽');
    expect(systems.CEO).not.toContain('바꾸지 마십시오');
    expect(systems.CFO).toContain('바꾸지 마십시오');
  });

  it('priorStances에 빠진 임원만 공통 규칙으로 폴백한다', async () => {
    const { systems, provider } = capture();
    await handleRound(
      input({ confirmedConditionIds: [], priorStances: { CEO: 'FOR', CFO: 'AGAINST' } }),
      { provider },
    );
    expect(systems.CEO).toContain('바꾸지 마십시오');
    expect(systems.CFO).toContain('처음 입장 AGAINST(반대 쪽) 그대로입니다');
    expect(systems.CAIO).toContain(REACTIONS_FIRST_PASS_RULE);
    expect(systems.CISO).toContain(REACTIONS_FIRST_PASS_RULE);
  });

  it('값이 없으면 v15 공통 규칙으로 폴백한다', async () => {
    const { systems, provider } = capture();
    await handleRound(input({}), { provider });
    for (const role of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      expect(systems[role]).toContain(REACTIONS_FIRST_PASS_RULE);
    }
  });

  it('OPINIONS 단계에는 첫 반응 지시가 붙지 않는다', async () => {
    const { systems, provider } = capture();
    await handleRound(input({ stage: 'OPINIONS', confirmedConditionIds: [], priorStances: { CFO: 'AGAINST' } }), { provider });
    expect(systems.CFO).not.toContain('첫 반응');
  });
});
