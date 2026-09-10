// 비동기 요청(사전 구성 AI 비서실장 등, T12)의 sessionId·requestId 레지스트리.
// 리셋(IDLE_RESET·OPERATOR_RESET) 시 진행 중인 요청을 모두 abort하고, 이미 폐기된
// 요청의 늦은 응답은 isCurrent()로 걸러 무시한다. 이 파일 자체는 실제 요청을 만들지
// 않는다 — AbortSignal을 내주고 취소 여부만 추적한다.

export interface RequestHandle {
  readonly sessionId: string;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface RequestRegistry {
  /** 새 비동기 요청을 등록하고 취소 가능한 handle을 돌려준다. */
  begin(sessionId: string): RequestHandle;
  /** 응답을 화면에 반영하기 직전 호출해, 그 사이 세션이 리셋되지 않았는지 확인한다. */
  isCurrent(handle: RequestHandle): boolean;
  /** 요청이 끝났을 때(성공·실패·타임아웃 모두) 레지스트리에서 제거한다. */
  finish(handle: RequestHandle): void;
  /** 세션 리셋 시 그 세션에 걸린 모든 진행 중 요청을 abort하고 제거한다. */
  abortSession(sessionId: string): void;
  /** 모든 세션의 진행 중 요청을 abort한다(운영자 새 체험 등 전체 초기화). */
  abortAll(): void;
}

interface Entry {
  sessionId: string;
  controller: AbortController;
}

function createRequestId(): string {
  return crypto.randomUUID();
}

/** 앱 전체에서 하나만 만들어 공유하는 레지스트리 인스턴스를 만든다. */
export function createRequestRegistry(): RequestRegistry {
  const entries = new Map<string, Entry>();

  function abortEntry(requestId: string, entry: Entry): void {
    entry.controller.abort();
    entries.delete(requestId);
  }

  return {
    begin(sessionId) {
      const requestId = createRequestId();
      const controller = new AbortController();
      entries.set(requestId, { sessionId, controller });
      return { sessionId, requestId, signal: controller.signal };
    },

    isCurrent(handle) {
      const entry = entries.get(handle.requestId);
      return entry !== undefined && !entry.controller.signal.aborted;
    },

    finish(handle) {
      entries.delete(handle.requestId);
    },

    abortSession(sessionId) {
      for (const [requestId, entry] of entries) {
        if (entry.sessionId === sessionId) {
          abortEntry(requestId, entry);
        }
      }
    },

    abortAll() {
      for (const [requestId, entry] of entries) {
        abortEntry(requestId, entry);
      }
    },
  };
}
