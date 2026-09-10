import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import {
  ASSISTANT_TIMEOUT_MS,
  createScriptedAdapter,
  SCRIPTED_DELAY_MS,
  withTimeout,
} from '../../src/services/assistant/scripted';
import { AssistantTimeoutError } from '../../src/services/assistant/types';

const scenario = aiAssistantScenario;

function makeRequestBase() {
  const controller = new AbortController();
  return {
    controller,
    base: { sessionId: 'session-1', requestId: 'request-1', signal: controller.signal },
  };
}

describe('scripted assistant adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('요청 도중 리셋(abort)되면 지연이 끝나도 응답을 만들어 resolve하지 않는다', async () => {
    const adapter = createScriptedAdapter();
    const { controller, base } = makeRequestBase();

    const promise = adapter.summarizeOpinions({ ...base, scenario });
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });

    // 응답이 도착하기 전(200ms 전)에 세션이 리셋되어 요청이 취소된 상황을 흉내낸다.
    controller.abort();
    await vi.advanceTimersByTimeAsync(SCRIPTED_DELAY_MS);

    await assertion;
  });

  it('이미 abort된 signal로 요청하면 지연 없이 바로 거부한다', async () => {
    const adapter = createScriptedAdapter();
    const { controller, base } = makeRequestBase();
    controller.abort();

    await expect(adapter.refineDraft({ ...base, draftText: '원문' })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('abort하지 않으면 지연 뒤 정상적으로 결과를 돌려준다', async () => {
    const adapter = createScriptedAdapter();
    const { base } = makeRequestBase();

    const promise = adapter.summarizeOpinions({ ...base, scenario });
    await vi.advanceTimersByTimeAsync(SCRIPTED_DELAY_MS);
    const result = await promise;

    expect(result.mode).toBe('scripted');
    expect(result.commonPoints.length + result.disagreements.length).toBe(
      scenario.initialOpinions.length,
    );
  });

  it('withTimeout은 5초 안에 응답이 없으면 AssistantTimeoutError로 폴백한다', async () => {
    const neverResolves = new Promise<never>(() => {});
    const promise = withTimeout(neverResolves);
    const assertion = expect(promise).rejects.toBeInstanceOf(AssistantTimeoutError);

    await vi.advanceTimersByTimeAsync(ASSISTANT_TIMEOUT_MS);

    await assertion;
  });

  it('withTimeout은 5초 안에 응답이 오면 그 값을 그대로 돌려준다', async () => {
    const adapter = createScriptedAdapter();
    const { base } = makeRequestBase();

    const promise = withTimeout(adapter.refineDraft({ ...base, draftText: '원문 그대로' }));
    await vi.advanceTimersByTimeAsync(SCRIPTED_DELAY_MS);
    const result = await promise;

    expect(result.draftText).toBe('원문 그대로');
  });

  it('내 발언 정리는 "않"·"없이" 같은 부정·유보 표현을 지우지 않는다', async () => {
    const adapter = createScriptedAdapter();
    const { base } = makeRequestBase();
    const draftText =
      '아직 확인되지 않은 수치이며, 검증 없이 그대로 공유하지 않겠습니다. 담당자 확인이 필요합니다.';

    const promise = adapter.refineDraft({ ...base, draftText });
    await vi.advanceTimersByTimeAsync(SCRIPTED_DELAY_MS);
    const result = await promise;

    expect(result.draftText).toContain('않은');
    expect(result.draftText).toContain('없이');
    expect(result.draftText).toContain('않겠습니다');
    expect(result.draftText.length).toBeLessThanOrEqual(300);
  });

  it('내 발언 정리 결과는 300자를 넘지 않는다', async () => {
    const adapter = createScriptedAdapter();
    const { base } = makeRequestBase();
    const longDraft = '검토가 필요합니다. '.repeat(40);

    const promise = adapter.refineDraft({ ...base, draftText: longDraft });
    await vi.advanceTimersByTimeAsync(SCRIPTED_DELAY_MS);
    const result = await promise;

    expect(result.draftText.length).toBeLessThanOrEqual(300);
  });
});
