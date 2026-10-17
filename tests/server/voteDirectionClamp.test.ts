// T138(v23): 반대 참가자 경로에서 live 표가 규칙표 방향과 다르면 방향을 다시 알려 한 번 더 요청하고, 그래도 다르면
// 규칙표 표(source 'rules')로 바꾼다. 찬성 참가자 경로·방향이 맞는 표는 건드리지 않는다.
import { describe, expect, it } from 'vitest';
import { handleVote, type VoteRequest } from '../../server/handlers/vote';
import type { ModelCompleteRequest, ModelProvider } from '../../server/providers/types';

function provider(votes: Array<'YES' | 'NO' | 'ERROR'>, systems: string[] = []): ModelProvider {
  let call = 0;
  return {
    async complete(req: ModelCompleteRequest) {
      systems.push(req.system);
      const vote = votes[Math.min(call, votes.length - 1)];
      call += 1;
      if (vote === 'ERROR') throw new Error('network down');
      const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
      return {
        json: {
          roleId: envelope.roleId, motionId: envelope.motionId, motionHash: envelope.motionHash,
          vote, reason: '모델이 쓴 이유입니다.', evidenceIds: ['E3'], remainingConcerns: ['남은 우려'],
        },
        modelId: 'fake-model',
        usage: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      };
    },
  };
}

function input(overrides: Partial<VoteRequest> = {}): VoteRequest {
  return {
    sessionId: 's', requestId: 'r', mode: 'live', scenarioId: 'ai-approval', budgetMs: 8000,
    transcript: { revision: 1, statements: [] },
    motion: {
      id: 'm1', hash: 'h1', text: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다.',
      effectiveConditionIds: ['AG_AUDIT'], executionMode: 'DEFAULT',
    },
    participantStance: 'AGAINST', followUpAnswered: true, roleIds: ['CFO'],
    ...overrides,
  };
}

// 안건 ① 조건 AG_AUDIT: 규칙표상 CFO는 찬성(약한 조건), CAIO는 반대.
describe('반대 참가자 경로 표결 방향 교정', () => {
  it('방향이 맞으면 한 번만 요청하고 그대로 둔다', async () => {
    const systems: string[] = [];
    const [result] = await handleVote(input(), { provider: provider(['YES'], systems) });
    expect(systems).toHaveLength(1);
    expect(result?.ballot?.vote).toBe('YES');
    expect(result?.ballot?.source).toBeUndefined();
  });

  it('틀린 표가 오면 방향 재확인 문구를 붙여 한 번 더 요청하고, 맞게 오면 그 표를 쓴다', async () => {
    const systems: string[] = [];
    const [result] = await handleVote(input(), { provider: provider(['NO', 'YES'], systems) });
    expect(systems).toHaveLength(2);
    expect(systems[0]).not.toContain('직전 응답의 표가 위 방향 지시와 달랐습니다');
    expect(systems[1]).toContain('직전 응답의 표가 위 방향 지시와 달랐습니다');
    expect(systems[1]).toContain('찬성(YES)표를 던지십시오');
    expect(result?.ballot?.vote).toBe('YES');
    expect(result?.ballot?.source).toBeUndefined();
    expect(result?.ballot?.reason).toBe('모델이 쓴 이유입니다.');
  });

  it('두 번 다 틀리면 규칙표 표와 규칙표 이유로 바꾸고 source rules·rulesCause direction을 남긴다', async () => {
    const [result] = await handleVote(input(), { provider: provider(['NO', 'NO']) });
    expect(result?.status).toBe('answered');
    expect(result?.ballot).toMatchObject({
      vote: 'YES', source: 'rules', rulesCause: 'direction', reason: '내건 조건이 약해 안건대로 찬성합니다',
      evidenceIds: [], remainingConcerns: [],
    });
  });

  it('첫 표가 틀렸는데 재요청이 실패해도 첫 응답을 규칙표 표로 교정한다', async () => {
    const [result] = await handleVote(input(), { provider: provider(['NO', 'ERROR']) });
    expect(result?.ballot).toMatchObject({ vote: 'YES', source: 'rules', rulesCause: 'direction' });
  });

  it('조건이 겨눈 임원(CAIO)은 반대(NO)가 규칙표 방향이고, 찬성으로 오면 교정한다', async () => {
    const [result] = await handleVote(input({ roleIds: ['CAIO'] }), { provider: provider(['YES', 'YES']) });
    expect(result?.ballot).toMatchObject({ vote: 'NO', source: 'rules', reason: '승인 이유를 확인할 수 없다는 지적이 맞아 반대합니다' });
  });

  it('찬성 참가자 경로는 교정하지 않는다(표가 무엇이든 한 번만 요청)', async () => {
    const systems: string[] = [];
    const [result] = await handleVote(input({ participantStance: 'FOR' }), { provider: provider(['NO'], systems) });
    expect(systems).toHaveLength(1);
    expect(result?.ballot?.vote).toBe('NO');
    expect(result?.ballot?.source).toBeUndefined();
  });

  it('입장이 없는 요청도 교정하지 않는다', async () => {
    const [result] = await handleVote(input({ participantStance: undefined }), { provider: provider(['NO']) });
    expect(result?.ballot?.source).toBeUndefined();
  });
});
