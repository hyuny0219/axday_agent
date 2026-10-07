// @anthropic-ai/sdk 기반 실제 모델 제공자. 구조화 출력(json_schema)을 쓰고,
// SDK 자체의 재시도는 0회(서버 handlers가 T91에서 1회 재시도를 직접 한다), 호출별 timeout은
// 요청이 넘긴 남은 예산을 그대로 쓴다.
// 키는 환경변수에서 SDK가 기본으로 해석한다(new Anthropic() 기본 동작, 코드에 저장하지 않음).
//
// T91: system을 문자열 그대로 보내지 않고 단일 텍스트 블록 배열로 감싸 마지막(유일한) 블록에
// cache_control: { type: 'ephemeral' }를 붙인다. 같은 역할·같은 meeting_record로 다시
// 호출하면(예: handlers의 1회 재시도) system 전체가 바이트 단위로 같아 캐시가 적중해 TTFT·
// 비용이 줄어든다 — meeting_record가 매 라운드 자라므로 라운드를 건너뛴 재사용은 기대하지
// 않는다.

import Anthropic from '@anthropic-ai/sdk';
import type { ModelCompleteRequest, ModelCompleteResult, ModelProvider } from './types';
import { ModelRefusalError, ProviderCallError } from './types';

/** effort:'low'로 짧게 답하게 하고, 응답 형식은 호출자가 넘긴 JSON schema로 고정한다. */
export function createAnthropicProvider(opts: {
  modelId: string;
  maxTokens?: number;
}): ModelProvider {
  const client = new Anthropic();
  const maxTokens = opts.maxTokens ?? 600;

  return {
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResult> {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create(
          {
            model: opts.modelId,
            max_tokens: req.maxTokens > 0 ? req.maxTokens : maxTokens,
            output_config: {
              effort: 'low',
              format: { type: 'json_schema', schema: req.schema },
            },
            system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: req.user }],
          },
          { timeout: req.timeoutMs, maxRetries: 0, signal: req.signal },
        );
      } catch (err) {
        // API가 실제로 응답한 오류(상태 코드가 있음)와 연결 자체가 안 된 경우(APIConnectionError
        // 계열, status 없음) 모두 ProviderCallError로 감싸 상태 코드·error.type·SDK 오류 이름을
        // 보존한다 — handlers/shared.ts의 classifyFailure가 이 정보로 로그의 providerErrorClass·
        // httpStatus를 채운다(T65). 그 외(계약 검사용으로 우리가 직접 던진 Error 등)는 그대로 둔다.
        if (err instanceof Anthropic.APIError) {
          const httpStatus = typeof err.status === 'number' ? err.status : undefined;
          throw new ProviderCallError(
            `anthropic_api_error ${httpStatus ?? err.name}: ${err.message}`,
            { httpStatus, errorType: err.type ?? err.name },
          );
        }
        throw err;
      }

      if (message.stop_reason === 'refusal') {
        throw new ModelRefusalError();
      }

      const textBlock = message.content.find(
        (block): block is Extract<(typeof message.content)[number], { type: 'text' }> =>
          block.type === 'text',
      );
      if (!textBlock) {
        throw new Error('anthropic_no_text_block');
      }

      let json: unknown;
      try {
        json = JSON.parse(textBlock.text);
      } catch {
        throw new Error('anthropic_invalid_json');
      }

      return {
        json,
        modelId: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadInputTokens: message.usage.cache_read_input_tokens ?? undefined,
          cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? undefined,
        },
      };
    },
  };
}
