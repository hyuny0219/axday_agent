// server/static.ts: /api 밖 GET 요청을 dist/에서 서빙한다. index·assets(캐시 헤더)·SPA
// fallback·`..` 경로 탈출 차단·dist 없음(=404 JSON으로 대체)을 확인한다(T37).

import { createServer, request, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tryServeStatic } from '../../server/static';

let root: string;
let server: Server;

/** node:http.request는 URL 정규화 없이 path를 그대로 요청 라인에 실어 보낸다 — `..`가
 * 포함된 경로 탈출 시도를 fetch(WHATWG URL 정규화)를 거치지 않고 그대로 재현하기 위해
 * 쓴다. */
function rawGet(port: number, path: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf-8');
      });
      res.on('end', () => {
        resolvePromise({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function startServer(staticRoot: string): Promise<Server> {
  const s = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!tryServeStatic(staticRoot, pathname, res)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'not_found' }));
    }
  });
  return new Promise((resolvePromise) => {
    s.listen(0, () => resolvePromise(s));
  });
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'boardroom-static-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>boardroom index</title>');
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log("app");');
  server = await startServer(root);
});

afterEach(async () => {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  rmSync(root, { recursive: true, force: true });
});

function port(): number {
  return (server.address() as AddressInfo).port;
}

describe('tryServeStatic', () => {
  it('/ 요청에 index.html을 200·no-cache로 서빙한다', async () => {
    const res = await rawGet(port(), '/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toContain('boardroom index');
  });

  it('assets/ 파일은 확장자에 맞는 Content-Type과 immutable 캐시 헤더로 서빙한다', async () => {
    const res = await rawGet(port(), '/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/javascript');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.body).toContain('console.log');
  });

  it('존재하지 않는 경로는 index.html로 SPA fallback한다', async () => {
    const res = await rawGet(port(), '/some/client/route');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toContain('boardroom index');
  });

  it('`..`로 root 밖을 가리키려 하면 차단하고 index.html로 대체한다', async () => {
    const res = await rawGet(port(), '/assets/../../../../../../etc/passwd');
    expect(res.status).toBe(200);
    expect(res.body).toContain('boardroom index');
    expect(res.body).not.toContain('root:');
  });

  it('dist(root) 자체가 없으면 false를 돌려줘 호출부가 404 JSON을 낸다', async () => {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    rmSync(root, { recursive: true, force: true });
    server = await startServer(root);
    const res = await rawGet(port(), '/');
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'not_found' });
  });
});
