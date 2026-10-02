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
    expect(message.suggestedConditionIds).toEqual(['LIMIT']);
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

// PR #13 Codex 2차 검토 P1: 역할마다 고정 조건 ID(LIMIT 등)를 돌려주면 ai-approval이
// 아닌 안건(experience-first)에서는 그 ID가 유효하지 않아 매 라운드 invalid_response로
// 떨어졌다. envelope의 scenarioId로 그 안건 자신의 조건 목록에서 고르는지 확인한다.
describe('createMockProvider 안건별 조건 ID(PR #13 Codex 2차 검토 P1)', () => {
  const AI_APPROVAL_CONDITION_IDS = new Set(['LIMIT', 'LOG', 'REVIEW', 'OWNER', 'FULL_AUTO']);
  const EXPERIENCE_FIRST_CONDITION_IDS = new Set([
    'SCOPE',
    'RECORD',
    'DATA_VETO',
    'REVIEW',
    'EXP_ONLY',
  ]);

  it.each(['CEO', 'CFO', 'CAIO', 'CISO'] as const)(
    'ai-approval statement 응답의 %s suggestedConditionIds는 안건① 자신의 조건이다',
    async (roleId) => {
      const provider = createMockProvider('mock-model');
      const user = JSON.stringify({ kind: 'statement', roleId, scenarioId: 'ai-approval' });
      const result = await provider.complete(baseRequest(user));
      const message = result.json as { suggestedConditionIds: string[] };
      expect(message.suggestedConditionIds).toHaveLength(1);
      expect(AI_APPROVAL_CONDITION_IDS.has(message.suggestedConditionIds[0]!)).toBe(true);
    },
  );

  it.each(['CEO', 'CFO', 'CAIO', 'CISO'] as const)(
    'experience-first statement 응답의 %s suggestedConditionIds는 안건② 자신의 조건이다',
    async (roleId) => {
      const provider = createMockProvider('mock-model');
      const user = JSON.stringify({ kind: 'statement', roleId, scenarioId: 'experience-first' });
      const result = await provider.complete(baseRequest(user));
      const message = result.json as { suggestedConditionIds: string[] };
      expect(message.suggestedConditionIds).toHaveLength(1);
      expect(EXPERIENCE_FIRST_CONDITION_IDS.has(message.suggestedConditionIds[0]!)).toBe(true);
    },
  );

  it('assistant 응답(역할 없음)도 scenarioId별로 그 안건 자신의 조건을 돌려준다', async () => {
    const provider = createMockProvider('mock-model');
    const aiApprovalResult = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'assistant_refine', draftRevision: 0, scenarioId: 'ai-approval' })),
    );
    const experienceFirstResult = await provider.complete(
      baseRequest(
        JSON.stringify({ kind: 'assistant_refine', draftRevision: 0, scenarioId: 'experience-first' }),
      ),
    );
    expect(
      (aiApprovalResult.json as { suggestedConditionIds: string[] }).suggestedConditionIds,
    ).toEqual(['LIMIT']);
    expect(
      (experienceFirstResult.json as { suggestedConditionIds: string[] }).suggestedConditionIds,
    ).toEqual(['SCOPE']);
  });

  it('scenarioId가 없거나 알 수 없으면 이전 고정값으로 되돌아간다(기존 테스트 하위 호환)', async () => {
    const provider = createMockProvider('mock-model');
    const noScenario = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'statement', roleId: 'CFO' })),
    );
    const unknownScenario = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'statement', roleId: 'CFO', scenarioId: 'anon-board' })),
    );
    expect((noScenario.json as { suggestedConditionIds: string[] }).suggestedConditionIds).toEqual([
      'OWNER',
    ]);
    expect(
      (unknownScenario.json as { suggestedConditionIds: string[] }).suggestedConditionIds,
    ).toEqual(['OWNER']);
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

// PR #13 Codex 2차 검토 후속: 역할마다 고정 자료 ID(CISO→E4 등)를 돌려주면 그 안건의
// roleLenses와 어긋날 수 있다(ai-approval의 CISO 렌즈는 E3). envelope의 scenarioId로
// roleLenses[role].evidenceIds의 첫 자료를 쓰는지 확인한다.
describe('createMockProvider 안건별 역할 렌즈 자료(PR #13 Codex 2차 검토 후속)', () => {
  const AI_APPROVAL_ROLE_EVIDENCE: Record<string, string> = {
    CEO: 'E1',
    CFO: 'E2',
    CAIO: 'E3',
    CISO: 'E3',
  };
  const EXPERIENCE_FIRST_ROLE_EVIDENCE: Record<string, string> = {
    CEO: 'E1',
    CFO: 'E4',
    CAIO: 'E2',
    CISO: 'E3',
  };

  it.each(['CEO', 'CFO', 'CAIO', 'CISO'] as const)(
    'ai-approval statement 응답의 %s evidenceIds는 그 역할의 roleLens 자료다',
    async (roleId) => {
      const provider = createMockProvider('mock-model');
      const user = JSON.stringify({ kind: 'statement', roleId, scenarioId: 'ai-approval' });
      const result = await provider.complete(baseRequest(user));
      const message = result.json as { evidenceIds: string[] };
      expect(message.evidenceIds).toEqual([AI_APPROVAL_ROLE_EVIDENCE[roleId]]);
    },
  );

  it.each(['CEO', 'CFO', 'CAIO', 'CISO'] as const)(
    'experience-first statement 응답의 %s evidenceIds는 그 역할의 roleLens 자료다',
    async (roleId) => {
      const provider = createMockProvider('mock-model');
      const user = JSON.stringify({ kind: 'statement', roleId, scenarioId: 'experience-first' });
      const result = await provider.complete(baseRequest(user));
      const message = result.json as { evidenceIds: string[] };
      expect(message.evidenceIds).toEqual([EXPERIENCE_FIRST_ROLE_EVIDENCE[roleId]]);
    },
  );

  it.each(['CEO', 'CFO', 'CAIO', 'CISO'] as const)(
    'vote 응답도 %s의 roleLens 자료를 scenarioId별로 인용한다',
    async (roleId) => {
      const provider = createMockProvider('mock-model');
      const aiApproval = await provider.complete(
        baseRequest(JSON.stringify({ kind: 'vote', roleId, scenarioId: 'ai-approval' })),
      );
      const experienceFirst = await provider.complete(
        baseRequest(JSON.stringify({ kind: 'vote', roleId, scenarioId: 'experience-first' })),
      );
      expect((aiApproval.json as { evidenceIds: string[] }).evidenceIds).toEqual([
        AI_APPROVAL_ROLE_EVIDENCE[roleId],
      ]);
      expect((experienceFirst.json as { evidenceIds: string[] }).evidenceIds).toEqual([
        EXPERIENCE_FIRST_ROLE_EVIDENCE[roleId],
      ]);
    },
  );

  it('scenarioId가 없거나 알 수 없으면 이전 고정값으로 되돌아간다(기존 테스트 하위 호환)', async () => {
    const provider = createMockProvider('mock-model');
    const noScenario = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'statement', roleId: 'CISO' })),
    );
    const unknownScenario = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'statement', roleId: 'CISO', scenarioId: 'anon-board' })),
    );
    expect((noScenario.json as { evidenceIds: string[] }).evidenceIds).toEqual(['E4']);
    expect((unknownScenario.json as { evidenceIds: string[] }).evidenceIds).toEqual(['E4']);
  });
});

// PR #13 Codex 3차 검토: OPINIONS의 stance를 고정 ROLE_STANCE(CAIO 항상 FOR)로만
// 주면 안건 문서가 명시한 CAIO "미정"과 어긋났다. envelope의 scenarioId로
// roleLenses[role].opening을 쓰는지, REACTIONS·FOLLOWUP은 여전히 고정 맵을 쓰는지
// 확인한다.
describe('createMockProvider 안건별 OPINIONS 출발 성향(PR #13 Codex 3차 검토)', () => {
  const EXPECTED_OPENING: Record<string, 'FOR' | 'AGAINST' | 'UNDECIDED'> = {
    CEO: 'FOR',
    CFO: 'AGAINST',
    CAIO: 'UNDECIDED',
    CISO: 'AGAINST',
  };

  it.each(['ai-approval', 'experience-first'] as const)(
    '%s의 OPINIONS stance는 CEO FOR·CFO AGAINST·CAIO UNDECIDED·CISO AGAINST다',
    async (scenarioId) => {
      const provider = createMockProvider('mock-model');
      for (const roleId of ['CEO', 'CFO', 'CAIO', 'CISO'] as const) {
        const result = await provider.complete(
          baseRequest(JSON.stringify({ kind: 'statement', roleId, stage: 'OPINIONS', scenarioId })),
        );
        expect((result.json as { stance: string }).stance).toBe(EXPECTED_OPENING[roleId]);
      }
    },
  );

  it.each(['ai-approval', 'experience-first'] as const)(
    '%s의 REACTIONS·FOLLOWUP stance는 OPINIONS와 무관하게 고정 맵을 쓴다(CAIO는 FOR)',
    async (scenarioId) => {
      const provider = createMockProvider('mock-model');
      for (const stage of ['REACTIONS', 'FOLLOWUP'] as const) {
        const result = await provider.complete(
          baseRequest(
            JSON.stringify({ kind: 'statement', roleId: 'CAIO', stage, scenarioId }),
          ),
        );
        expect((result.json as { stance: string }).stance).toBe('FOR');
      }
    },
  );

  it('scenarioId가 없거나 알 수 없으면 OPINIONS도 이전 고정값으로 되돌아간다(기존 테스트 하위 호환)', async () => {
    const provider = createMockProvider('mock-model');
    const noScenario = await provider.complete(
      baseRequest(JSON.stringify({ kind: 'statement', roleId: 'CAIO', stage: 'OPINIONS' })),
    );
    const unknownScenario = await provider.complete(
      baseRequest(
        JSON.stringify({ kind: 'statement', roleId: 'CAIO', stage: 'OPINIONS', scenarioId: 'anon-board' }),
      ),
    );
    expect((noScenario.json as { stance: string }).stance).toBe('FOR');
    expect((unknownScenario.json as { stance: string }).stance).toBe('FOR');
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
