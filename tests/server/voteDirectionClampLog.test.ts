// T138(Codex P2): 방향 재요청도 일반 재시도처럼 캐시 토큰·형식 오류 원인·시도 횟수를 로그에 합산한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallLogEntry } from '../../server/log';

const logged: CallLogEntry[] = [];
vi.mock('../../server/log', () => ({
  logCall: (entry: CallLogEntry) => {
    logged.push(entry);
  },
}));

import { handleVote, type VoteRequest } from '../../server/handlers/vote';
import type { ModelProvider } from '../../server/providers/types';

type Step = { kind: 'invalid' } | { kind: 'vote'; vote: 'YES' | 'NO' } | { kind: 'error' };

function provider(steps: Step[]): { provider: ModelProvider; calls: () => number } {
  let call = 0;
  return {
    calls: () => call,
    provider: {
      async complete(req) {
        const step = steps[Math.min(call, steps.length - 1)]!;
        call += 1;
        const usage = { cacheReadInputTokens: 10 * call, cacheCreationInputTokens: 100 * call };
        if (step.kind === 'error') throw new Error('network down');
        const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: step.kind === 'invalid' ? 'wrong-hash' : envelope.motionHash,
            vote: step.kind === 'vote' ? step.vote : 'YES',
            reason: '이유입니다.', evidenceIds: [], remainingConcerns: [],
          },
          modelId: 'fake', usage,
        };
      },
    },
  };
}

function input(): VoteRequest {
  return {
    sessionId: 's', requestId: 'r', mode: 'live', scenarioId: 'ai-approval', budgetMs: 15000,
    transcript: { revision: 1, statements: [] },
    motion: { id: 'm1', hash: 'h1', text: '안건', effectiveConditionIds: ['AG_AUDIT'], executionMode: 'DEFAULT' },
    participantStance: 'AGAINST', followUpAnswered: true, roleIds: ['CFO'],
  };
}

beforeEach(() => {
  logged.length = 0;
});

// 안건 ① AG_AUDIT: 규칙표상 CFO는 찬성(YES).
describe('방향 재요청의 로그 합산', () => {
  it('형식 오류 → 일반 재시도(틀린 표) → 방향 재요청(맞는 표): 형식 오류 원인이 남고 토큰이 세 번 모두 합산되며 시도는 3회다', async () => {
    const { provider: p, calls } = provider([{ kind: 'invalid' }, { kind: 'vote', vote: 'NO' }, { kind: 'vote', vote: 'YES' }]);
    const [result] = await handleVote(input(), { provider: p });
    expect(calls()).toBe(3);
    expect(result?.ballot?.vote).toBe('YES');
    expect(result?.ballot?.source).toBeUndefined();
    const entry = logged.find((e) => e.kind === 'vote')!;
    expect(entry.attempts).toBe(3);
    expect(entry.invalidIssues?.length ?? 0).toBeGreaterThan(0);
    expect(entry.cacheReadTokens).toBe(10 + 20 + 30);
    expect(entry.cacheWriteTokens).toBe(100 + 200 + 300);
    expect(entry.note).toBeUndefined();
  });

  it('방향 재요청이 실패해도 그 토큰·시도가 로그에 남고, 첫 응답이 규칙표 표로 교정된다', async () => {
    const { provider: p } = provider([{ kind: 'vote', vote: 'NO' }, { kind: 'error' }]);
    const [result] = await handleVote(input(), { provider: p });
    expect(result?.ballot).toMatchObject({ vote: 'YES', source: 'rules', rulesCause: 'direction' });
    const entry = logged.find((e) => e.kind === 'vote')!;
    expect(entry.attempts).toBe(2);
    expect(entry.note).toBe('vote_direction_clamped');
    // 실패한 호출은 토큰을 돌려주지 않으므로 첫 호출 값이 그대로다.
    expect(entry.cacheReadTokens).toBe(10);
  });

  it('방향 재요청이 형식 오류로 오면 그 원인도 합산하고 교정한다', async () => {
    const { provider: p } = provider([{ kind: 'vote', vote: 'NO' }, { kind: 'invalid' }]);
    const [result] = await handleVote(input(), { provider: p });
    expect(result?.ballot).toMatchObject({ vote: 'YES', source: 'rules' });
    const entry = logged.find((e) => e.kind === 'vote')!;
    expect(entry.invalidIssues?.length ?? 0).toBeGreaterThan(0);
    expect(entry.cacheReadTokens).toBe(10 + 20);
    expect(entry.note).toBe('vote_direction_clamped');
  });
});
