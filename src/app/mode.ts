// 앱 시작 시 서버 가용성을 한 번 확인해 live/scripted 모드를 고정한다(AGENT_BOARDROOM_SPEC.md
// 6장 "세션 시작 전에 live/scripted 모드를 고정하고 화면에 표시한다"). GET /api/health가 1.5초
// 안에 성공 응답(2xx)을 주면 live, 그 외(실패·timeout·네트워크 예외)에는 scripted로 안전하게
// 떨어진다. 이 파일은 SET_MODE 액션을 만들 뿐, 언제 dispatch할지(ATTRACT/SELECT 단계에서 한
// 번)는 호출부(App.tsx)의 책임이다.
//
// `?mode=scripted` 쿼리가 있으면 서버 상태를 묻지 않고 바로 scripted로 고정한다(T30). 기존
// E2E가 mock 서버를 항상 띄워 둔 채로도 scripted 경로를 강제할 수 있게 하기 위해서다.

import type { SessionAction } from '../domain/session';

/** GET /api/health 응답을 기다리는 최대 시간. */
export const MODE_HEALTH_CHECK_TIMEOUT_MS = 1500;

function forcedScriptedByQuery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('mode') === 'scripted';
}

async function checkServerHealthy(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', { method: 'GET', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 세션 시작 전 한 번 호출해 SET_MODE 액션을 만든다. `?mode=scripted`가 있으면 그대로
 * scripted, 아니면 서버가 1.5초 안에 정상 응답할 때만 live다. */
export async function detectInitialMode(): Promise<SessionAction> {
  if (forcedScriptedByQuery()) {
    return { type: 'SET_MODE', mode: 'scripted' };
  }
  const healthy = await checkServerHealthy(MODE_HEALTH_CHECK_TIMEOUT_MS);
  return { type: 'SET_MODE', mode: healthy ? 'live' : 'scripted' };
}
