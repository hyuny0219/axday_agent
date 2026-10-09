// T115: OPINIONS·REACTIONS 응답의 문장 방향이 구조화된 stance와 명백히 반대이면 서버가 재시도 1회 뒤
// stance를 문장 방향으로 맞춘다(로그 note: stance_text_mismatch_corrected). 방향이 불분명하면 검사하지 않는다.

import { describe, expect, it } from 'vitest';
import { handleRound, type RoundRequest } from '../../server/handlers/round';
import type { ModelProvider } from '../../server/providers/types';
import { declaredDirection } from '../../src/domain/verdictWords';

function input(overrides: Partial<RoundRequest> = {}): RoundRequest {
  return {
    sessionId: 'session-dir',
    requestId: 'req-dir',
    mode: 'live',
    stage: 'REACTIONS',
    transcript: { revision: 0, statements: [] },
    scenarioId: 'ai-approval',
    budgetMs: 8000,
    roleIds: ['CFO'],
    followUpAnswered: false,
    ...overrides,
  };
}

function provider(replies: Array<{ message: string; stance: string }>): { provider: ModelProvider; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    provider: {
      async complete(req) {
        const reply = replies[Math.min(calls, replies.length - 1)]!;
        calls += 1;
        const envelope = JSON.parse(req.user) as { roleId: string };
        return {
          json: {
            roleId: envelope.roleId,
            message: reply.message,
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: reply.stance,
          },
          modelId: 'fake-model',
          usage: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        };
      },
    },
  };
}

describe('declaredDirection(T115)', () => {
  it('찬성·반대 선언을 뽑고, 조건·의문·부정·양쪽 혼재는 null이다', () => {
    expect(declaredDirection('조건이 맞아 찬성합니다.')).toBe('FOR');
    expect(declaredDirection('이대로는 반대합니다.')).toBe('AGAINST');
    expect(declaredDirection('이 안건은 부결해야 합니다.')).toBe('AGAINST');
    expect(declaredDirection('한도를 정하면 찬성하겠습니다.')).toBeNull();
    expect(declaredDirection('찬성할까요?')).toBeNull();
    expect(declaredDirection('이대로는 반대합니다. 조건이 맞으면 찬성합니다.')).toBe('AGAINST');
    expect(declaredDirection('이번에는 찬성합니다. 다음에는 반대합니다.')).toBeNull();
    expect(declaredDirection('우려가 남습니다.')).toBeNull();
  });
  it('명사와 서술 사이 공백이 있어도 없어도 같은 방향이다', () => {
    for (const [text, expected] of [
      ['찬성 쪽입니다.', 'FOR'], ['찬성쪽입니다.', 'FOR'], ['반대 편입니다.', 'AGAINST'], ['반대편입니다.', 'AGAINST'],
      ['승인 쪽으로 가겠습니다.', 'FOR'], ['승인쪽으로 가겠습니다.', 'FOR'], ['찬성 입니다.', 'FOR'], ['부결 시키겠습니다.', 'AGAINST'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('부정 서술은 방향을 뒤집고, 단순 언급은 null이다', () => {
    for (const [text, expected] of [
      ['가결은 어렵습니다.', 'AGAINST'], ['찬성하기 어렵습니다.', 'AGAINST'], ['반대하지 않겠습니다.', 'FOR'],
      ['가결 여부는 조건을 보고 정하겠습니다.', null], ['찬성 쪽입니다.', 'FOR'], ['승인이 안 됩니다.', 'AGAINST'],
      ['부결시키겠습니다.', 'AGAINST'], ['반대는 어렵습니다.', 'FOR'], ['가결 기준은 아직 모릅니다.', null],
      ['승인 사유를 남기는 점은 좋습니다.', null], ['반대 의견도 있습니다.', null], ['찬성하지 않습니다.', 'AGAINST'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('같은 편·동의는 참가자 입장을 알 때만 방향이 된다', () => {
    expect(declaredDirection('이사님과 같은 편입니다.')).toBeNull();
    expect(declaredDirection('이사님과 같은 편입니다.', 'AGAINST')).toBe('AGAINST');
    expect(declaredDirection('의견에 동의합니다.', 'FOR')).toBe('FOR');
  });
});

describe('stance↔문장 불일치(T115)', () => {
  it('일치하면 1회만 호출하고 그대로 내려보낸다', async () => {
    const p = provider([{ message: '조건이 맞아 찬성합니다.', stance: 'FOR' }]);
    const [result] = await handleRound(input({ followUpAnswered: true }), { provider: p.provider });
    expect(p.calls()).toBe(1);
    expect(result?.statement?.stance).toBe('FOR');
  });
  it('방향 선언이 없으면 검사하지 않는다', async () => {
    const p = provider([{ message: '비용 부담은 더 확인이 필요합니다.', stance: 'AGAINST' }]);
    const [result] = await handleRound(input(), { provider: p.provider });
    expect(p.calls()).toBe(1);
    expect(result?.statement?.stance).toBe('AGAINST');
  });
  it('모순이면 재시도하고, 재시도가 일치하면 그 응답을 쓴다', async () => {
    const p = provider([
      { message: '이대로는 반대합니다.', stance: 'FOR' },
      { message: '이대로는 반대합니다.', stance: 'AGAINST' },
    ]);
    const [result] = await handleRound(input(), { provider: p.provider });
    expect(p.calls()).toBe(2);
    expect(result?.status).toBe('answered');
    expect(result?.statement?.stance).toBe('AGAINST');
  });
  it('재시도도 모순이면 stance를 문장 방향으로 맞춘다', async () => {
    const p = provider([{ message: '이대로는 반대합니다.', stance: 'FOR' }]);
    const [result] = await handleRound(input(), { provider: p.provider });
    expect(p.calls()).toBe(2);
    expect(result?.status).toBe('answered');
    expect(result?.statement?.stance).toBe('AGAINST');
    expect(result?.statement?.message).toBe('이대로는 반대합니다.');
  });
  it('고민 중인데 방향을 선언하면 모순으로 보고 문장 방향으로 맞춘다', async () => {
    const p = provider([{ message: '조건이 맞아 찬성합니다.', stance: 'UNDECIDED' }]);
    const [result] = await handleRound(input({ stage: 'OPINIONS' }), { provider: p.provider });
    expect(p.calls()).toBe(2);
    expect(result?.statement?.stance).toBe('FOR');
  });
  it('FOLLOWUP 단계에서는 이 검사를 하지 않는다(방향 단어 검사가 따로 있다)', async () => {
    const p = provider([{ message: '답변은 들었습니다.', stance: 'FOR' }]);
    const [result] = await handleRound(input({ stage: 'FOLLOWUP', followUpAnswered: true }), { provider: p.provider });
    expect(p.calls()).toBe(1);
    expect(result?.statement?.stance).toBe('FOR');
  });
});
