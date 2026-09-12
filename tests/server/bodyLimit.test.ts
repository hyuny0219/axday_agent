// server/index.ts: 요청 본문 상한(MAX_BODY_BYTES). Content-Length가 큰 요청과 Content-Length
// 없이 chunked로 흘려보내는 큰 요청 모두 413으로 끊고, 정상 크기는 스키마 검증으로 넘어간다
// (Codex 검토 반영 — 메모리 고갈 방지).

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { request } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function startServer(): Promise<{ port: number; close: () => Promise<void> }> {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('ACCESS_TOKEN', '');
  const mod = await import('../../server/index');
  const server: Server = mod.createBoardServer();
  await new Promise<void>((resolvePromise) => server.listen(0, resolvePromise));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  };
}

/** Content-Length 없이 chunked 전송으로 본문을 보낸다(fetch는 항상 길이를 붙이므로 http.request 사용). */
function postChunked(
  port: number,
  path: string,
  chunks: string[],
): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (part: string) => {
          body += part;
        });
        res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', (err: NodeJS.ErrnoException) => {
      // 서버가 상한에서 연결을 끊으면 쓰기 도중 EPIPE/ECONNRESET가 날 수 있다. 응답을 이미
      // 받았으면 위 resolve가 먼저 호출되므로 여기서는 무시한다.
      if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
      reject(err);
    });
    for (const chunk of chunks) {
      req.write(chunk);
    }
    req.end();
  });
}

describe('요청 본문 상한', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Content-Length가 상한을 넘으면 본문을 읽기 전에 413을 준다', async () => {
    const { port, close } = await startServer();
    const { MAX_BODY_BYTES } = await import('../../server/index');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/board/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 's',
          requestId: 'r',
          pad: 'x'.repeat(MAX_BODY_BYTES + 1024),
        }),
      });
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: 'payload_too_large', maxBytes: MAX_BODY_BYTES });
    } finally {
      await close();
    }
  });

  it('Content-Length 없이 chunked로 상한을 넘겨도 413으로 끊는다', async () => {
    const { port, close } = await startServer();
    const { MAX_BODY_BYTES } = await import('../../server/index');
    try {
      const piece = '{"pad":"' + 'x'.repeat(8 * 1024);
      const chunks = Array.from(
        { length: Math.ceil((MAX_BODY_BYTES * 2) / piece.length) },
        () => piece,
      );
      const res = await postChunked(port, '/api/board/round', chunks);
      expect(res.status).toBe(413);
    } finally {
      await close();
    }
  });

  it('상한 이내의 잘못된 JSON은 여전히 400 invalid_json이다', async () => {
    const { port, close } = await startServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/board/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_json' });
    } finally {
      await close();
    }
  });
});
