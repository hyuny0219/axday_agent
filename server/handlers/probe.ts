// 운영 메뉴 "모델 연결 확인"(T49, DESIGN_SPEC.md v1.0 10절)이 쓰는 진단 호출. 실제
// 제공자에 아주 짧은 호출 1회(8초 상한)를 보내 응답 계약 { ok: true }를 확인한다. 라운드·
// 표·비서 핸들러와 달리 세션·요청 검증을 거치지 않는 순수 함수다 — 결과는 항상(성공이든
// 실패든) 값으로 돌려주고 예외를 던지지 않는다(호출자인 server/index.ts가 그대로 200으로
// 응답한다).

import type { ModelProvider } from '../providers/types';
import type { ProviderName } from '../config';
import type { Clock } from '../clock';
import { withTimeout } from './timeout';

/** 진단 호출에 허용하는 최대 시간. DESIGN_SPEC.md v1.0 10절 "8초 상한". */
export const PROBE_TIMEOUT_MS = 8000;

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
}

function isOkResponse(json: unknown): boolean {
  return typeof json === 'object' && json !== null && (json as { ok?: unknown }).ok === true;
}

function truncateError(message: string): string {
  return message.length > MAX_ERROR_LENGTH ? message.slice(0, MAX_ERROR_LENGTH) : message;
}

/** 제공자에 짧은 확인 호출 1회를 보내고 성공/실패를 값으로 돌려준다. */
export async function handleProbe({ provider, config, clock }: ProbeDeps): Promise<ProbeResult> {
  const start = clock.now();
  try {
    const raw = provider.complete({
      system: '연결 확인. JSON {"ok": true}만 응답.',
      user: 'ok',
      schema: PROBE_SCHEMA,
      maxTokens: 20,
      timeoutMs: PROBE_TIMEOUT_MS,
    });
    const result = await withTimeout(raw, PROBE_TIMEOUT_MS);
    const latencyMs = clock.now() - start;
    if (!isOkResponse(result.json)) {
      return {
        ok: false,
        provider: config.provider,
        modelId: config.modelId,
        latencyMs,
        error: 'probe_response_not_ok',
      };
    }
    return { ok: true, provider: config.provider, modelId: result.modelId, latencyMs };
  } catch (err) {
    const latencyMs = clock.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      provider: config.provider,
      modelId: config.modelId,
      latencyMs,
      error: truncateError(message),
    };
  }
}
