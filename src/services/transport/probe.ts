// 운영 메뉴 "모델 연결 확인"·서버 정보(T49, DESIGN_SPEC.md v1.0 10절)가 쓰는 클라이언트
// 어댑터. OperatorMenu.tsx는 이 두 함수만 호출하고 fetch·헤더·오류 분류는 여기서 감춘다.

import { accessHeaders } from './accessToken';

export interface ProbeResult {
  ok: boolean;
  provider?: string;
  modelId?: string;
  latencyMs?: number;
  error?: string;
}

export interface HealthInfo {
  mode: string;
  provider: string;
  modelId: string;
  promptVersion: string;
}

/** 클라이언트 쪽 대기 상한. 서버는 제공자 호출을 8초로 끊지만, 연결 자체가 블랙홀이면
 * 그 8초가 시작되지도 않아 fetch가 영원히 대기한다 — 그동안 패널의 닫기가 비활성이라 운영자가
 * 실패를 보지도, scripted 대안으로 돌아가지도 못했다(PR #10 Codex 9차 검토 P2). 서버 상한
 * 8초 + 왕복 여유로 12초, 보조 정보(health)는 5초. */
export const PROBE_TIMEOUT_MS = 12_000;
export const HEALTH_TIMEOUT_MS = 5_000;

export interface ProbeOptions {
  timeoutMs?: number;
}

/**
 * fetch를 시간 상한으로 감싼다. AbortController로 요청을 끊고, 신호를 무시하는 구현(테스트
 * 스텁 등)에서도 반드시 끝나도록 타이머와 경주시킨다. 상한을 넘기면 name이 'TimeoutError'인
 * 오류로 거절한다.
 */
async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const err = new Error(`timeout after ${timeoutMs}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(input, { ...init, signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

/** POST /api/ops/probe를 호출한다. 429(전역 10초 1회 제한)와 네트워크 예외는 UI가 그대로
 * 쓸 수 있는 실패 결과로 옮긴다. 서버가 준 성공/실패 진단(200 JSON)은 그대로 돌려준다.
 * 시간 상한을 넘기면 error 'timeout'이다. */
export async function probeModel(options: ProbeOptions = {}): Promise<ProbeResult> {
  try {
    const res = await fetchWithTimeout(
      '/api/ops/probe',
      { method: 'POST', headers: accessHeaders() },
      options.timeoutMs ?? PROBE_TIMEOUT_MS,
    );
    if (res.status === 429) {
      return { ok: false, error: 'probe_rate_limit' };
    }
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null) {
      return body as ProbeResult;
    }
    return { ok: false, error: 'invalid_response' };
  } catch (err) {
    return { ok: false, error: isTimeout(err) ? 'timeout' : 'network' };
  }
}

/** GET /api/health를 호출해 서버 정보 한 줄(provider·mode·promptVersion)에 쓴다. 실패하면
 * null을 돌려주고 호출부가 정보 줄을 생략한다. */
export async function fetchHealth(options: ProbeOptions = {}): Promise<HealthInfo | null> {
  try {
    const res = await fetchWithTimeout(
      '/api/health',
      { method: 'GET', headers: accessHeaders() },
      options.timeoutMs ?? HEALTH_TIMEOUT_MS,
    );
    if (!res.ok) {
      return null;
    }
    const body: unknown = await res.json();
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const { mode, provider, modelId, promptVersion } = body as Record<string, unknown>;
    if (
      typeof mode !== 'string' ||
      typeof provider !== 'string' ||
      typeof modelId !== 'string' ||
      typeof promptVersion !== 'string'
    ) {
      return null;
    }
    return { mode, provider, modelId, promptVersion };
  } catch {
    return null;
  }
}
