// 정적 서빙(T37). Render 같은 무료 웹호스팅은 서버 프로세스 하나만 띄워 주므로, /api 밖의
// GET 요청은 이 서버가 빌드 산출물(dist/)에서 직접 서빙한다. 로컬 개발(`npm run dev`)·
// 기존 E2E(`npm run preview`)는 이 경로를 쓰지 않는다 — vite 자체가 정적 서빙을 맡는다.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** pathname을 root 아래 실제 파일 경로로 정규화한다. `..`로 root 밖을 가리키려 하면
 * null을 돌려줘 호출부가 요청을 거절(=SPA fallback으로 대체)하게 한다. */
function resolveWithinRoot(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const full = resolve(root, `.${decoded}`);
  if (full !== root && !full.startsWith(root + sep)) {
    return null;
  }
  return full;
}

function sendFile(res: ServerResponse, filePath: string, cacheControl: string): void {
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': cacheControl,
  });
  createReadStream(filePath).pipe(res);
}

function cacheControlFor(root: string, filePath: string): string {
  const assetsDir = join(root, 'assets') + sep;
  return filePath.startsWith(assetsDir) ? 'public, max-age=31536000, immutable' : 'no-cache';
}

/**
 * `/api` 밖의 GET 요청을 root(dist/) 아래에서 서빙한다. 요청한 파일이 있으면 그 파일을,
 * 없으면 root/index.html로 SPA fallback한다(클라이언트 라우팅이 새로고침에도 200을 받게
 * 하기 위해). root 자체나 root/index.html이 없으면 false를 돌려줘 호출부가 기존 404
 * JSON 응답을 대신 내도록 한다.
 */
export function tryServeStatic(root: string, pathname: string, res: ServerResponse): boolean {
  const indexPath = join(root, 'index.html');
  if (!existsSync(indexPath)) {
    return false;
  }

  if (pathname !== '/') {
    const requestedPath = resolveWithinRoot(root, pathname);
    if (requestedPath) {
      try {
        const stat = statSync(requestedPath);
        if (stat.isFile()) {
          sendFile(res, requestedPath, cacheControlFor(root, requestedPath));
          return true;
        }
      } catch {
        // 파일이 없으면 아래에서 SPA fallback으로 처리한다.
      }
    }
  }

  sendFile(res, indexPath, 'no-cache');
  return true;
}
