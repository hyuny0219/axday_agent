// T138(v22): 첫 의견(OPINIONS)·첫 반응(REACTIONS)에서 모델이 단정 지시를 어기고 stance를 다른 쪽으로 적으면, 문장이
// 방향을 밝히지 않았을 때 서버가 stance만 규칙표 분류대로 교정한다. 문장이 방향을 밝혔으면 T115(문장 우선)를 따른다.
import { describe, expect, it } from 'vitest';
import { handleRound, type RoundRequest } from '../../server/handlers/round';
import type { ModelProvider } from '../../server/providers/types';
import { buildFirstReactionRule, clampFirstReactionStance } from '../../server/prompts/firstReaction';

function provider(message: string, stance: string, systems: string[] = []): ModelProvider {
  return {
    async complete(req) {
      systems.push(req.system);
      const envelope = JSON.parse(req.user) as { roleId: string };
      return {
        json: {
          roleId: envelope.roleId, message, evidenceIds: [], referencedStatementIds: [],
          concerns: [], suggestedConditionIds: [], stance,
        },
        modelId: 'fake-model',
        usage: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      };
    },
  };
}

function input(overrides: Partial<RoundRequest>): RoundRequest {
  return {
    sessionId: 's', requestId: 'r', mode: 'live', stage: 'REACTIONS', transcript: { revision: 0, statements: [] },
    scenarioId: 'ai-approval', budgetMs: 8000, ...overrides,
  };
}

const stanceOf = async (req: RoundRequest, message: string, returned: string, roleId: 'CEO' | 'CFO' | 'CAIO' | 'CISO') => {
  const results = await handleRound({ ...req, roleIds: [roleId] }, { provider: provider(message, returned) });
  return results[0]?.statement?.stance;
};

describe('OPINIONS — 처음 입장 교정', () => {
  const opinions = input({ stage: 'OPINIONS' });
  it('처음 입장이 고민 중인 CFO가 AGAINST로 적어도 문장이 방향을 밝히지 않았으면 UNDECIDED로 교정한다', async () => {
    expect(await stanceOf(opinions, '규칙을 벗어난 승인이 4건 있었습니다. 금액 한도와 확인 절차가 있으면 따르겠습니다.', 'AGAINST', 'CFO')).toBe('UNDECIDED');
  });
  it('처음 입장과 같으면 그대로, 문장이 방향을 밝혔으면 교정하지 않는다', async () => {
    expect(await stanceOf(opinions, '이유가 안 남아 걱정입니다.', 'UNDECIDED', 'CAIO')).toBe('UNDECIDED');
    expect(await stanceOf(opinions, '이대로는 반대합니다.', 'AGAINST', 'CAIO')).toBe('AGAINST');
    // 처음부터 반대인 CISO는 반대 그대로다.
    expect(await stanceOf(opinions, '기록과 책임질 사람이 먼저 필요합니다.', 'AGAINST', 'CISO')).toBe('AGAINST');
  });
  it('OPINIONS 프롬프트가 처음 입장을 stance 필드로 단정한다', async () => {
    const systems: string[] = [];
    await handleRound({ ...opinions, roleIds: ['CFO'] }, { provider: provider('걱정입니다.', 'UNDECIDED', systems) });
    expect(systems[0]).toContain('이번 첫 의견의 stance는 UNDECIDED로 적으십시오');
  });
});

describe('REACTIONS 첫 반응 — 규칙표 분류대로 교정', () => {
  const againstAudit = input({
    participantStance: 'AGAINST',
    confirmedConditionIds: ['AG_AUDIT'],
    priorStances: { CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'AGAINST' },
  });
  it('KEEP(조건이 겨누지 않은 CEO): AGAINST로 바꿔 적어도 FOR로 되돌린다', async () => {
    expect(await stanceOf(againstAudit, '결재가 밀리는 문제는 그대로 큽니다. 지켜보겠습니다.', 'AGAINST', 'CEO')).toBe('FOR');
  });
  it('MAY_CROSS(조건이 겨눈 CAIO): AGAINST로 확정해도 UNDECIDED로 낮춘다', async () => {
    expect(await stanceOf(againstAudit, '이유가 안 남는 점은 맞습니다. 하나만 더 묻겠습니다.', 'AGAINST', 'CAIO')).toBe('UNDECIDED');
    expect(await stanceOf(againstAudit, '이유가 안 남는 점은 맞습니다. 하나만 더 묻겠습니다.', 'UNDECIDED', 'CAIO')).toBe('UNDECIDED');
  });
  it('참가자에게 상대적인 "동의합니다"는 방향 선언이 아니라서 교정을 막지 않는다', async () => {
    expect(
      await stanceOf(againstAudit, '말씀하신 점에 동의합니다. 하지만 기록이 없다는 점이 더 큰 문제입니다.', 'AGAINST', 'CFO'),
    ).toBe('UNDECIDED');
  });
  it('SAME_SIDE(처음부터 같은 편 CISO)는 처음 입장 그대로', async () => {
    expect(await stanceOf(againstAudit, '저도 기록이 걱정입니다.', 'UNDECIDED', 'CISO')).toBe('AGAINST');
  });
  it('문장이 방향을 밝혔으면 교정하지 않는다(T115 우선)', async () => {
    expect(await stanceOf(againstAudit, '이대로는 반대합니다.', 'AGAINST', 'CEO')).toBe('AGAINST');
  });
  it('입력(priorStances·확정 조건)이 없으면 교정하지 않는다', async () => {
    expect(await stanceOf(input({ participantStance: 'AGAINST' }), '지켜보겠습니다.', 'AGAINST', 'CEO')).toBe('AGAINST');
  });
});

describe('단정 지시 문구·clamp 순수 함수', () => {
  it('KEEP은 처음 입장을 값으로 박고, MAY_CROSS는 UNDECIDED로 단정한다', () => {
    expect(buildFirstReactionRule('KEEP', 'AGAINST', 'FOR')).toContain('반드시 FOR로 적고');
    expect(buildFirstReactionRule('KEEP', 'AGAINST', 'UNDECIDED')).toContain('반드시 UNDECIDED로 적고');
    const may = buildFirstReactionRule('MAY_CROSS', 'AGAINST', 'UNDECIDED');
    expect(may).toContain('stance는 UNDECIDED(고민 중)입니다');
    expect(may).toContain('FOR나 AGAINST로 확정하지 마십시오');
  });
  it('clampFirstReactionStance', () => {
    expect(clampFirstReactionStance('KEEP', 'FOR', 'AGAINST', 'AGAINST')).toBe('FOR');
    expect(clampFirstReactionStance('KEEP', 'FOR', 'AGAINST', 'FOR')).toBeNull();
    expect(clampFirstReactionStance('SAME_SIDE', 'AGAINST', 'AGAINST', 'UNDECIDED')).toBe('AGAINST');
    expect(clampFirstReactionStance('MAY_CROSS', 'UNDECIDED', 'FOR', 'FOR')).toBe('UNDECIDED');
    expect(clampFirstReactionStance('MAY_CROSS', 'AGAINST', 'FOR', 'AGAINST')).toBeNull();
    expect(clampFirstReactionStance('REVERSED', 'FOR', 'AGAINST', 'AGAINST')).toBeNull();
    expect(clampFirstReactionStance(null, undefined, undefined, 'FOR')).toBeNull();
  });
});
