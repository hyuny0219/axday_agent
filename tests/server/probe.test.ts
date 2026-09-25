// server/handlers/probe.ts: 모델 연결 확인(T49). 성공/예외/계약 위반/타임아웃 네 갈래를
// 값으로 돌려주는지 본다(예외를 던지지 않는다).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleProbe, PROBE_TIMEOUT_MS, type ProbeDeps } from '../../server/handlers/probe';
import { createMockProvider } from '../../server/providers/mock';
import type { ModelProvider } from '../../server/providers/types';
import type { Clock } from '../../server/clock';

const fixedClock: Clock = { now: () => 1_000 };

function baseDeps(overrides: Partial<ProbeDeps> = {}): ProbeDeps {
  return {
    provider: createMockProvider('mock-model'),
    config: { provider: 'mock', modelId: 'mock-model' },
    clock: fixedClock,
    ...overrides,
  };
}

describe('handleProbe', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mock 제공자는 성공(ok:true)과 실제 modelId를 돌려준다', async () => {
    const result = await handleProbe(baseDeps());
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.modelId).toBe('mock-model');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('제공자가 예외를 던지면 ok:false와 오류 메시지를 돌려준다', async () => {
    const provider: ModelProvider = {
      complete: () => Promise.reject(new Error('anthropic_api_error 401: invalid x-api-key')),
    };
    const result = await handleProbe(baseDeps({ provider, config: { provider: 'anthropic', modelId: 'claude-sonnet-5' } }));
    expect(result.ok).toBe(false);
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-sonnet-5');
    expect(result.error).toBe('anthropic_api_error 401: invalid x-api-key');
  });

  it('응답이 {ok:true} 계약을 지키지 않으면 ok:false로 남는다', async () => {
    const provider: ModelProvider = {
      complete: () => Promise.resolve({ json: { ok: false }, modelId: 'mock-model' }),
    };
    const result = await handleProbe(baseDeps({ provider }));
    expect(result.ok).toBe(false);
    expect(result.modelId).toBe('mock-model'); // 설정값으로 대체(응답을 신뢰하지 않는다)
    expect(result.error).toBeTruthy();
  });

  it('8초 안에 응답하지 않으면 ok:false·timeout 계열 오류로 끝난다', async () => {
    vi.useFakeTimers();
    const provider: ModelProvider = {
      complete: () => new Promise(() => {}), // 절대 resolve/reject되지 않는다
    };
    const pending = handleProbe(baseDeps({ provider }));
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('handler_timeout');
  });

  it('오류 메시지가 200자를 넘으면 잘라낸다', async () => {
    const longMessage = 'x'.repeat(300);
    const provider: ModelProvider = {
      complete: () => Promise.reject(new Error(longMessage)),
    };
    const result = await handleProbe(baseDeps({ provider }));
    expect(result.error).toHaveLength(200);
  });
});
