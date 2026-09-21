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

/** POST /api/ops/probe를 호출한다. 429(전역 10초 1회 제한)와 네트워크 예외는 UI가 그대로
 * 쓸 수 있는 실패 결과로 옮긴다. 서버가 준 성공/실패 진단(200 JSON)은 그대로 돌려준다. */
export async function probeModel(): Promise<ProbeResult> {
  try {
    const res = await fetch('/api/ops/probe', {
      method: 'POST',
      headers: accessHeaders(),
    });
    if (res.status === 429) {
      return { ok: false, error: 'probe_rate_limit' };
    }
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null) {
      return body as ProbeResult;
    }
    return { ok: false, error: 'invalid_response' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** GET /api/health를 호출해 서버 정보 한 줄(provider·mode·promptVersion)에 쓴다. 실패하면
 * null을 돌려주고 호출부가 정보 줄을 생략한다. */
export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: accessHeaders(),
    });
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
