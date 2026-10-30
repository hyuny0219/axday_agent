// AI 비서실장 어댑터 인터페이스(CLAUDE_IMPLEMENTATION.md 5장, AGENT_BOARDROOM_SPEC.md 4장).
// scripted.ts(사전 구성)와 live.ts(T31, 실제 서버 호출)가 공통으로 구현한다. 모든 요청에는
// sessionId·requestId·signal을 실어, 리셋·종료 뒤 늦게 도착한 응답을 호출부
// (AssistantPanel)가 무시할 수 있게 한다. 이 파일은 계약만 정의하며 실제 모델을
// 부르지 않는다.

import type { Scenario } from '../../content/types';

export type AssistantMode = 'scripted' | 'live';

export interface AssistantRequestBase {
  sessionId: string;
  requestId: string;
  signal: AbortSignal;
}

export interface RefineDraftRequest extends AssistantRequestBase {
  scenario: Scenario;
  /** 참가자가 직접 쓴 원문. 부정·유보 표현을 포함할 수 있으며 그대로 보존해야 한다. */
  draftText: string;
  /** 참가자가 draftText를 바꿀 때마다 늘어나는 값(컴포넌트가 관리). live refine은 응답
   * 시점에 이 값이 더 이상 최신이 아니면 결과를 폐기한다. */
  draftRevision: number;
}

export interface RefineDraftResult {
  mode: AssistantMode;
  evidenceIds: string[];
  /** 서버가 "확인이 필요하다"고 제안한 조건 ID. scripted는 항상 빈 배열이다. */
  suggestedConditionIds: string[];
  /** 원뜻·유보·부정 표현을 유지한 300자 이내 정리문. */
  draftText: string;
}

export interface AssistantAdapter {
  refineDraft(req: RefineDraftRequest): Promise<RefineDraftResult>;
}

/** 5초 timeout 등 도움 기능이 기본 안내로 전환해야 하는 상황을 나타낸다. */
export class AssistantTimeoutError extends Error {
  constructor(message = 'AI 비서실장 응답이 시간 안에 도착하지 않았습니다.') {
    super(message);
    this.name = 'AssistantTimeoutError';
  }
}
