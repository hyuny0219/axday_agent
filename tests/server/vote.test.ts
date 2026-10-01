// server/handlers/vote.ts: motionHash 전달·불일치 거절, 참가자 표·다른 임원 표를 절대
// 포함하지 않음을 확인한다. AGENT_BOARDROOM_SPEC.md 3·5·6장.

import { describe, expect, it } from 'vitest';
import { handleVote, voteRequestSchema, type VoteRequest } from '../../server/handlers/vote';
import { createMockProvider } from '../../server/providers/mock';
import type { ModelProvider } from '../../server/providers/types';

function baseVoteInput(overrides: Partial<VoteRequest> = {}): VoteRequest {
  return {
    sessionId: 'session-1',
    requestId: 'req-vote-default',
    mode: 'live',
    scenarioId: 'anon-board',
    budgetMs: 8000,
    transcript: {
      revision: 1,
      statements: [{ id: 's1', roleId: 'CEO', message: '작은 범위로 시작합시다.' }],
    },
    motion: {
      id: 'work-assistant-original',
      hash: 'motion-hash-1',
      text: '여러 부서 자료를 연결해 주간 보고서를 자동 작성·공유하는 AI 업무 비서를 도입한다.',
      effectiveConditionIds: ['PILOT'],
      executionMode: 'pilot',
    },
    ...overrides,
  };
}

describe('handleVote with the mock provider', () => {
  it('고정된 motionId/motionHash를 각 임원에게 전달하고 그대로 돌아오면 채택한다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseVoteInput({ requestId: 'req-1' });
    const results = await handleVote(input, { provider });
    expect(results).toHaveLength(4);
    for (const result of results) {
      expect(result.status).toBe('answered');
      expect(result.ballot?.motionId).toBe(input.motion.id);
      expect(result.ballot?.motionHash).toBe(input.motion.hash);
      expect(['YES', 'NO']).toContain(result.ballot?.vote);
    }
  });

  it('모델이 다른 motionHash를 반환하면 그 임원은 failed:invalid_response로 거절된다', async () => {
    const fakeProvider: ModelProvider = {
      async complete(req) {
        const envelope = JSON.parse(req.user) as { roleId: string; motionId: string };
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: 'a-different-hash',
            vote: 'YES',
            reason: '근거가 충분합니다.',
            evidenceIds: ['E1'],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      },
    };
    const input = baseVoteInput({ requestId: 'req-2' });
    const results = await handleVote(input, { provider: fakeProvider });
    expect(results.every((r) => r.status === 'failed')).toBe(true);
    expect(results.every((r) => r.failReason === 'invalid_response')).toBe(true);
  });

  it('모델이 다른 motionId를 반환하면 그 임원은 failed:invalid_response로 거절된다', async () => {
    const fakeProvider: ModelProvider = {
      async complete(req) {
        const envelope = JSON.parse(req.user) as { roleId: string; motionHash: string };
        return {
          json: {
            roleId: envelope.roleId,
            motionId: 'a-different-motion-id',
            motionHash: envelope.motionHash,
            vote: 'YES',
            reason: '근거가 충분합니다.',
            evidenceIds: ['E1'],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      },
    };
    const input = baseVoteInput({ requestId: 'req-3' });
    const results = await handleVote(input, { provider: fakeProvider });
    expect(results.every((r) => r.status === 'failed')).toBe(true);
  });

  it('참가자 표나 다른 임원의 표를 요청 본문·모델 프롬프트 어디에도 포함하지 않는다', async () => {
    const calls: { system: string; user: string }[] = [];
    const fakeProvider: ModelProvider = {
      async complete(req) {
        calls.push({ system: req.system, user: req.user });
        const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: envelope.motionHash,
            vote: 'NO',
            reason: '추가 확인이 필요합니다.',
            evidenceIds: ['E1'],
            remainingConcerns: ['권한 검증'],
          },
          modelId: 'fake-model',
        };
      },
    };
    const input = baseVoteInput({ requestId: 'req-4' });

    // 타입 수준에서도 VoteRequest에는 참가자 표·다른 임원 표 필드가 없다.
    // @ts-expect-error VoteRequest에는 participantVote 필드가 존재하지 않는다.
    input.participantVote = 'YES';

    const results = await handleVote(input, { provider: fakeProvider });
    expect(results.every((r) => r.status === 'answered')).toBe(true);
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      // transcript 발언에는 roleId·message만 있고 vote 값이 없으므로, 실제 표 데이터
      // (YES/NO)는 오직 이 역할 자신에게 요청하는 지시문에만 등장해야 한다.
      expect(call.system).not.toMatch(/참가자[^\n]*(YES|NO)/);
      expect(call.system).not.toMatch(/participantVote/i);
      expect(call.user).not.toMatch(/participantVote/i);
      expect(call.user).not.toMatch(/YES|NO/);
    }
  });

  it('알 수 없는 scenarioId는 예외를 던진다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseVoteInput({ requestId: 'req-5', scenarioId: 'not-a-scenario' });
    await expect(handleVote(input, { provider })).rejects.toThrow('unknown_scenario');
  });

  it('roleIds가 있으면 그 역할만 호출한다("미표결 임원 다시 요청", T65)', async () => {
    const calls: string[] = [];
    const fakeProvider: ModelProvider = {
      async complete(req) {
        const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
        calls.push(envelope.roleId);
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: envelope.motionHash,
            vote: 'YES',
            reason: '재요청 판단입니다.',
            evidenceIds: [],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      },
    };
    const input = baseVoteInput({ requestId: 'req-retry-1', roleIds: ['CAIO'] });
    const results = await handleVote(input, { provider: fakeProvider });

    expect(calls).toEqual(['CAIO']);
    expect(results).toHaveLength(1);
    expect(results[0]?.roleId).toBe('CAIO');
    expect(results[0]?.status).toBe('answered');
  });

  it('deps.timeoutMs로 타임아웃 상한을 바꿀 수 있다(T65, 기본은 ROUND_TIMEOUT_MS 8000)', async () => {
    const timeoutsSeen: number[] = [];
    const fakeProvider: ModelProvider = {
      async complete(req) {
        timeoutsSeen.push(req.timeoutMs);
        const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: envelope.motionHash,
            vote: 'YES',
            reason: '판단입니다.',
            evidenceIds: [],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      },
    };
    await handleVote(baseVoteInput({ requestId: 'req-timeout-default', budgetMs: 999_999 }), {
      provider: fakeProvider,
    });
    await handleVote(baseVoteInput({ requestId: 'req-timeout-custom', budgetMs: 999_999 }), {
      provider: fakeProvider,
      timeoutMs: 3000,
    });
    expect(timeoutsSeen[0]).toBe(8000);
    expect(timeoutsSeen[4]).toBe(3000);
  });
});

describe('voteRequestSchema roleIds(PR #11 Codex 21차 P1)', () => {
  it('중복 역할·4개 초과는 거부하고, 고유한 1~4개만 받는다', () => {
    const base = baseVoteInput({ requestId: 'req-schema' });
    expect(voteRequestSchema.safeParse({ ...base, roleIds: ['CAIO', 'CAIO'] }).success).toBe(false);
    expect(voteRequestSchema.safeParse({ ...base, roleIds: ['CEO', 'CFO', 'CAIO', 'CISO', 'CFO'] }).success).toBe(false);
    expect(voteRequestSchema.safeParse({ ...base, roleIds: ['CAIO'] }).success).toBe(true);
  });
});
