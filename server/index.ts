// 서버 골격. GET /api/health와 4개 POST 엔드포인트의 라우팅·요청 검증·404/400 응답까지만
// 담당한다. 라운드·표·비서 핸들러의 실제 로직(모델 호출·집계 반영)은 T28(round·vote)·T31(비서)
// 에서 채웠다. AGENT_BOARDROOM_SPEC.md 5-6장, DEV_PLAN.md 11절.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { z } from 'zod';
import { loadConfig } from './config';
import { createMockProvider } from './providers/mock';
import { createAnthropicProvider } from './providers/anthropic';
import type { ModelProvider } from './providers/types';
import { RequestIdRegistry } from './validate';
import { roundRequestSchema, handleRound } from './handlers/round';
import { voteRequestSchema, handleVote } from './handlers/vote';
import {
  refineRequestSchema,
  summarizeRequestSchema,
  handleAssistantRefine,
  handleAssistantSummarize,
} from './handlers/assistant';
import {
  isAuthorized,
  isProtectedApiPath,
  loadAccessTokenConfig,
  requiresAccessToken,
} from './auth';
import { loadSessionLimitConfig, SessionLimitRegistry, type CallKind } from './sessionLimit';
import { systemClock } from './clock';
import { tryServeStatic } from './static';

const config = loadConfig();

const provider: ModelProvider =
  config.provider === 'anthropic'
    ? createAnthropicProvider({ modelId: config.modelId })
    : createMockProvider(config.modelId);

const requestIds = new RequestIdRegistry();
const accessTokenConfig = loadAccessTokenConfig();
const sessionLimitConfig = loadSessionLimitConfig();
const sessionLimitRegistry = new SessionLimitRegistry(systemClock, sessionLimitConfig);

/** 엔드포인트 → 세션당 호출 상한을 셀 때 쓰는 종류. */
const CALL_KIND_BY_ENDPOINT: Record<string, CallKind> = {
  'board.round': 'round',
  'board.vote': 'vote',
  'assistant.refine': 'refine',
  'assistant.summarize': 'summarize',
};
const DEFAULT_STATIC_DIR = resolve(process.cwd(), 'dist');

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** 요청 본문 상한. 정상 요청(회의 기록 12발언·초안 300자·메타)은 몇 KB이므로 64KiB면
 * 충분하고, 그 이상은 메모리 고갈 시도나 잘못된 클라이언트로 본다. */
export const MAX_BODY_BYTES = 64 * 1024;

class PayloadTooLargeError extends Error {
  constructor() {
    super('payload_too_large');
    this.name = 'PayloadTooLargeError';
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    received += (chunk as Buffer).length;
    if (received > MAX_BODY_BYTES) {
      // 스트리밍 중 상한을 넘기면 더 읽지 않고 바로 끊는다(chunked 본문도 여기서 잡힌다).
      throw new PayloadTooLargeError();
    }
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

/** 항상 200을 준다(호스팅 헬스체크가 토큰 없이도 통과해야 한다). 토큰이 요구되는데
 * 헤더가 없거나 틀리면 mode를 'scripted'로 내려 클라이언트가 자동으로 scripted에
 * 머무르게 한다 — 401로 막으면 헬스체크 자체가 실패해 호스팅이 서비스를 죽인다. */
function handleHealth(req: IncomingMessage, res: ServerResponse): void {
  const authRequired = requiresAccessToken(accessTokenConfig);
  const authorized = isAuthorized(accessTokenConfig, req.headers['x-access-token']);
  sendJson(res, 200, {
    ok: true,
    mode: authRequired && !authorized ? 'scripted' : 'live',
    authRequired,
    provider: config.provider,
    modelId: config.modelId,
    promptVersion: config.promptVersion,
  });
}

/** 라운드·표결·비서 엔드포인트 공통: 본문을 읽고 requestId 중복을 거절한 뒤 스키마별 파서와
 * 핸들러를 호출한다. 알 수 없는 scenarioId는 400으로, 그 외 예외는 상위 catch가 500으로
 * 돌린다. */
async function handleBoardEndpoint<T extends { requestId: string; sessionId: string }>(
  endpoint: string,
  schema: z.ZodType<T>,
  run: (data: T) => Promise<unknown>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      // 남은 본문을 더 읽지 않도록 이 연결은 응답 후 닫는다.
      res.setHeader('Connection', 'close');
      sendJson(res, 413, { error: 'payload_too_large', maxBytes: MAX_BODY_BYTES });
      return;
    }
    sendJson(res, 400, { error: 'invalid_json' });
    return;
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: 'invalid_request',
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  const limit = sessionLimitRegistry.allow(parsed.data.sessionId, CALL_KIND_BY_ENDPOINT[endpoint] ?? 'round');
  if (limit !== 'ok') {
    sendJson(res, 429, { error: limit });
    return;
  }

  if (!requestIds.register(parsed.data.requestId)) {
    sendJson(res, 400, { error: 'duplicate_request_id' });
    return;
  }

  try {
    const results = await run(parsed.data);
    sendJson(res, 200, results);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('unknown_scenario:')) {
      sendJson(res, 400, { error: 'unknown_scenario', endpoint });
      return;
    }
    throw err;
  }
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

const routes: Record<string, RouteHandler> = {
  'GET /api/health': handleHealth,
  'POST /api/board/round': (req, res) =>
    handleBoardEndpoint(
      'board.round',
      roundRequestSchema,
      (data) => handleRound(data, { provider }),
      req,
      res,
    ),
  'POST /api/board/vote': (req, res) =>
    handleBoardEndpoint(
      'board.vote',
      voteRequestSchema,
      (data) => handleVote(data, { provider }),
      req,
      res,
    ),
  'POST /api/assistant/refine': (req, res) =>
    handleBoardEndpoint(
      'assistant.refine',
      refineRequestSchema,
      (data) => handleAssistantRefine(data, { provider }),
      req,
      res,
    ),
  'POST /api/assistant/summarize': (req, res) =>
    handleBoardEndpoint(
      'assistant.summarize',
      summarizeRequestSchema,
      (data) => handleAssistantSummarize(data, { provider }),
      req,
      res,
    ),
};

export interface CreateBoardServerOptions {
  /** 정적 파일을 서빙할 디렉터리(기본 process.cwd()/dist). 테스트에서 고정 fixture를
   * 가리키도록 주입할 수 있다. */
  staticDir?: string;
}

export function createBoardServer(opts: CreateBoardServerOptions = {}) {
  const staticDir = opts.staticDir ?? DEFAULT_STATIC_DIR;
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';

    if (
      isProtectedApiPath(url.pathname) &&
      !isAuthorized(accessTokenConfig, req.headers['x-access-token'])
    ) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }

    const key = `${method} ${url.pathname}`;
    const handler = routes[key];
    if (handler) {
      Promise.resolve(handler(req, res)).catch(() => {
        sendJson(res, 500, { error: 'internal_error' });
      });
      return;
    }

    // /api 밖의 GET은 정적 파일(dist/)로 서빙한다. dist가 없으면(로컬 API 전용 서버)
    // tryServeStatic이 false를 돌려줘 기존 404 JSON으로 대체된다.
    if (
      method === 'GET' &&
      !url.pathname.startsWith('/api') &&
      tryServeStatic(staticDir, url.pathname, res)
    ) {
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });
}

/* c8 ignore start -- 진입점 실행은 통합 확인(curl)으로 검증하고 단위 테스트 대상이 아니다. */
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const server = createBoardServer();
  server.listen(config.port, () => {
    console.log(
      `board server listening on :${config.port} (mode=live provider=${config.provider} modelId=${config.modelId})`,
    );
  });
}
/* c8 ignore stop */
