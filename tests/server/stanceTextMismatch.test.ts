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
  it('불가피·합의·합리·입장처럼 선언이 아닌 어절은 방향으로 세지 않는다(Codex 69차)', () => {
    for (const [text, expected] of [
      ['찬성은 불가피합니다.', 'FOR'], ['찬성은 불가합니다.', 'AGAINST'], ['반대는 불가피합니다.', 'AGAINST'], ['승인 불가입니다.', 'AGAINST'],
      ['찬성하기 어렵습니다.', 'AGAINST'], ['아직 찬성 합의가 이뤄지지 않았습니다.', null], ['찬성 합니다.', 'FOR'],
      ['찬성 입장은 아직 아닙니다.', null], ['반대 합리성이 있습니다.', null], ['찬성합니다.', 'FOR'],
      ['가결은 불가결한 절차입니다.', null], ['찬성 쪽 의견이 많습니다.', null], ['찬성 입장입니다.', 'FOR'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('불가피 부정·이중 부정·"-면" 명사(Codex 70차)', () => {
    for (const [text, expected] of [
      ['찬성은 불가피하지 않습니다.', 'AGAINST'], ['찬성은 불가피합니다.', 'FOR'], ['반대가 불가피한 것은 아닙니다.', 'FOR'],
      ['찬성하지 않을 수 없습니다.', 'FOR'], ['반대하지 않을 수 없습니다.', 'AGAINST'],
      ['전면 찬성합니다.', 'FOR'], ['전면 반대합니다.', 'AGAINST'], ['조건이 붙으면 찬성합니다.', null],
      ['기록을 남기면 찬성 쪽입니다.', null], ['이 국면에서는 반대합니다.', 'AGAINST'], ['측면에서 보면 찬성합니다.', null],
      ['화면을 보니 찬성합니다.', 'FOR'], ['반면 저는 반대합니다.', 'AGAINST'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('이중 부정 조사형과 "-면" 판별(Codex 71차)', () => {
    for (const [text, expected] of [
      ['찬성하지 않을 수가 없습니다.', 'FOR'], ['찬성하지 않을 수는 없습니다.', 'FOR'], ['반대하지 않을 리가 없습니다.', 'AGAINST'],
      ['찬성 안 할 수가 없습니다.', 'FOR'], ['찬성하지 않으면 안 됩니다.', 'FOR'],
      ['서면 의견으로 반대합니다.', 'AGAINST'], ['대면 회의에서 찬성합니다.', 'FOR'], ['지면 관계상 반대합니다.', 'AGAINST'],
      ['화면 설계를 보면 찬성합니다.', null], ['조건이 붙으면 찬성합니다.', null], ['기록을 남기면 찬성 쪽입니다.', null],
      ['그렇다면 찬성합니다.', null], ['검토되면 찬성하겠습니다.', null], ['열면 반대합니다.', null], ['전면 찬성합니다.', 'FOR'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('수밖에 없다 이중 부정·단일 긍정과 -면 2음절 한정(Codex 72차)', () => {
    for (const [text, expected] of [
      ['찬성하지 않을 수밖에 없습니다.', 'FOR'], ['반대하지 않을 수밖에 없습니다.', 'AGAINST'],
      ['찬성할 수밖에 없습니다.', 'FOR'], ['반대할 수밖에 없습니다.', 'AGAINST'],
      ['찬성하지 않을 도리가 없습니다.', 'FOR'], ['반대하지 않을 방법이 없습니다.', 'AGAINST'],
      ['기록을 남기면 자료를 보고 찬성하겠습니다.', null], ['조건을 확인하면 의견을 내겠습니다.', null],
      ['서면 의견으로 반대합니다.', 'AGAINST'], ['대면 회의에서 찬성합니다.', 'FOR'],
      ['자료를 보면 의견이 달라질 수 있습니다.', null], ['화면 설계를 보면 찬성합니다.', null], ['검토되면 찬성하겠습니다.', null],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('-면 음운 규칙과 없다 종결 한정(Codex 73차)', () => {
    for (const [text, expected] of [
      ['비대면 회의에서 찬성합니다.', 'FOR'], ['다방면 검토 끝에 반대합니다.', 'AGAINST'], ['전면 찬성합니다.', 'FOR'],
      ['지면 관계상 반대합니다.', 'AGAINST'], ['서면 의견으로 반대합니다.', 'AGAINST'],
      ['기록을 남기면 자료를 보고 찬성하겠습니다.', null], ['속도가 느려지면 반대합니다.', null], ['열면 반대합니다.', null],
      ['앉으면 찬성합니다.', null], ['조건이 붙으면 찬성합니다.', null], ['자료를 보면 의견이 달라질 수 있습니다.', null],
      ['찬성할 수밖에 없는지는 더 검토해야 합니다.', null], ['찬성하지 않을 수 없는지 보겠습니다.', null],
      ['찬성할 수밖에 없습니다.', 'FOR'], ['찬성할 수밖에 없겠습니다.', 'FOR'], ['찬성할 수밖에 없다면 조건을 보겠습니다.', null],
      ['찬성하지 않는지 보겠습니다.', null], ['찬성하지 않습니다.', 'AGAINST'], ['반대하지 않겠습니다.', 'FOR'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('평서형 부정과 -면 규칙 순서(Codex 74차)', () => {
    for (const [text, expected] of [
      ['찬성하지 않다.', 'AGAINST'], ['반대하지 않다.', 'FOR'], ['찬성할 수 없다.', 'AGAINST'], ['찬성하기 어렵다.', 'AGAINST'],
      ['찬성하지 않았다.', 'AGAINST'], ['찬성하지 않는지 보겠다.', null], ['찬성하기 어려워요.', 'AGAINST'],
      ['전적으로 비대면 회의에 찬성합니다.', 'FOR'], ['원칙적으로 서면 의견으로 반대합니다.', 'AGAINST'],
      ['자료를 보면 의견이 달라질 수 있습니다.', null], ['기록을 남기면 자료를 보고 찬성하겠습니다.', null],
      ['비대면 회의에서 찬성합니다.', 'FOR'], ['지면 관계상 반대합니다.', 'AGAINST'],
    ] as const) expect(declaredDirection(text), text).toBe(expected);
  });
  it('방향을 말하지 않는 중립 문장은 모두 null이다', () => {
    const neutral: string[] = [
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
  '승인 쪽인지 아직 판단하려면 자료가 더 필요합니다.',
  '승인 편이라면 어떤 조건이 더 필요할지 보겠습니다.',
  '이사님 쪽일지 지금은 말하기 어렵습니다.',
  '승인에 가까운지는 더 따져 봐야 합니다.',
  '승인에 가깝다면 필요한 조건을 더 보겠습니다.',
  '승인 쪽 조건은 세 가지가 더 필요합니다.',
  '승인 편에서 요청하신 기록 방식은 이해했습니다.',
  '승인 쪽일 수도 있지만 지금은 보류합니다.',
  '승인 쪽이든 아니든 조건은 더 필요합니다.',
  '승인 쪽입니까?',
  '승인 쪽이겠습니까, 아니면 보류입니까?',
  '승인 쪽이라고 생각하고 계십니까?',
  '승인 쪽이라고 판단하는데 맞습니까?',
  '승인 쪽이라고 보시면서 조건은 왜 더 요구하십니까?',
  '승인 쪽이죠?',
  '승인 쪽이라고 봅니까?',
  '승인 쪽이라는 말씀입니까?',
  '승인 쪽이라니요?',
  '승인 쪽이라니요…?',
  '승인 쪽이라고요…?',
  '승인 쪽이라고요...?',
  '승인 쪽입니까…?',
  '승인 쪽이죠… ?',
  '승인 쪽이라고요?',
  '승인 쪽이다니요?',
  '승인 쪽일까요?',
  '승인 쪽이라고 봐야 할까요, 아니면 보류일까요?',
  '승인 쪽이라고 보기엔 자료가 더 필요 하지 않을까요?',
  '승인 편이 중요 한지 아직 판단하기 어렵습니다.',
  '승인 쪽이 요구한 조건은 세 가지입니다.',
  '승인 쪽이 왜 유리한지 설명해 주시겠습니까?',
  '승인 쪽이라고 보시나요?',
  '승인 쪽인가요 아니면 보류인가요?',
  '승인 쪽인지, 조건을 더 봐야 할지 아직 모르겠습니다.',
  '승인 쪽이겠습니까?',
  '승인 편인가요?',
  '승인에 가깝습니까?',
  '승인 쪽이라고 보시는 겁니까?',
  '이사님 의견은 이해했습니다. 승인 쪽이죠?',
  '제 입장이 승인인지는 아직 정하지 않았습니다.',
  '승인 사유를 기록하는 점은 좋습니다.',
  '저는 승인 사유가 더 구체적이면 좋겠습니다.',
  '최종적으로 승인이 필요한 범위는 더 확인해야 합니다.',
  '이사님 답변은 들었습니다. 비용에 대한 제 판단은 표결에서 밝히겠습니다.',
    ];
    for (const text of neutral) expect(declaredDirection(text, 'FOR'), text).toBeNull();
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
