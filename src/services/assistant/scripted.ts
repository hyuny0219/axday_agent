// 사전 구성(scripted) AI 비서실장 어댑터(CLAUDE_IMPLEMENTATION.md 5장 "데모 모드").
// 실제 모델을 부르지 않고 시나리오 데이터에서 200ms 지연 후 즉시 응답을 만든다.
// 임의의 절감률·실제 분석 문구는 만들지 않는다 — 이미 시나리오에 있는 텍스트를
// 구조적으로(공통 근거 유무, 확정 여부) 나누어 보여줄 뿐이다.
//
// AbortSignal이 지연 중 abort되면 다시는 resolve하지 않고 reject한다. 이는
// src/app/requests.ts의 sessionId·requestId·signal 패턴과 짝을 이뤄, 세션이
// 리셋된 뒤 도착한 응답을 호출부가 아예 받지 않게 하기 위함이다.

import type {
  AssistantAdapter,
  RefineDraftRequest,
  RefineDraftResult,
} from './types';
import { AssistantTimeoutError } from './types';

/** 시나리오 데이터가 실제로 화면에 렌더되기까지 걸리는 사전 구성 지연(체험용). */
export const SCRIPTED_DELAY_MS = 200;
/** AssistantPanel이 응답을 기다리는 최대 시간. 지나면 기본 안내로 전환한다. */
export const ASSISTANT_TIMEOUT_MS = 5000;

/**
 * delayMs 뒤 build()의 결과로 resolve하되, 그 전에 signal이 abort되면 다시는
 * resolve하지 않고 AbortError로 reject한다. build()는 resolve 시점에만 호출해
 * 늦게 취소된 값이 미리 계산되어 새지 않게 한다.
 */
function afterScriptedDelay<T>(build: () => T, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(build());
    }, SCRIPTED_DELAY_MS);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * adapter 호출을 5초 timeout으로 감싼다. 시간 안에 응답이 오면 그대로 통과시키고,
 * 지나면 AssistantTimeoutError로 reject한다(AssistantPanel이 "기본 안내로
 * 전환했습니다"로 바꿔 보여준다).
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = ASSISTANT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new AssistantTimeoutError());
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** 공백만 정리하고 단어를 지우지 않는다 — "않"·"없이" 같은 부정·유보 표현이 삭제되지
 * 않도록, 요약이 아니라 다듬기만 한다. 300자를 넘으면 그 지점에서 자르기만 한다. */
function refine(draftText: string): string {
  const normalized = draftText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return normalized.length > 300 ? normalized.slice(0, 300) : normalized;
}

/** 사전 구성 어댑터. 시나리오 데이터 밖의 사실을 만들지 않고, 지연 후 즉시 값을
 * 계산해 돌려준다(요청 시점이 아니라 resolve 시점에 계산해 늦은 취소에 대비한다). */
export function createScriptedAdapter(): AssistantAdapter {
  return {
    refineDraft(req: RefineDraftRequest): Promise<RefineDraftResult> {
      return afterScriptedDelay(
        () => ({
          mode: 'scripted' as const,
          evidenceIds: [],
          suggestedConditionIds: [],
          draftText: refine(req.draftText),
        }),
        req.signal,
      );
    },
  };
}

export const scriptedAssistantAdapter: AssistantAdapter = createScriptedAdapter();
