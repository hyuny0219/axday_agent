// server/auth.ts: ACCESS_TOKEN이 비어 있으면 개방, 설정돼 있으면 /api/board/*·
// /api/assistant/*는 x-access-token 헤더가 일치해야 통과한다. /api/health는 항상 200을
// 주되 토큰이 요구되는데 없거나 틀리면 mode:'scripted'·authRequired:true를 내려 클라이언트가
// 자동으로 scripted에 머무르게 한다(T37).

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthorized, isProtectedApiPath, loadAccessTokenConfig, requiresAccessToken } from '../../server/auth';

describe('loadAccessTokenConfig', () => {
  it('ACCESS_TOKEN이 없으면 token이 null(개방)이다', () => {
    expect(loadAccessTokenConfig({})).toEqual({ token: null });
    expect(loadAccessTokenConfig({ ACCESS_TOKEN: '   ' })).toEqual({ token: null });
  });

  it('ACCESS_TOKEN이 있으면 그대로(trim해서) 쓴다', () => {
    expect(loadAccessTokenConfig({ ACCESS_TOKEN: '  secret  ' })).toEqual({ token: 'secret' });
  });
});

describe('requiresAccessToken / isAuthorized', () => {
  it('token이 null이면 항상 통과한다(헤더가 없어도)', () => {
    const config = { token: null };
    expect(requiresAccessToken(config)).toBe(false);
    expect(isAuthorized(config, undefined)).toBe(true);
    expect(isAuthorized(config, 'anything')).toBe(true);
  });

  it('token이 설정되면 정확히 일치하는 헤더만 통과한다', () => {
    const config = { token: 'secret-token' };
    expect(requiresAccessToken(config)).toBe(true);
    expect(isAuthorized(config, 'secret-token')).toBe(true);
    expect(isAuthorized(config, 'wrong-token')).toBe(false);
    expect(isAuthorized(config, undefined)).toBe(false);
    expect(isAuthorized(config, '')).toBe(false);
  });
});

describe('isProtectedApiPath', () => {
  it('board·assistant 엔드포인트만 보호 대상으로 본다', () => {
    expect(isProtectedApiPath('/api/board/round')).toBe(true);
    expect(isProtectedApiPath('/api/board/vote')).toBe(true);
    expect(isProtectedApiPath('/api/assistant/refine')).toBe(true);
    expect(isProtectedApiPath('/api/assistant/summarize')).toBe(true);
    expect(isProtectedApiPath('/api/ops/probe')).toBe(true);
    expect(isProtectedApiPath('/api/health')).toBe(false);
    expect(isProtectedApiPath('/')).toBe(false);
    expect(isProtectedApiPath('/index.html')).toBe(false);
  });
});

async function startServer(env: Record<string, string>): Promise<{
  url: (path: string) => string;
  close: () => Promise<void>;
}> {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const mod = await import('../../server/index');
  const server: Server = mod.createBoardServer();
  await new Promise<void>((resolvePromise) => server.listen(0, resolvePromise));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    close: () => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  };
}

describe('createBoardServer + ACCESS_TOKEN 통합', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ACCESS_TOKEN이 비어 있으면 개방: health는 live·authRequired:false, board는 401 없이 스키마 검증으로 넘어간다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: '' });
    try {
      const health = await fetch(url('/api/health'));
      const healthBody = (await health.json()) as { mode: string; authRequired: boolean };
      expect(health.status).toBe(200);
      expect(healthBody.mode).toBe('live');
      expect(healthBody.authRequired).toBe(false);

      const round = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(round.status).toBe(400); // 401이 아니라 스키마 검증 실패(본문이 비어 있음)
    } finally {
      await close();
    }
  });

  it('ACCESS_TOKEN이 설정되면 헤더 없는 board/assistant 요청을 401로 거절한다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: 'secret-token' });
    try {
      const round = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(round.status).toBe(401);
      expect(await round.json()).toEqual({ error: 'unauthorized' });

      const refine = await fetch(url('/api/assistant/refine'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(refine.status).toBe(401);
    } finally {
      await close();
    }
  });

  it('올바른 x-access-token 헤더가 있으면 401을 건너뛰어 스키마 검증으로 넘어간다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: 'secret-token' });
    try {
      const round = await fetch(url('/api/board/round'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-token': 'secret-token' },
        body: '{}',
      });
      expect(round.status).toBe(400);
    } finally {
      await close();
    }
  });

  it('health는 토큰이 요구될 때 헤더가 없거나 틀리면 200·mode:scripted·authRequired:true를 준다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: 'secret-token' });
    try {
      const noHeader = await fetch(url('/api/health'));
      const noHeaderBody = (await noHeader.json()) as { mode: string; authRequired: boolean };
      expect(noHeader.status).toBe(200);
      expect(noHeaderBody.mode).toBe('scripted');
      expect(noHeaderBody.authRequired).toBe(true);

      const wrongHeader = await fetch(url('/api/health'), { headers: { 'x-access-token': 'wrong' } });
      const wrongBody = (await wrongHeader.json()) as { mode: string };
      expect(wrongHeader.status).toBe(200);
      expect(wrongBody.mode).toBe('scripted');

      const rightHeader = await fetch(url('/api/health'), { headers: { 'x-access-token': 'secret-token' } });
      const rightBody = (await rightHeader.json()) as { mode: string; authRequired: boolean };
      expect(rightHeader.status).toBe(200);
      expect(rightBody.mode).toBe('live');
      expect(rightBody.authRequired).toBe(true);
    } finally {
      await close();
    }
  });

  it('/api/ops/probe는 board·assistant처럼 토큰 없이 401로 거절된다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: 'secret-token' });
    try {
      const probe = await fetch(url('/api/ops/probe'), { method: 'POST' });
      expect(probe.status).toBe(401);
      expect(await probe.json()).toEqual({ error: 'unauthorized' });
    } finally {
      await close();
    }
  });

  it('/api/ops/probe는 전역 10초에 1회만 허용하고 초과 호출은 429 probe_rate_limit이다', async () => {
    const { url, close } = await startServer({ ACCESS_TOKEN: '' });
    try {
      const first = await fetch(url('/api/ops/probe'), { method: 'POST' });
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as { ok: boolean };
      expect(firstBody.ok).toBe(true);

      const second = await fetch(url('/api/ops/probe'), { method: 'POST' });
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({ error: 'probe_rate_limit' });
    } finally {
      await close();
    }
  });
});
