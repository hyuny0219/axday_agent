// server/validate.ts 검증 규칙: unknown ID·길이 초과·hash 불일치·중복 requestId·
// ballot 포함 발언을 모두 거절해야 한다(AGENT_BOARDROOM_SPEC.md 5장).

import { describe, expect, it } from 'vitest';
import {
  RequestIdRegistry,
  assistantResponseSchema,
  requestMetaSchema,
  statementResponseSchema,
  voteResponseSchema,
} from '../../server/validate';

function validStatement() {
  return {
    roleId: 'CEO',
    message: '자료를 검토했고 파일럿 범위로 시작하는 안에 동의합니다.',
    evidenceIds: ['E1'],
    referencedStatementIds: [],
    concerns: ['도입 속도'],
    suggestedConditionIds: ['PILOT'],
  };
}

describe('requestMetaSchema', () => {
  it('accepts a valid meta payload', () => {
    const result = requestMetaSchema.safeParse({
      sessionId: 'session-1',
      requestId: 'req-1',
      roleId: 'CEO',
      mode: 'live',
      stage: 'OPINIONS',
      transcriptRevision: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown stage value', () => {
    const result = requestMetaSchema.safeParse({
      sessionId: 'session-1',
      requestId: 'req-1',
      roleId: 'CEO',
      mode: 'live',
      stage: 'UNKNOWN_STAGE',
      transcriptRevision: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown roleId', () => {
    const result = requestMetaSchema.safeParse({
      sessionId: 'session-1',
      requestId: 'req-1',
      roleId: 'UNKNOWN_ROLE',
      mode: 'live',
      stage: 'OPINIONS',
      transcriptRevision: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('statementResponseSchema', () => {
  it('accepts a well-formed statement response', () => {
    const schema = statementResponseSchema(['s1']);
    const result = schema.safeParse({ ...validStatement(), referencedStatementIds: ['s1'] });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown evidence ID', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({ ...validStatement(), evidenceIds: ['E9'] });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown suggested condition ID', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({ ...validStatement(), suggestedConditionIds: ['NOT_A_CONDITION'] });
    expect(result.success).toBe(false);
  });

  it('rejects a referencedStatementId that is not in the transcript', () => {
    const schema = statementResponseSchema(['s1']);
    const result = schema.safeParse({ ...validStatement(), referencedStatementIds: ['s-ghost'] });
    expect(result.success).toBe(false);
  });

  it('rejects a message over 120 characters', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({ ...validStatement(), message: '가'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects a response that includes a ballot field', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({ ...validStatement(), ballot: { vote: 'YES' } });
    expect(result.success).toBe(false);
  });
});

describe('voteResponseSchema', () => {
  const base = {
    roleId: 'CEO',
    motionId: 'motion-1',
    motionHash: 'abc123',
    vote: 'YES',
    reason: '자료 근거가 충분합니다.',
    evidenceIds: ['E1'],
    remainingConcerns: [],
  };

  it('accepts a well-formed vote response', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    expect(schema.safeParse(base).success).toBe(true);
  });

  it('rejects a mismatched motionHash', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({ ...base, motionHash: 'different-hash' });
    expect(result.success).toBe(false);
  });

  it('rejects a mismatched motionId', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({ ...base, motionId: 'motion-2' });
    expect(result.success).toBe(false);
  });

  it('rejects a reason over 160 characters', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({ ...base, reason: '가'.repeat(161) });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown vote enum value', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({ ...base, vote: 'MAYBE' });
    expect(result.success).toBe(false);
  });
});

describe('assistantResponseSchema', () => {
  const base = {
    draftRevision: 2,
    draftText: '정리된 발언입니다.',
    evidenceIds: ['E2'],
    suggestedConditionIds: ['MEASURE'],
  };

  it('accepts a well-formed assistant response', () => {
    const schema = assistantResponseSchema({ draftRevision: 2 });
    expect(schema.safeParse(base).success).toBe(true);
  });

  it('rejects a mismatched draftRevision', () => {
    const schema = assistantResponseSchema({ draftRevision: 2 });
    const result = schema.safeParse({ ...base, draftRevision: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects draftText over 300 characters', () => {
    const schema = assistantResponseSchema({ draftRevision: 2 });
    const result = schema.safeParse({ ...base, draftText: '가'.repeat(301) });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown suggested condition ID', () => {
    const schema = assistantResponseSchema({ draftRevision: 2 });
    const result = schema.safeParse({ ...base, suggestedConditionIds: ['GHOST'] });
    expect(result.success).toBe(false);
  });
});

describe('RequestIdRegistry', () => {
  it('registers a new requestId once and rejects the duplicate', () => {
    const registry = new RequestIdRegistry();
    expect(registry.register('req-1')).toBe(true);
    expect(registry.has('req-1')).toBe(true);
    expect(registry.register('req-1')).toBe(false);
  });

  it('treats different requestIds independently', () => {
    const registry = new RequestIdRegistry();
    expect(registry.register('req-1')).toBe(true);
    expect(registry.register('req-2')).toBe(true);
  });
});
