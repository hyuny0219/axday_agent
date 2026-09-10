// 모델 제공자 공통 인터페이스. mock·anthropic 구현이 이 계약만 지키면
// 서버 나머지 코드(핸들러·검증)는 어떤 제공자인지 알 필요가 없다.

export interface ModelCompleteRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ModelCompleteUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelCompleteResult {
  json: unknown;
  modelId: string;
  usage?: ModelCompleteUsage;
}

export interface ModelProvider {
  complete(req: ModelCompleteRequest): Promise<ModelCompleteResult>;
}

/** 모델이 응답을 거부했을 때(anthropic stop_reason==='refusal') 실패로 반환하기 위해 던진다. */
export class ModelRefusalError extends Error {
  constructor(message = 'model_refusal') {
    super(message);
    this.name = 'ModelRefusalError';
  }
}
