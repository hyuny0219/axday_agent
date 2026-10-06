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
    scenarioId: 'ai-approval',
    budgetMs: 8000,
    transcript: {
      revision: 1,
      statements: [{ id: 's1', roleId: 'CEO', message: '작은 범위로 시작합시다.' }],
    },
    motion: {
      id: 'work-assistant-original',
      hash: 'motion-hash-1',
      text: '여러 부서 자료를 연결해 주간 보고서를 자동 작성·공유하는 AI 업무 비서를 도입한다.',
      effectiveConditionIds: ['LIMIT'],
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

// PR #13 Codex 1차 검토 P2: CONDITION_IDS는 안건①·②의 합집합이라, 스키마만으로는 다른
// 안건의 조건(예: 안건①에 SCOPE)도 모양상 통과한다. motion.effectiveConditionIds는
// scenarioId가 가리키는 안건 자신의 조건이어야만 유효하다 — 요청 방향 검증.
describe('voteRequestSchema의 안건별 조건 검증(PR #13 Codex 1차 검토 P2)', () => {
  it('안건①(ai-approval) 요청에 안건②의 조건(SCOPE)이 섞이면 거부한다', () => {
    const input = baseVoteInput({
      requestId: 'req-foreign-1',
      scenarioId: 'ai-approval',
      motion: {
        id: 'm1',
        hash: 'h1',
        text: '안건',
        effectiveConditionIds: ['SCOPE'],
        executionMode: 'DEFAULT',
      },
    });
    const result = voteRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('안건②(experience-first) 요청에 안건①의 조건(LIMIT)이 섞이면 거부한다', () => {
    const input = baseVoteInput({
      requestId: 'req-foreign-2',
      scenarioId: 'experience-first',
      motion: {
        id: 'm2',
        hash: 'h2',
        text: '안건',
        effectiveConditionIds: ['LIMIT'],
        executionMode: 'DEFAULT',
      },
    });
    const result = voteRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('각 안건 자신의 조건 ID만 실으면 통과한다', () => {
    const aiApproval = baseVoteInput({
      requestId: 'req-valid-1',
      scenarioId: 'ai-approval',
      motion: {
        id: 'm3',
        hash: 'h3',
        text: '안건',
        effectiveConditionIds: ['LIMIT', 'REVIEW'],
        executionMode: 'DEFAULT',
      },
    });
    expect(voteRequestSchema.safeParse(aiApproval).success).toBe(true);

    const experienceFirst = baseVoteInput({
      requestId: 'req-valid-2',
      scenarioId: 'experience-first',
      motion: {
        id: 'm4',
        hash: 'h4',
        text: '안건',
        effectiveConditionIds: ['SCOPE', 'REVIEW'],
        executionMode: 'DEFAULT',
      },
    });
    expect(voteRequestSchema.safeParse(experienceFirst).success).toBe(true);
  });

  it('알 수 없는 scenarioId는 조건 검증을 건너뛴다(handleVote가 별도로 unknown_scenario를 던진다)', () => {
    const input = baseVoteInput({
      requestId: 'req-unknown-scenario',
      scenarioId: 'not-a-scenario',
      motion: {
        id: 'm5',
        hash: 'h5',
        text: '안건',
        effectiveConditionIds: ['LIMIT'],
        executionMode: 'DEFAULT',
      },
    });
    expect(voteRequestSchema.safeParse(input).success).toBe(true);
  });
});

// PR #13 Codex 2차 검토 P1: 실제 createMockProvider(server/providers/mock.ts)가 두 안건
// 모두에서 임원 4명 전원 answered를 돌려주는지 확인한다. 표결 응답에는 조건 ID가 없어
// (evidenceIds만 있고 둘 다 E1~E4 공유) round만큼 깨지기 쉽지 않았지만, 카드 지시대로
// round와 같이 명시적으로 확인해 둔다.
describe('실제 mock 제공자가 두 안건 모두에서 깨끗하게 동작하는지(PR #13 Codex 2차 검토 P1)', () => {
  it.each(['ai-approval', 'experience-first'] as const)(
    '%s에서 임원 4명 모두 answered를 돌려준다',
    async (scenarioId) => {
      const provider = createMockProvider('mock-model');
      const input = baseVoteInput({
        requestId: `req-mock-clean-${scenarioId}`,
        scenarioId,
        motion: {
          id: `m-${scenarioId}`,
          hash: `h-${scenarioId}`,
          text: '안건',
          effectiveConditionIds: [],
          executionMode: 'DEFAULT',
        },
      });
      const results = await handleVote(input, { provider });
      expect(results).toHaveLength(4);
      expect(results.every((r) => r.status === 'answered')).toBe(true);
    },
  );
});
