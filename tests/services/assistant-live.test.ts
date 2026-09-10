// services/assistant/live.ts: refineDraft의 세션당 요청 상한(2회)·동시 요청 거절·
// draftRevision 변경 시 폐기, 실패 시에도 예외로만 끝나고 아무것도 적용하지 않음을
// 확인한다(AGENT_BOARDROOM_SPEC.md 4장). compareConditions는 실제 AI를 부르지 않는다.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import {
  AssistantRefineConcurrentError,
  AssistantRefineLimitError,
  createLiveAssistantAdapter,
} from '../../src/services/assistant/live';

const scenario = aiAssistantScenario;

function makeBase(sessionId: string, requestId: string, signal: AbortSignal = new AbortController().signal) {
  return { sessionId, requestId, signal };
}

function refineOkResponse(draftRevision: number) {
  return {
    ok: true,
    json: async () => ({
      status: 'answered',
      draftText: `정리된 문장 rev${draftRevision}`,
      evidenceIds: ['E1'],
      suggestedConditionIds: ['PILOT'],
    }),
  };
}

describe('live assistant adapter: refineDraft', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('세션당 최대 2회까지만 허용하고 세 번째 요청은 거절한다', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { draftRevision: number };
      return refineOkResponse(body.draftRevision);
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveAssistantAdapter();
    const sessionId = 'session-limit';

    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-1'), scenario, draftText: '원문1', draftRevision: 0 }),
    ).resolves.toMatchObject({ draftText: '정리된 문장 rev0' });
    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-2'), scenario, draftText: '원문2', draftRevision: 1 }),
    ).resolves.toMatchObject({ draftText: '정리된 문장 rev1' });
    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-3'), scenario, draftText: '원문3', draftRevision: 2 }),
    ).rejects.toBeInstanceOf(AssistantRefineLimitError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('같은 draftRevision으로 이미 요청이 진행 중이면 새 요청을 즉시 거절한다', async () => {
    const resolveFirstRef: { current: (() => void) | null } = { current: null };
    const fetchMock = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        resolveFirstRef.current = resolve;
      });
      return refineOkResponse(0);
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveAssistantAdapter();
    const sessionId = 'session-concurrent';

    const first = adapter.refineDraft({
      ...makeBase(sessionId, 'req-1'),
      scenario,
      draftText: '원문',
      draftRevision: 0,
    });
    // 첫 요청이 아직 fetch 응답을 기다리는 동안, 같은 draftRevision으로 두 번째를 보낸다.
    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-2'), scenario, draftText: '원문', draftRevision: 0 }),
    ).rejects.toBeInstanceOf(AssistantRefineConcurrentError);

    resolveFirstRef.current?.();
    await expect(first).resolves.toMatchObject({ draftText: '정리된 문장 rev0' });
  });

  it('진행 중에 draftRevision이 바뀌면 이전 요청은 폐기되고 새 요청이 진행된다', async () => {
    const resolveFirstRef: { current: (() => void) | null } = { current: null };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { draftRevision: number };
      if (body.draftRevision === 0) {
        await new Promise<void>((resolve) => {
          resolveFirstRef.current = resolve;
        });
      }
      return refineOkResponse(body.draftRevision);
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveAssistantAdapter();
    const sessionId = 'session-revision';

    const first = adapter.refineDraft({
      ...makeBase(sessionId, 'req-1'),
      scenario,
      draftText: '원문',
      draftRevision: 0,
    });
    // 참가자가 그사이 원문을 더 고쳐 draftRevision이 1로 바뀌었다 — 이전 요청(rev 0)은 폐기 대상이다.
    const second = adapter.refineDraft({
      ...makeBase(sessionId, 'req-2'),
      scenario,
      draftText: '원문 수정',
      draftRevision: 1,
    });

    await expect(second).resolves.toMatchObject({ draftText: '정리된 문장 rev1' });
    resolveFirstRef.current?.();
    await expect(first).rejects.toThrow();
  });

  it('실패 응답(ok:false)은 예외로만 끝나고 아무것도 적용하지 않는다(원문 유지는 호출부 책임)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveAssistantAdapter();
    const sessionId = 'session-fail';

    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-1'), scenario, draftText: '원문', draftRevision: 0 }),
    ).rejects.toThrow();
    // 실패했지만 두 번째 시도는 새 요청으로 정상 허용된다(첫 시도가 in-flight로 남지 않는다).
    const fetchMockOk = vi.fn(async () => refineOkResponse(1));
    vi.stubGlobal('fetch', fetchMockOk);
    await expect(
      adapter.refineDraft({ ...makeBase(sessionId, 'req-2'), scenario, draftText: '원문', draftRevision: 1 }),
    ).resolves.toMatchObject({ draftText: '정리된 문장 rev1' });
  });
});

describe('live assistant adapter: compareConditions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('실제 AI를 부르지 않고 mode를 항상 scripted로 남긴다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveAssistantAdapter();

    const result = await adapter.compareConditions({
      ...makeBase('session-compare', 'req-1'),
      scenario,
      selectedConditionIds: ['PILOT'],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mode).toBe('scripted');
  });
});
