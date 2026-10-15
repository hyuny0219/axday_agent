// services/boardAgents/live.ts: 요청 본문이 화면의 추가 질문 하나와 참가자의 답변 문장을 싣는지
// 확인한다(T122, 프롬프트 v14). 질문은 입장별(T93)로 화면과 같은 기준으로 고른다.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { createInitialSession } from '../../src/domain/session';
import type { Opinion, Session } from '../../src/domain/types';
import { createLiveBoardAgentsAdapter } from '../../src/services/boardAgents/live';
import type { BoardAgentsContext } from '../../src/services/boardAgents/types';

function opinion(index: number, originalText: string, stance: 'FOR' | 'AGAINST' | null): Opinion {
  return {
    id: `o-${index}`,
    originalText,
    selectedPhraseIds: [],
    confirmedConditionIds: [],
    stance,
    createdAt: 0,
  };
}

function ctxFor(overrides: Partial<Session>): BoardAgentsContext {
  const session: Session = {
    ...createInitialSession(0),
    mode: 'live',
    scenarioId: aiApprovalScenario.id,
    ...overrides,
  };
  return {
    sessionId: session.sessionId,
    requestId: 'req-1',
    session,
    scenario: aiApprovalScenario,
    budgetMs: 8000,
    signal: new AbortController().signal,
  };
}

async function capturedBody(call: (adapter: ReturnType<typeof createLiveBoardAgentsAdapter>) => Promise<unknown>) {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return { ok: true, json: async () => [] };
    }),
  );
  await call(createLiveBoardAgentsAdapter());
  return bodies[0] ?? {};
}

describe('live 어댑터의 추가 질문·답변 전달(T122)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('REACTIONS 요청에는 지금 의견의 입장에 맞는 추가 질문만 싣고 답변 문장은 싣지 않는다', async () => {
    const ctx = ctxFor({ stage: 'REACTIONS', opinions: [opinion(1, '반대합니다.', 'AGAINST')] });
    const body = await capturedBody((adapter) => adapter.reactions(ctx));
    expect(body.followUpQuestion).toEqual({
      askedBy: aiApprovalScenario.followUp.byStance?.AGAINST.askedBy,
      question: aiApprovalScenario.followUp.byStance?.AGAINST.question,
    });
    expect(body.followUpAnswerText).toBeUndefined();
  });

  it('FOLLOWUP 요청에는 질문을 보여 준 입장의 질문과 마지막 의견(답변) 문장을 싣는다', async () => {
    const ctx = ctxFor({
      stage: 'MOTION',
      opinions: [opinion(1, '찬성합니다.', 'FOR'), opinion(2, '자동 승인마다 승인 사유를 기록합시다.', 'FOR')],
      followUpUsed: true,
      followUpAnswered: true,
      followUpStance: 'FOR',
    });
    const body = await capturedBody((adapter) => adapter.followUp(ctx));
    expect((body.followUpQuestion as { question: string }).question).toBe(
      aiApprovalScenario.followUp.byStance?.FOR.question,
    );
    expect(body.followUpAnswerText).toBe('자동 승인마다 승인 사유를 기록합시다.');
  });

  it('답변 문장은 300자로 자르고, 답하지 않고 넘어가면 싣지 않는다', async () => {
    const long = '가'.repeat(400);
    const answered = ctxFor({
      opinions: [opinion(1, '찬성합니다.', 'FOR'), opinion(2, long, 'FOR')],
      followUpUsed: true,
      followUpAnswered: true,
      followUpStance: 'FOR',
    });
    const body = await capturedBody((adapter) => adapter.followUp(answered));
    expect((body.followUpAnswerText as string).length).toBe(300);

    const skipped = ctxFor({
      opinions: [opinion(1, '찬성합니다.', 'FOR')],
      followUpUsed: true,
      followUpAnswered: false,
      followUpStance: 'FOR',
    });
    const skippedBody = await capturedBody((adapter) => adapter.followUp(skipped));
    expect(skippedBody.followUpAnswerText).toBeUndefined();
    expect(skippedBody.followUpQuestion).toBeDefined();
  });

  it('OPINIONS 요청에는 추가 질문을 싣지 않는다', async () => {
    const ctx = ctxFor({ stage: 'OPINIONS' });
    const body = await capturedBody((adapter) => adapter.initialOpinions(ctx));
    expect(body.followUpQuestion).toBeUndefined();
  });
});

describe('live 어댑터의 첫 반응 판정 값 전달(T132)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('REACTIONS 요청에만 확정 조건과 임원별 첫 의견 입장을 싣는다', async () => {
    const withConditions = { ...opinion(1, '찬성합니다.', 'FOR'), confirmedConditionIds: ['LIMIT', 'LOG'] };
    const ctx = ctxFor({
      stage: 'REACTIONS',
      opinions: [withConditions],
      transcript: {
        revision: 1,
        statements: [
          {
            id: 's1',
            roleId: 'CFO',
            stage: 'OPINIONS',
            text: '반대합니다.',
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'AGAINST',
            source: 'live',
            createdAt: 0,
          },
        ],
      },
    });
    const body = await capturedBody((adapter) => adapter.reactions(ctx));
    expect(body.confirmedConditionIds).toEqual(['LIMIT', 'LOG']);
    expect((body.priorStances as Record<string, string>).CFO).toBe('AGAINST');
    expect((body.priorStances as Record<string, string>).CEO).toBe('UNDECIDED');

    const opinionsBody = await capturedBody((adapter) => adapter.initialOpinions(ctxFor({ stage: 'OPINIONS' })));
    expect(opinionsBody.confirmedConditionIds).toBeUndefined();
    expect(opinionsBody.priorStances).toBeUndefined();
  });
});
