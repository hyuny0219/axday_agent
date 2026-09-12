// server/providers/mock.ts: 역할·단계별 결정적 응답과 timeout|invalid|late|refusal 장애 주입.

import { describe, expect, it } from 'vitest';
import { createMockProvider, parseMockFault } from '../../server/providers/mock';
import { ModelRefusalError } from '../../server/providers/types';

function baseRequest(user: string, overrides: Partial<{ timeoutMs: number; signal: AbortSignal }> = {}) {
  return {
    system: 'system prompt',
    user,
    schema: {},
    maxTokens: 200,
    timeoutMs: overrides.timeoutMs ?? 50,
    signal: overrides.signal,
  };
}

describe('createMockProvider deterministic responses', () => {
  it('returns the same statement JSON for the same role/stage every time', async () => {
    const provider = createMockProvider('mock-model');
    const user = JSON.stringify({ kind: 'statement', roleId: 'CEO', stage: 'OPINIONS' });
    const first = await provider.complete(baseRequest(user));
    const second = await provider.complete(baseRequest(user));
    expect(first.json).toEqual(second.json);
    expect(first.modelId).toBe('mock-model');
    const message = first.json as { roleId: string; evidenceIds: string[]; suggestedConditionIds: string[] };
    expect(message.roleId).toBe('CEO');
    expect(message.evidenceIds).toEqual(['E1']);
    expect(message.suggestedConditionIds).toEqual(['PILOT']);
  });

  it('varies deterministically by role for vote responses', async () => {
    const provider = createMockProvider('mock-model');
    const ceoUser = JSON.stringify({ kind: 'vote', roleId: 'CEO', motionId: 'm1', motionHash: 'h1' });
    const cisoUser = JSON.stringify({ kind: 'vote', roleId: 'CISO', motionId: 'm1', motionHash: 'h1' });
    const ceoResult = await provider.complete(baseRequest(ceoUser));
    const cisoResult = await provider.complete(baseRequest(cisoUser));
    expect((ceoResult.json as { vote: string }).vote).toBe('YES');
    expect((cisoResult.json as { vote: string }).vote).toBe('NO');
    expect((ceoResult.json as { motionId: string }).motionId).toBe('m1');
    expect((ceoResult.json as { motionHash: string }).motionHash).toBe('h1');
  });

  it('echoes draftRevision for assistant responses', async () => {
    const provider = createMockProvider('mock-model');
    const user = JSON.stringify({ kind: 'assistant_refine', draftRevision: 3 });
    const result = await provider.complete(baseRequest(user));
    expect((result.json as { draftRevision: number }).draftRevision).toBe(3);
  });
});

describe('createMockProvider fault injection', () => {
  it('throws ModelRefusalError for the refusal fault', async () => {
    const provider = createMockProvider();
    const user = JSON.stringify({ kind: 'vote', roleId: 'CEO', mock: 'refusal' });
    await expect(provider.complete(baseRequest(user))).rejects.toBeInstanceOf(ModelRefusalError);
  });

  it('resolves with a schema-invalid payload for the invalid fault', async () => {
    const provider = createMockProvider();
    const user = JSON.stringify({ kind: 'statement', roleId: 'CEO', mock: 'invalid' });
    const result = await provider.complete(baseRequest(user));
    expect(result.json).not.toHaveProperty('message');
  });

  it('rejects once the timeout budget elapses for the timeout fault', async () => {
    const provider = createMockProvider();
    const user = JSON.stringify({ kind: 'statement', roleId: 'CEO', mock: 'timeout' });
    const start = Date.now();
    await expect(provider.complete(baseRequest(user, { timeoutMs: 20 }))).rejects.toThrow();
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it('rejects immediately when the caller aborts during a timeout fault', async () => {
    const provider = createMockProvider();
    const user = JSON.stringify({ kind: 'statement', roleId: 'CEO', mock: 'timeout' });
    const controller = new AbortController();
    const pending = provider.complete(baseRequest(user, { timeoutMs: 5000, signal: controller.signal }));
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it('resolves valid content only after the timeout budget for the late fault', async () => {
    const provider = createMockProvider();
    const user = JSON.stringify({ kind: 'statement', roleId: 'CEO', stage: 'REACTIONS', mock: 'late' });
    const start = Date.now();
    const result = await provider.complete(baseRequest(user, { timeoutMs: 20 }));
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
    expect((result.json as { roleId: string }).roleId).toBe('CEO');
  });
});

describe('parseMockFault', () => {
  it('accepts known fault names from a header or body value', () => {
    expect(parseMockFault('timeout')).toBe('timeout');
    expect(parseMockFault('invalid')).toBe('invalid');
    expect(parseMockFault('late')).toBe('late');
    expect(parseMockFault('refusal')).toBe('refusal');
  });

  it('ignores unknown values', () => {
    expect(parseMockFault('not-a-fault')).toBeUndefined();
    expect(parseMockFault(undefined)).toBeUndefined();
    expect(parseMockFault(42)).toBeUndefined();
  });
});
