// 서버 골격. GET /api/health와 4개 POST 엔드포인트의 라우팅·요청 검증·404/400 응답까지만
// 담당한다. 라운드·표·비서 핸들러의 실제 로직(모델 호출·집계 반영)은 T28·T31에서 채운다.
// AGENT_BOARDROOM_SPEC.md 5-6장, DEV_PLAN.md 11절.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config';
import { createMockProvider } from './providers/mock';
import { createAnthropicProvider } from './providers/anthropic';
import type { ModelProvider } from './providers/types';
import { requestMetaSchema, RequestIdRegistry } from './validate';

const config = loadConfig();

const provider: ModelProvider =
  config.provider === 'anthropic'
    ? createAnthropicProvider({ modelId: config.modelId })
    : createMockProvider(config.modelId);

// T27 범위에서는 어떤 핸들러도 provider를 아직 호출하지 않는다(요청 검증까지만).
// T28/T31에서 이 provider를 라운드·비서 핸들러에 연결한다.
void provider;

const requestIds = new RequestIdRegistry();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (raw.trim() === '') {
    return {};
  }
  return JSON.parse(raw);
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, {
    ok: true,
    mode: 'live',
    provider: config.provider,
    modelId: config.modelId,
    promptVersion: config.promptVersion,
  });
}

/**
 * 라운드·표·비서 엔드포인트의 공통 골격: 요청 본문을 읽고 공통 메타(sessionId 등)를
 * 검증하고 requestId 중복을 거절한다. 여기까지 통과하면 아직 구현되지 않은 본문
 * 로직을 알리는 501을 돌려준다(T28·T31에서 실제 응답으로 교체).
 */
async function handleStub(endpoint: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
    return;
  }

  const parsed = requestMetaSchema.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: 'invalid_request',
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  if (!requestIds.register(parsed.data.requestId)) {
    sendJson(res, 400, { error: 'duplicate_request_id' });
    return;
  }

  sendJson(res, 501, { error: 'not_implemented', endpoint });
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

const routes: Record<string, RouteHandler> = {
  'GET /api/health': handleHealth,
  'POST /api/board/round': (req, res) => handleStub('board.round', req, res),
  'POST /api/board/vote': (req, res) => handleStub('board.vote', req, res),
  'POST /api/assistant/refine': (req, res) => handleStub('assistant.refine', req, res),
  'POST /api/assistant/summarize': (req, res) => handleStub('assistant.summarize', req, res),
};

export function createBoardServer() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const key = `${req.method ?? 'GET'} ${url.pathname}`;
    const handler = routes[key];
    if (!handler) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    Promise.resolve(handler(req, res)).catch(() => {
      sendJson(res, 500, { error: 'internal_error' });
    });
  });
}

/* c8 ignore start -- 진입점 실행은 통합 확인(curl)으로 검증하고 단위 테스트 대상이 아니다. */
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const server = createBoardServer();
  server.listen(config.port, () => {
    console.log(
      `board server listening on :${config.port} (mode=live provider=${config.provider} modelId=${config.modelId})`,
    );
  });
}
/* c8 ignore stop */
