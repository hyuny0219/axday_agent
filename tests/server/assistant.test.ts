// server/handlers/assistant.ts: refine·summarize가 draftRevision을 그대로 돌려받아야
// 채택하고, 벗어난 응답은 invalid_response로 거절함을 확인한다. AGENT_BOARDROOM_SPEC.md 4·5장.

import { describe, expect, it } from 'vitest';
import {
  handleAssistantRefine,
  handleAssistantSummarize,
  type AssistantRefineRequest,
  type AssistantSummarizeRequest,
} from '../../server/handlers/assistant';
import { createMockProvider } from '../../server/providers/mock';
import type { ModelProvider } from '../../server/providers/types';

function baseRefineInput(overrides: Partial<AssistantRefineRequest> = {}): AssistantRefineRequest {
  return {
    sessionId: 'session-1',
    requestId: 'req-refine-default',
    mode: 'live',
    scenarioId: 'ai-assistant',
    budgetMs: 5000,
    draftText: '아직 검증되지 않아 바로 진행하지 않겠습니다.',
    draftRevision: 0,
    ...overrides,
  };
}

function baseSummarizeInput(overrides: Partial<AssistantSummarizeRequest> = {}): AssistantSummarizeRequest {
  return {
    sessionId: 'session-1',
    requestId: 'req-summarize-default',
    mode: 'live',
    scenarioId: 'ai-assistant',
    budgetMs: 5000,
    transcript: {
      revision: 2,
      statements: [{ id: 's1', roleId: 'CEO', message: '작은 범위로 시작합시다.' }],
    },
    ...overrides,
  };
}

describe('handleAssistantRefine with the mock provider', () => {
  it('mock 응답의 draftRevision이 요청과 같으면 answered로 받는다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseRefineInput({ requestId: 'req-1', draftRevision: 3 });
    const result = await handleAssistantRefine(input, { provider });
    expect(result.status).toBe('answered');
    expect(result.draftText).toBeTruthy();
    expect(result.evidenceIds).toBeDefined();
    expect(result.suggestedConditionIds).toBeDefined();
  });

  it('모델이 다른 draftRevision을 돌려주면 invalid_response로 거절한다', async () => {
    const fakeProvider: ModelProvider = {
      async complete() {
        return {
          json: {
            draftRevision: 999,
            draftText: '정리된 문장',
            evidenceIds: ['E1'],
            suggestedConditionIds: ['PILOT'],
          },
          modelId: 'fake-model',
        };
      },
    };
    const input = baseRefineInput({ requestId: 'req-2', draftRevision: 1 });
    const result = await handleAssistantRefine(input, { provider: fakeProvider });
    expect(result.status).toBe('failed');
    expect(result.failReason).toBe('invalid_response');
  });

  it('알 수 없는 scenarioId는 예외를 던진다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseRefineInput({ requestId: 'req-3', scenarioId: 'unknown-scenario' });
    await expect(handleAssistantRefine(input, { provider })).rejects.toThrow('unknown_scenario:unknown-scenario');
  });

  it('mock 장애 주입(timeout)은 failed:timeout으로 남는다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseRefineInput({ requestId: 'req-4', budgetMs: 30, mock: 'timeout' });
    const result = await handleAssistantRefine(input, { provider });
    expect(result.status).toBe('failed');
    expect(result.failReason).toBe('timeout');
  });
});

describe('handleAssistantSummarize with the mock provider', () => {
  it('mock 응답의 draftRevision이 transcript.revision과 같으면 answered로 받는다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseSummarizeInput({ requestId: 'req-5', transcript: { revision: 7, statements: [] } });
    const result = await handleAssistantSummarize(input, { provider });
    expect(result.status).toBe('answered');
    expect(result.draftText).toBeTruthy();
  });

  it('알 수 없는 scenarioId는 예외를 던진다', async () => {
    const provider = createMockProvider('mock-model');
    const input = baseSummarizeInput({ requestId: 'req-6', scenarioId: 'unknown-scenario' });
    await expect(handleAssistantSummarize(input, { provider })).rejects.toThrow(
      'unknown_scenario:unknown-scenario',
    );
  });
});
