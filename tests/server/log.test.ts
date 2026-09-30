// server/log.ts: 호출 로그 한 줄의 필드 구성(본문·키 없음), stdout·파일 동시 기록, 세션
// 요약 집계·flush. AGENT_BOARDROOM_SPEC.md 6장(T65).

import { afterEach, describe, expect, it, vi } from 'vitest';

const appendFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  appendFileSync: (...args: unknown[]) => appendFileSyncMock(...args),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
}));

describe('server/log.ts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    appendFileSyncMock.mockClear();
    mkdirSyncMock.mockClear();
    vi.resetModules();
  });

  it('한 줄 JSON을 stdout과 파일에 남기고 카드가 정한 필드만 담는다(본문·키 없음)', async () => {
    const { logCall } = await import('../../server/log');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logCall(
      {
        ts: '2026-09-30T00:00:00.000Z',
        kind: 'round',
        sessionId: 'session-1',
        stage: 'OPINIONS',
        roleId: 'CFO',
        status: 'failed',
        failReason: 'timeout',
        providerErrorClass: 'timeout',
        latencyMs: 1234,
        timeoutMs: 8000,
        promptVersion: 'v7',
        modelId: 'claude-sonnet-5',
      },
      1_000,
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(
      [
        'failReason',
        'kind',
        'latencyMs',
        'modelId',
        'promptVersion',
        'providerErrorClass',
        'roleId',
        'sessionId',
        'stage',
        'status',
        'timeoutMs',
        'ts',
      ].sort(),
    );
    // 참가자·모델 발언 본문(message)이나 키는 애초에 필드로 존재하지 않는다.
    expect(parsed).not.toHaveProperty('message');
    expect(parsed).not.toHaveProperty('draftText');
    expect(parsed).not.toHaveProperty('apiKey');
    expect(line).not.toContain('sk-ant-');

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('logs'), { recursive: true });
    expect(appendFileSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('board-1970-01-01.jsonl'),
      `${line}\n`,
      'utf-8',
    );
  });

  it('파일 쓰기가 실패해도(디스크 없음 등) 예외를 던지지 않는다', async () => {
    appendFileSyncMock.mockImplementation(() => {
      throw new Error('disk full');
    });
    const { logCall } = await import('../../server/log');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(() =>
      logCall({
        ts: '2026-09-30T00:00:00.000Z',
        kind: 'probe',
        status: 'answered',
        latencyMs: 10,
        timeoutMs: 8000,
        promptVersion: '',
        modelId: 'mock-model',
      }),
    ).not.toThrow();
  });

  it('세션별로 호출 수·실패 수·최대 지연을 집계해 flush 시 한 줄 요약을 남긴다', async () => {
    const { logCall, flushSessionSummary } = await import('../../server/log');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const base = {
      kind: 'round' as const,
      sessionId: 'session-summary-1',
      stage: 'OPINIONS',
      timeoutMs: 8000,
      promptVersion: 'v7',
      modelId: 'claude-sonnet-5',
    };
    logCall({ ...base, ts: 't1', roleId: 'CEO', status: 'answered', latencyMs: 100 });
    logCall({ ...base, ts: 't2', roleId: 'CFO', status: 'failed', failReason: 'timeout', latencyMs: 8000 });
    logCall({ ...base, ts: 't3', roleId: 'CAIO', status: 'answered', latencyMs: 300 });

    consoleSpy.mockClear();
    flushSessionSummary('session-summary-1', 2_000);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const summary = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(summary).toMatchObject({
      kind: 'session_summary',
      sessionId: 'session-summary-1',
      calls: 3,
      failures: 1,
      maxLatencyMs: 8000,
    });
    // 참가자·모델 발언 본문은 요약에도 없다.
    expect(summary).not.toHaveProperty('message');

    // 같은 세션을 다시 flush해도(이미 비웠으므로) 아무 것도 남기지 않는다.
    consoleSpy.mockClear();
    flushSessionSummary('session-summary-1', 3_000);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('sessionId가 없는 호출(probe)은 세션 요약 집계에 들어가지 않는다', async () => {
    const { logCall, flushSessionSummary } = await import('../../server/log');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logCall({
      ts: 't1',
      kind: 'probe',
      status: 'answered',
      latencyMs: 500,
      timeoutMs: 8000,
      promptVersion: '',
      modelId: 'mock-model',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    flushSessionSummary('no-such-session', 1_000);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
