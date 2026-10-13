// server/validate.ts 검증 규칙: unknown ID·길이 초과·hash 불일치·중복 requestId·
// ballot 포함 발언을 모두 거절해야 한다(AGENT_BOARDROOM_SPEC.md 5장).

import { describe, expect, it } from 'vitest';
import {
  RequestIdRegistry,
  assistantResponseSchema,
  findStrayLatinRun,
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
    suggestedConditionIds: ['LIMIT'],
    stance: 'FOR',
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

  it('rejects a response missing the stance field (T63)', () => {
    const schema = statementResponseSchema();
    const withoutStance: Record<string, unknown> = { ...validStatement() };
    delete withoutStance.stance;
    const result = schema.safeParse(withoutStance);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown stance value', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({ ...validStatement(), stance: 'MAYBE' });
    expect(result.success).toBe(false);
  });

  // T82: 조건 ID(LOG·OWNER 등)가 문장에 그대로 새는 것을 거절한다(docs/eval/
  // tuning-v8-after.jsonl에서 발견된 결함). 'AI'·임원 역할 이름·숫자·단위는 예외다.
  it('rejects a message with a stray condition ID (T82)', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({
      ...validStatement(),
      message: 'LOG·OWNER 조건이 보장되지 않아 반대합니다.',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a message that names the condition in Korean instead of its ID (T82)', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({
      ...validStatement(),
      message: '승인 사유 기록 조건이 보장되면 찬성합니다.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts "AI" and executive role names as exceptions to the stray-Latin check (T82)', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({
      ...validStatement(),
      message: 'CISO·CFO 의견에 동의하며, AI가 승인한 결재를 신뢰합니다.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts numbers and units in a message (not Latin letters, T82)', () => {
    const schema = statementResponseSchema();
    const result = schema.safeParse({
      ...validStatement(),
      message: '응답 62%가 지연을 지적했고 대기 2.8일이 확인되었습니다.',
    });
    expect(result.success).toBe(true);
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

  it('rejects a reason with a stray condition ID (T82)', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({
      ...base,
      reason: 'SCOPE·RECORD·DATA_VETO 조건 없는 원안은 반대합니다.',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a reason that names the condition in Korean instead of its ID (T82)', () => {
    const schema = voteResponseSchema({ motionId: 'motion-1', motionHash: 'abc123' });
    const result = schema.safeParse({
      ...base,
      reason: '전례 없는 상황 한정·판단 근거 기록 조건이 전제되어 찬성합니다.',
    });
    expect(result.success).toBe(true);
  });
});

describe('assistantResponseSchema', () => {
  const base = {
    draftRevision: 2,
    draftText: '정리된 발언입니다.',
    evidenceIds: ['E2'],
    suggestedConditionIds: ['OWNER'],
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

  it('rejects a draftText with a stray condition ID (T82)', () => {
    const schema = assistantResponseSchema({ draftRevision: 2 });
    const result = schema.safeParse({ ...base, draftText: '결재 규칙 책임자(OWNER) 조건을 확인해야 합니다.' });
    expect(result.success).toBe(false);
  });

  it('keeps suggestedConditionIds as IDs regardless of the stray-Latin check (T82)', () => {
    // 비서실장 응답의 suggestedConditionIds는 응답 스키마 필드라 여전히 ID로 받는다 —
    // findStrayLatinRun은 draftText(사람이 보는 문장)만 본다.
    const schema = assistantResponseSchema({ draftRevision: 2 });
    const result = schema.safeParse({ ...base, draftText: '승인 사유 기록 조건을 확인해야 합니다.' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestedConditionIds).toEqual(['OWNER']);
    }
  });
});

describe('findStrayLatinRun', () => {
  it('finds a condition-ID-shaped Latin run', () => {
    expect(findStrayLatinRun('LOG·OWNER 조건이 보장되지 않아')).toBe('LOG');
  });

  it('treats "AI" and executive role names as allowed exceptions', () => {
    expect(findStrayLatinRun('AI가 승인한 결재를 CISO·CFO가 신뢰합니다.')).toBeUndefined();
  });

  it('ignores digits, percent signs, and decimal points', () => {
    expect(findStrayLatinRun('응답 62%가 대기 2.8일을 지적했습니다.')).toBeUndefined();
  });

  // PR #20 Codex 3차 검토 P2: 영문자만 2자 이상 세면 자료 ID `E1`(영문 1자 + 숫자)이 빠진다.
  it('catches evidence IDs like E1 and underscore IDs like FULL_AUTO', () => {
    expect(findStrayLatinRun('E1 자료에 따르면 대기가 길어졌습니다.')).toBe('E1');
    expect(findStrayLatinRun('사람 검토 전면 생략(FULL_AUTO)이 포함되어')).toBe('FULL_AUTO');
    expect(findStrayLatinRun('CFO가 E2를 인용했습니다.')).toBe('E2');
  });

  // PR #20 Codex 8차 검토 P2: 한 글자짜리 영문도 걸러야 한다.
  it('catches single Latin letters like A안·X 조건', () => {
    expect(findStrayLatinRun('A안을 택하겠습니다.')).toBe('A');
    expect(findStrayLatinRun('X 조건은 제외합니다.')).toBe('X');
    expect(findStrayLatinRun('AI가 처리하고 CFO가 확인합니다. 62%·2.8일.')).toBeUndefined();
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
