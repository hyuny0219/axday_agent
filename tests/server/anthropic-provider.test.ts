// server/providers/anthropic.ts: system을 content 블록 배열로 보내고 마지막(유일한) 블록에
// cache_control: { type: 'ephemeral' }를 붙이는지, 응답 usage의 캐시 토큰 수를
// ModelCompleteUsage로 옮기는지 확인한다(T91). @anthropic-ai/sdk는 모킹한다 — 실제 키 호출은
// 하지 않는다.

import { afterEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();

class FakeAPIError extends Error {}

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class FakeAnthropic {
      messages = { create: createMock };
      static APIError = FakeAPIError;
    },
  };
});

describe('createAnthropicProvider(T91)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createMock.mockReset();
  });

  it('system을 cache_control이 붙은 단일 텍스트 블록 배열로 보낸다', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null },
    });
    const { createAnthropicProvider } = await import('../../server/providers/anthropic');
    const provider = createAnthropicProvider({ modelId: 'claude-sonnet-5' });

    await provider.complete({
      system: '공통 가드레일 + 역할 프롬프트',
      user: 'ok',
      schema: { type: 'object' },
      maxTokens: 100,
      timeoutMs: 5000,
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const callArgs = createMock.mock.calls[0]?.[0] as { system: unknown };
    expect(callArgs.system).toEqual([
      { type: 'text', text: '공통 가드레일 + 역할 프롬프트', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('응답 usage의 캐시 적중·생성 토큰 수를 ModelCompleteUsage로 옮긴다', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
    });
    const { createAnthropicProvider } = await import('../../server/providers/anthropic');
    const provider = createAnthropicProvider({ modelId: 'claude-sonnet-5' });

    const result = await provider.complete({
      system: '시스템',
      user: 'ok',
      schema: { type: 'object' },
      maxTokens: 100,
      timeoutMs: 5000,
    });

    expect(result.usage?.cacheReadInputTokens).toBe(800);
    expect(result.usage?.cacheCreationInputTokens).toBe(0);
  });

  it('캐시 토큰 필드가 null이면 undefined로 옮긴다', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null },
    });
    const { createAnthropicProvider } = await import('../../server/providers/anthropic');
    const provider = createAnthropicProvider({ modelId: 'claude-sonnet-5' });

    const result = await provider.complete({
      system: '시스템',
      user: 'ok',
      schema: { type: 'object' },
      maxTokens: 100,
      timeoutMs: 5000,
    });

    expect(result.usage?.cacheReadInputTokens).toBeUndefined();
    expect(result.usage?.cacheCreationInputTokens).toBeUndefined();
  });
});
