// T114: FOLLOWUP 발언에 방향 단어(찬성·반대·가결·부결)가 남으면 서버가 거절·재시도하고, 그래도 남으면
// 그 임원 발언만 중립 문장으로 대체한다(로그 note: followup_verdict_masked).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRound, type FollowUpAuditEntry, type RoundRequest } from '../../server/handlers/round';
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

const NEUTRAL = [
  '조건을 더 보겠습니다.',
  '답변은 들었습니다.',
  '우려가 남습니다.',
  '근거가 분명해졌습니다.',
  '자동 승인 사유를 남기는 점은 좋습니다.',
  '책임자를 정한 점은 의미가 있습니다.',
  '비용 부담은 아직 확인이 필요합니다.',
  '제 판단은 표결에서 밝히겠습니다.',
  '이사님 답변으로 한 가지 걱정은 풀렸습니다.',
  '보안 점검 주기가 더 구체적이면 좋겠습니다.',
  '결재 한도를 정하자는 말씀은 이해했습니다.',
  '시범 기간 기록을 함께 공유하면 안심이 됩니다.',
  '운영 부담이 얼마나 늘지는 더 따져 봐야 합니다.',
  '조건을 더 보겠습니다.',
  '아직 판단을 정하지 않았습니다.',
  '이사님 쪽에서 말씀하신 조건은 이해했습니다.',
  '자동 승인 사유를 기록하는 방식이 마음에 듭니다.',
  '그 방향으로 점검 주기를 더 구체화해 주십시오.',
  '결론은 표결에서 밝히겠습니다.',
  '승인 사유를 기록하는 점은 좋습니다.',
  '저는 승인 사유가 더 구체적이면 좋겠습니다.',
  '최종적으로 승인이 필요한 범위는 더 확인해야 합니다.',
  '이사님 답변은 들었습니다. 비용에 대한 제 판단은 표결에서 밝히겠습니다.',
];

const DECLARATIONS = [
  '이번에는 찬성합니다.',
  '반대로 남겠습니다.',
  '가결이 맞다고 봅니다.',
  '부결이 낫겠습니다.',
  '안건을 반려하겠습니다.',
  '이 안을 지지하겠습니다.',
  '이사님 의견에 동의합니다.',
  '이사님 쪽에 표를 보태겠습니다.',
  '이사님께 힘을 보태겠습니다.',
  '저도 손을 들겠습니다.',
  '이 안에 표를 주겠습니다.',
  '한 표를 던지겠습니다.',
  '이제 같은 편입니다.',
  '이사님과 뜻을 같이합니다.',
  '이 안은 제가 밀어드리겠습니다.',
  '이대로는 막겠습니다.',
  '이 안건은 거부합니다.',
  '이 안건을 긍정적으로 보고 있습니다.',
  '이 안건은 부정적으로 판단합니다.',
  '저는 이사님 쪽입니다.',
  '이 안은 통과시키겠습니다.',
  '이 안건을 승인하겠습니다.',
  '이사님 쪽에 서겠습니다.',
  '승인 쪽으로 기울었습니다.',
  '이사님 편으로 돌아섰습니다.',
  '그 방향으로 가겠습니다.',
  '마음이 기울었습니다.',
  '마음이 움직였습니다.',
  '이 안에 힘을 싣겠습니다.',
  '손을 들었습니다.',
  '승인으로 결정했습니다.',
  '승인으로 정했습니다.',
  '결론은 승인입니다.',
  '승인 쪽입니다.',
  '저는 반대 쪽에 섭니다.',
  '제 입장은 승인입니다.',
  '찬성에 가깝습니다.',
  '참가자 편입니다.',
  '최종적으로 저는 승인입니다.',
  '승인 쪽이죠.',
  '찬성 쪽이네요.',
  '반대 편일 겁니다.',
  '제 결론은 부결이라고 봅니다.',
  '제 입장은 승인이라고 봅니다.',
  '저는 승인이죠.',
];

describe('findVerdictWords — 임원 FOLLOWUP 발언 전용 방향 표현 검사', () => {
  it('찬반·가부 단어와 선언 표현을 찾는다', () => {
    expect(findVerdictWords('찬성합니다. 반대표는 던지지 않습니다.')).toEqual(['찬성', '반대']);
    expect(findVerdictWords('가결이든 부결이든 따르겠습니다.')).toEqual(['가결', '부결']);
    expect(findVerdictWords('답변을 잘 들었습니다. 근거가 분명해졌습니다.')).toEqual([]);
  });

  it.each(DECLARATIONS)('방향 선언은 걸린다: %s', (sentence) => {
    expect(findVerdictWords(sentence).length).toBeGreaterThan(0);
  });

  it.each(NEUTRAL)('중립 문장은 걸리지 않는다(거짓 양성 없음): %s', (sentence) => {
    expect(findVerdictWords(sentence)).toEqual([]);
  });

  it('서버가 쓰는 역할별 중립 대체 문장은 어떤 패턴에도 걸리지 않는다', () => {
    for (const roleId of ['CEO', 'CFO', 'CAIO', 'CISO', '알 수 없는 역할']) {
      expect(findVerdictWords(maskedFollowUpMessage(roleId))).toEqual([]);
    }
  });
});

describe('FOLLOWUP 방향 단어 서버 방어(T114)', () => {
  it('다른 필드가 형식 오류여도 원문 위반이 audit에 남는다(Codex 55차)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let calls = 0;
    const provider: ModelProvider = {
      async complete(req) {
        calls += 1;
        const envelope = JSON.parse(req.user) as { roleId: string };
        return {
          json: {
            roleId: envelope.roleId,
            message: calls === 1 ? '이번에는 찬성합니다.' : '답변을 잘 들었습니다.',
            evidenceIds: [],
            referencedStatementIds: calls === 1 ? ['없는-발언'] : [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'FOR',
          },
          modelId: 'fake-model',
        };
      },
    };
    const followUpAudit: FollowUpAuditEntry[] = [];
    const [result] = await handleRound(input(), { provider, followUpAudit });
    expect(result?.statement?.message).toBe('답변을 잘 들었습니다.');
    expect(followUpAudit[0]?.attempts).toEqual([
      { text: '이번에는 찬성합니다.', violations: ['찬성'], invalidReason: 'schema' },
      { text: '답변을 잘 들었습니다.', violations: [] },
    ]);
    expect(followUpAudit[0]?.masked).toBe(false);
  });

  it('동의어 선언("지지하겠습니다")도 거절·재시도·대체 경로를 탄다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider, calls } = providerReturning(['이 안을 지지하겠습니다.', '이사님 쪽에 표를 보태겠습니다.']);
    const [result] = await handleRound(input(), { provider });
    expect(calls()).toBe(2);
    expect(result?.statement?.message).toBe(maskedFollowUpMessage('CFO'));
  });

  it('followUpAudit에 시도별 원문·위반 건수와 대체 여부가 남고 응답 결과에는 실리지 않는다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider } = providerReturning(['이번에는 찬성합니다.', '답변을 잘 들었습니다.']);
    const followUpAudit: FollowUpAuditEntry[] = [];
    const results = await handleRound(input(), { provider, followUpAudit });
    expect(followUpAudit).toEqual([
      {
        roleId: 'CFO',
        attempts: [
          { text: '이번에는 찬성합니다.', violations: ['찬성'] },
          { text: '답변을 잘 들었습니다.', violations: [] },
        ],
        masked: false,
      },
    ]);
    expect(JSON.stringify(results)).not.toContain('followUpAudit');
    expect(JSON.stringify(results)).not.toContain('violations');
  });

  it('대체까지 간 경우 audit은 masked true와 두 번의 원시 위반을 남긴다', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { provider } = providerReturning(['반대로 남겠습니다.', '역시 반대표를 던지겠습니다.']);
    const followUpAudit: FollowUpAuditEntry[] = [];
    await handleRound(input(), { provider, followUpAudit });
    expect(followUpAudit[0]?.masked).toBe(true);
    expect(followUpAudit[0]?.attempts.map((a) => a.violations.length > 0)).toEqual([true, true]);
  });

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
