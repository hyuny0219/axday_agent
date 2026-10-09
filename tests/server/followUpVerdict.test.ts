// T114: FOLLOWUP 발언에 방향 단어(찬성·반대·가결·부결)가 남으면 서버가 거절·재시도하고, 그래도 남으면
// 그 임원 발언만 중립 문장으로 대체한다(로그 note: followup_verdict_masked).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRound, type RoundRequest } from '../../server/handlers/round';
import type { ModelProvider } from '../../server/providers/types';
import { findVerdictWords, maskedFollowUpMessage } from '../../src/domain/verdictWords';

afterEach(() => {
  vi.restoreAllMocks();
});

function input(overrides: Partial<RoundRequest> = {}): RoundRequest {
  return {
    sessionId: 'session-verdict',
    requestId: 'req-verdict',
    mode: 'live',
    stage: 'FOLLOWUP',
    transcript: { revision: 0, statements: [] },
    scenarioId: 'ai-approval',
    budgetMs: 8000,
    roleIds: ['CFO'],
    followUpAnswered: true,
    ...overrides,
  };
}

function providerReturning(messages: string[]): { provider: ModelProvider; calls: () => number } {
  let calls = 0;
  const provider: ModelProvider = {
    async complete(req) {
      const message = messages[Math.min(calls, messages.length - 1)] as string;
      calls += 1;
      const envelope = JSON.parse(req.user) as { roleId: string };
      return {
        json: {
          roleId: envelope.roleId,
          message,
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'AGAINST',
        },
        modelId: 'fake-model',
        usage: { cacheReadInputTokens: 10, cacheCreationInputTokens: 1 },
      };
    },
  };
  return { provider, calls: () => calls };
}

describe('findVerdictWords', () => {
  it('방향 단어를 찾고 일반 문장은 통과시킨다', () => {
    expect(findVerdictWords('찬성합니다. 반대표는 던지지 않습니다.')).toEqual(['찬성', '반대']);
    expect(findVerdictWords('가결이든 부결이든 따르겠습니다.')).toEqual(['가결', '부결']);
    expect(findVerdictWords('답변을 잘 들었습니다. 근거가 분명해졌습니다.')).toEqual([]);
  });
});

describe('FOLLOWUP 방향 단어 서버 방어(T114)', () => {
  it('첫 응답에 방향 단어가 있어도 재시도 응답이 깨끗하면 그 응답을 쓴다', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider, calls } = providerReturning(['이번에는 찬성합니다.', '답변을 잘 들었습니다.']);
    const [result] = await handleRound(input(), { provider });
    expect(calls()).toBe(2);
    expect(result?.status).toBe('answered');
    expect(result?.statement?.message).toBe('답변을 잘 들었습니다.');
    const logged = JSON.parse(log.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(logged.attempts).toBe(2);
    expect(logged.note).toBeUndefined();
  });

  it('재시도에서도 방향 단어가 있으면 중립 문장으로 대체하고 stance는 유지하며 로그에 표시한다', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider, calls } = providerReturning(['반대로 남겠습니다.', '역시 반대표를 던지겠습니다.']);
    const [result] = await handleRound(input(), { provider });
    expect(calls()).toBe(2);
    expect(result?.status).toBe('answered');
    expect(result?.statement?.message).toBe(maskedFollowUpMessage('CFO'));
    expect(findVerdictWords(result?.statement?.message ?? '')).toEqual([]);
    expect(result?.statement?.stance).toBe('AGAINST');
    const logged = JSON.parse(log.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(logged.note).toBe('followup_verdict_masked');
    expect(logged.status).toBe('answered');
    expect(logged.attempts).toBe(2);
    expect(logged.cacheReadTokens).toBe(20);
  });

  it('방향 단어가 없으면 한 번만 부르고 그대로 쓴다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider, calls } = providerReturning(['답변을 잘 들었습니다.']);
    const [result] = await handleRound(input(), { provider });
    expect(calls()).toBe(1);
    expect(result?.statement?.message).toBe('답변을 잘 들었습니다.');
  });

  it('FOLLOWUP이 아닌 단계는 검사하지 않는다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider, calls } = providerReturning(['처음부터 반대 의견입니다.']);
    const [result] = await handleRound(input({ stage: 'OPINIONS', followUpAnswered: undefined }), { provider });
    expect(calls()).toBe(1);
    expect(result?.statement?.message).toBe('처음부터 반대 의견입니다.');
  });
});
