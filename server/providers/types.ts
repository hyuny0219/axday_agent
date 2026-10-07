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
  /** 프롬프트 캐시 적중 토큰 수(T91, anthropic 제공자만 채운다). */
  cacheReadInputTokens?: number;
  /** 프롬프트 캐시에 새로 쓴 토큰 수(T91, anthropic 제공자만 채운다). */
  cacheCreationInputTokens?: number;
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

/** 제공자 HTTP 오류를 상태 코드·오류 종류(error.type)까지 실어 던진다(T65). handlers/shared.ts의
 * classifyFailure가 이 정보로 로그의 providerErrorClass·httpStatus를 채운다. */
export class ProviderCallError extends Error {
  readonly httpStatus?: number;
  readonly errorType?: string;

  constructor(message: string, opts: { httpStatus?: number; errorType?: string } = {}) {
    super(message);
    this.name = 'ProviderCallError';
    this.httpStatus = opts.httpStatus;
    this.errorType = opts.errorType;
  }
}
