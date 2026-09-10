// 앱 시작 시 서버 가용성을 한 번 확인해 live/scripted 모드를 고정한다(AGENT_BOARDROOM_SPEC.md
// 6장 "세션 시작 전에 live/scripted 모드를 고정하고 화면에 표시한다"). GET /api/health가 1.5초
// 안에 성공 응답(2xx)을 주면 live, 그 외(실패·timeout·네트워크 예외)에는 scripted로 안전하게
// 떨어진다. 이 파일은 SET_MODE 액션을 만들 뿐, 언제 dispatch할지(ATTRACT/SELECT 단계에서 한
// 번)는 호출부(App.tsx)의 책임이다.
//
// `?mode=scripted` 쿼리가 있으면 서버 상태를 묻지 않고 바로 scripted로 고정한다(T30). 기존
// E2E가 mock 서버를 항상 띄워 둔 채로도 scripted 경로를 강제할 수 있게 하기 위해서다.
//
// 접속 토큰이 걸린 공개 배포(T37)에서는 /api/health가 항상 200을 주되, 토큰이 없거나
// 틀리면 본문의 mode를 'scripted'로 내려 보낸다(호스팅 헬스체크는 통과시키면서 클라이언트는
// 자동으로 scripted에 머무르게 하기 위해서다) — 그래서 status만으로 판단하지 않고 본문의
// mode 필드를 그대로 따른다.

import type { SessionAction } from '../domain/session';
import { accessHeaders } from '../services/transport/accessToken';

/** GET /api/health 응답을 기다리는 최대 시간. */
export const MODE_HEALTH_CHECK_TIMEOUT_MS = 1500;

function forcedScriptedByQuery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('mode') === 'scripted';
}

async function checkServerMode(timeoutMs: number): Promise<'live' | 'scripted'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal,
      headers: accessHeaders(),
    });
    if (!res.ok) {
      return 'scripted';
    }
    const body: unknown = await res.json();
    const mode = typeof body === 'object' && body !== null ? (body as { mode?: unknown }).mode : undefined;
    return mode === 'live' ? 'live' : 'scripted';
  } catch {
    return 'scripted';
  } finally {
    clearTimeout(timer);
  }
}

/** 세션 시작 전 한 번 호출해 SET_MODE 액션을 만든다. `?mode=scripted`가 있으면 그대로
 * scripted, 아니면 서버가 1.5초 안에 mode:'live'로 응답할 때만 live다. */
export async function detectInitialMode(): Promise<SessionAction> {
  if (forcedScriptedByQuery()) {
    return { type: 'SET_MODE', mode: 'scripted' };
  }
  const mode = await checkServerMode(MODE_HEALTH_CHECK_TIMEOUT_MS);
  return { type: 'SET_MODE', mode };
}
