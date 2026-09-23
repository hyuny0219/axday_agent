// 운영 메뉴 "모델 연결 확인"의 클라이언트 어댑터(src/services/transport/probe.ts). 연결이
// 블랙홀이면 서버의 8초 상한이 시작되지도 않아 fetch가 영원히 대기하고, 그동안 패널의 닫기가
// 비활성이라 운영자가 scripted 대안으로 돌아갈 수 없었다(PR #10 Codex 9차 검토 P2). 두 요청
// 모두 클라이언트 쪽 시간 상한으로 반드시 끝나야 한다.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealth, probeModel } from '../../src/services/transport/probe';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNeverResolvingFetch(): { aborted: () => boolean } {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {
        /* 신호를 무시하고 영원히 대기하는 구현 */
      });
    }),
  );
  return { aborted: () => signal?.aborted === true };
}

describe('probe transport 시간 상한', () => {
  it('probe 응답이 오지 않으면 상한 뒤 timeout 실패로 끝나고 요청을 abort한다', async () => {
    const fetchStub = stubNeverResolvingFetch();
    const result = await probeModel({ timeoutMs: 20 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
    expect(fetchStub.aborted()).toBe(true);
  });

  it('health 응답이 오지 않으면 상한 뒤 null로 끝난다', async () => {
    stubNeverResolvingFetch();
    await expect(fetchHealth({ timeoutMs: 20 })).resolves.toBeNull();
  });

  it('정상 응답은 상한 안에서 그대로 돌려준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, modelId: 'm', latencyMs: 5 }) }) as Response),
    );
    await expect(probeModel({ timeoutMs: 1_000 })).resolves.toEqual({ ok: true, modelId: 'm', latencyMs: 5 });
  });
});
