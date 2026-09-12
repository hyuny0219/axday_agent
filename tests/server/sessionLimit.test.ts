// server/sessionLimit.ts: 시간당 새 세션 상한을 슬라이딩 윈도로 지킨다. 이미 본
// sessionId는 상한과 무관하게 항상 통과하고, 윈도가 지나면 오래된 세션이 빠져나가 새
// 세션을 다시 받을 수 있다. 마지막 테스트는 server/index.ts의 createBoardServer가 이
// 레지스트리를 실제로 429에 연결하는지 확인한다(AGENT_BOARDROOM_SPEC.md와 무관, T37
// 배포 안전장치).

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAX_SESSIONS_PER_HOUR,
  DEFAULT_SESSION_TTL_MINUTES,
  loadSessionLimitConfig,
  SessionLimitRegistry,
} from '../../server/sessionLimit';
import type { Clock } from '../../server/clock';

function fakeClock(start: number): { clock: Clock; advance: (ms: number) => void } {
  let now = start;
  return {
    clock: { now: () => now },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('loadSessionLimitConfig', () => {
  it('MAX_SESSIONS_PER_HOUR이 없으면 기본값 30을 쓴다', () => {
    expect(loadSessionLimitConfig({}).maxPerHour).toBe(DEFAULT_MAX_SESSIONS_PER_HOUR);
  });

  it('유효한 값이 있으면 그대로 쓴다', () => {
    expect(loadSessionLimitConfig({ MAX_SESSIONS_PER_HOUR: '5' }).maxPerHour).toBe(5);
  });

  it('0 이하이거나 숫자가 아니면 기본값으로 되돌아간다', () => {
    expect(loadSessionLimitConfig({ MAX_SESSIONS_PER_HOUR: '0' }).maxPerHour).toBe(
      DEFAULT_MAX_SESSIONS_PER_HOUR,
    );
    expect(loadSessionLimitConfig({ MAX_SESSIONS_PER_HOUR: 'nope' }).maxPerHour).toBe(
      DEFAULT_MAX_SESSIONS_PER_HOUR,
    );
  });
});

describe('SessionLimitRegistry', () => {
  it('상한 이내 새 세션은 통과시키고, 상한을 넘는 새 세션은 session_limit으로 거절한다', () => {
    const { clock } = fakeClock(0);
    const registry = new SessionLimitRegistry(clock, 3);
    expect(registry.allow('s1', 'round')).toBe('ok');
    expect(registry.allow('s2', 'round')).toBe('ok');
    expect(registry.allow('s3', 'round')).toBe('ok');
    expect(registry.allow('s4', 'round')).toBe('session_limit');
  });

  it('이미 등록된 sessionId는 시간당 상한과 무관하게 통과하되, 종류별 호출 상한 안에서만 통과한다', () => {
    const { clock } = fakeClock(0);
    const registry = new SessionLimitRegistry(clock, 1);
    expect(registry.allow('s1', 'round')).toBe('ok'); // OPINIONS
    expect(registry.allow('s1', 'round')).toBe('ok'); // REACTIONS
    expect(registry.allow('s1', 'round')).toBe('ok'); // FOLLOWUP
    expect(registry.allow('s1', 'round')).toBe('call_limit');
    expect(registry.allow('s1', 'vote')).toBe('ok');
    expect(registry.allow('s1', 'vote')).toBe('call_limit');
    expect(registry.allow('s1', 'refine')).toBe('ok');
    expect(registry.allow('s1', 'refine')).toBe('ok');
    expect(registry.allow('s1', 'refine')).toBe('call_limit');
  });

  it('수명(기본 15분)이 지난 세션은 새 requestId로 와도 session_expired로 거절한다', () => {
    const { clock, advance } = fakeClock(0);
    const registry = new SessionLimitRegistry(clock, 5);
    expect(registry.allow('s1', 'round')).toBe('ok');
    advance(DEFAULT_SESSION_TTL_MINUTES * 60 * 1000 - 1);
    expect(registry.allow('s1', 'round')).toBe('ok');
    advance(1);
    expect(registry.allow('s1', 'round')).toBe('session_expired');
    expect(registry.allow('s1', 'summarize')).toBe('session_expired');
  });

  it('윈도가 지나기 전에는 새 세션을 계속 거절한다', () => {
    const { clock, advance } = fakeClock(0);
    const registry = new SessionLimitRegistry(clock, 1);
    expect(registry.allow('s1', 'round')).toBe('ok');
    advance(60 * 60 * 1000 - 1);
    expect(registry.allow('s2', 'round')).toBe('session_limit');
  });

  it('1시간이 지나면 오래된 세션이 창에서 빠져 새 세션을 다시 받을 수 있다', () => {
    const { clock, advance } = fakeClock(0);
    const registry = new SessionLimitRegistry(clock, 1);
    expect(registry.allow('s1', 'round')).toBe('ok');
    expect(registry.allow('s2', 'round')).toBe('session_limit');
    advance(60 * 60 * 1000);
    expect(registry.allow('s2', 'round')).toBe('ok');
  });

  it('SESSION_TTL_MINUTES 환경변수로 수명을 바꿀 수 있다', () => {
    expect(loadSessionLimitConfig({ SESSION_TTL_MINUTES: '2' }).sessionTtlMs).toBe(2 * 60 * 1000);
    expect(loadSessionLimitConfig({}).sessionTtlMs).toBe(DEFAULT_SESSION_TTL_MINUTES * 60 * 1000);
  });
});

function baseRoundBody(sessionId: string, requestId: string) {
  return {
    sessionId,
    requestId,
    mode: 'live',
    stage: 'OPINIONS',
    transcript: { revision: 0, statements: [] },
    scenarioId: 'ai-assistant',
    budgetMs: 8000,
  };
}

describe('createBoardServer가 세션 상한을 429로 연결한다', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('MAX_SESSIONS_PER_HOUR을 넘는 새 sessionId는 429 session_limit을 받는다', async () => {
    vi.resetModules();
    vi.stubEnv('MAX_SESSIONS_PER_HOUR', '1');
    vi.stubEnv('ACCESS_TOKEN', '');
    const { createBoardServer } = await import('../../server/index');
    const server: Server = createBoardServer();
    await new Promise<void>((resolvePromise) => server.listen(0, resolvePromise));
    const { port } = server.address() as AddressInfo;
    const url = (path: string) => `http://127.0.0.1:${port}${path}`;

    try {
      const first = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRoundBody('session-limit-1', 'req-limit-1')),
      });
      expect(first.status).not.toBe(429);

      const second = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRoundBody('session-limit-2', 'req-limit-2')),
      });
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({ error: 'session_limit' });

      // 같은 세션은 라운드 3회까지만 통과하고 4번째부터 call_limit이다(requestId는 매번 새것).
      for (let n = 2; n <= 3; n += 1) {
        const again = await fetch(url('/api/board/round'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseRoundBody('session-limit-1', `req-limit-1-${n}`)),
        });
        expect(again.status).not.toBe(429);
      }
      const fourth = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRoundBody('session-limit-1', 'req-limit-1-4')),
      });
      expect(fourth.status).toBe(429);
      expect(await fourth.json()).toEqual({ error: 'call_limit' });
    } finally {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    }
  });
});
