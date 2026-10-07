// 운영 메뉴 "모델 연결 확인"(T49, DESIGN_SPEC.md v1.0 10절)이 쓰는 진단 호출. 실제
// 제공자에 아주 짧은 호출 1회(ROUND_TIMEOUT_MS 상한)를 보내 응답 계약 { ok: true }를
// 확인한다. 라운드·
// 표·비서 핸들러와 달리 세션·요청 검증을 거치지 않는 순수 함수다 — 결과는 항상(성공이든
// 실패든) 값으로 돌려주고 예외를 던지지 않는다(호출자인 server/index.ts가 그대로 200으로
// 응답한다).

import type { ModelProvider } from '../providers/types';
import type { ProviderName } from '../config';
import type { Clock } from '../clock';
import { logCall } from '../log';
import { PROMPT_VERSION } from '../prompts/version';
import { withTimeout } from './timeout';
import { classifyFailure } from './shared';

/** 진단 호출에 허용하는 최대 시간(호환용 기본값, T65: config.ts의 ROUND_TIMEOUT_MS와 같은
 * 값 — probe도 OPINIONS·VOTE와 같은 예산을 쓴다. server/index.ts는 항상 config.roundTimeoutMs를
 * 명시해서 넘기므로 실제로는 이 값이 쓰이지 않는다, T91에서 DEFAULT_ROUND_TIMEOUT_MS와 같이
 * 15000으로 올렸다). */
export const PROBE_TIMEOUT_MS = 15000;

/** 오류 메시지를 화면·로그에 남길 때 자르는 길이. */
const MAX_ERROR_LENGTH = 200;

// 실제 API는 object 스키마에 additionalProperties:false를 명시하지 않으면 400으로 거부한다
// (round.ts·vote.ts·assistant.ts의 스키마와 같은 규칙).
const PROBE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
};

export interface ProbeResult {
  ok: boolean;
  provider: ProviderName;
  modelId: string;
  latencyMs: number;
  error?: string;
}

export interface ProbeDeps {
  provider: ModelProvider;
  /** 실패 시 돌려줄 modelId(설정값)와 결과에 실을 provider 이름. */
  config: { provider: ProviderName; modelId: string };
  clock: Clock;
  /** config.ts의 ROUND_TIMEOUT_MS(T65). 생략하면 PROBE_TIMEOUT_MS(8000)를 쓴다. */
  timeoutMs?: number;
}

function isOkResponse(json: unknown): boolean {
  return typeof json === 'object' && json !== null && (json as { ok?: unknown }).ok === true;
}

function truncateError(message: string): string {
  return message.length > MAX_ERROR_LENGTH ? message.slice(0, MAX_ERROR_LENGTH) : message;
}

/** 제공자에 짧은 확인 호출 1회를 보내고 성공/실패를 값으로 돌려준다. */
export async function handleProbe({ provider, config, clock, timeoutMs }: ProbeDeps): Promise<ProbeResult> {
  const start = clock.now();
  const effectiveTimeoutMs = timeoutMs ?? PROBE_TIMEOUT_MS;
  try {
    const raw = provider.complete({
      system: '연결 확인. JSON {"ok": true}만 응답.',
      user: 'ok',
      schema: PROBE_SCHEMA,
      maxTokens: 20,
      timeoutMs: effectiveTimeoutMs,
    });
    const result = await withTimeout(raw, effectiveTimeoutMs);
    const latencyMs = clock.now() - start;
    if (!isOkResponse(result.json)) {
      logCall({
        ts: new Date(clock.now()).toISOString(),
        kind: 'probe',
        status: 'failed',
        failReason: 'invalid_response',
        providerErrorClass: 'invalid_response',
        latencyMs,
        timeoutMs: effectiveTimeoutMs,
        promptVersion: PROMPT_VERSION,
        modelId: result.modelId,
      });
      return {
        ok: false,
        provider: config.provider,
        modelId: config.modelId,
        latencyMs,
        error: 'probe_response_not_ok',
      };
    }
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'probe',
      status: 'answered',
      latencyMs,
      timeoutMs: effectiveTimeoutMs,
      promptVersion: PROMPT_VERSION,
      modelId: result.modelId,
    });
    return { ok: true, provider: config.provider, modelId: result.modelId, latencyMs };
  } catch (err) {
    const latencyMs = clock.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const { failReason, providerErrorClass, httpStatus } = classifyFailure(err);
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'probe',
      status: 'failed',
      failReason,
      providerErrorClass,
      httpStatus,
      latencyMs,
      timeoutMs: effectiveTimeoutMs,
      promptVersion: PROMPT_VERSION,
      modelId: '',
    });
    return {
      ok: false,
      provider: config.provider,
      modelId: config.modelId,
      latencyMs,
      error: truncateError(message),
    };
  }
}
