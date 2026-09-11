// @anthropic-ai/sdk 기반 실제 모델 제공자. 구조화 출력(json_schema)을 쓰고,
// 재시도 0회, 호출별 timeout은 요청이 넘긴 남은 예산을 그대로 쓴다.
// 키는 환경변수에서 SDK가 기본으로 해석한다(new Anthropic() 기본 동작, 코드에 저장하지 않음).

import Anthropic from '@anthropic-ai/sdk';
import type { ModelCompleteRequest, ModelCompleteResult, ModelProvider } from './types';
import { ModelRefusalError } from './types';

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
            system: req.system,
            messages: [{ role: 'user', content: req.user }],
          },
          { timeout: req.timeoutMs, maxRetries: 0, signal: req.signal },
        );
      } catch (err) {
        // 타임아웃·중단은 이름을 유지해 mapFailReason이 'timeout'으로 좁힐 수 있게 하고,
        // API 오류는 상태 코드와 메시지를 붙여 평가 기록(live-eval)에서 원인을 볼 수 있게 한다.
        if (err instanceof Anthropic.APIError && typeof err.status === 'number') {
          throw new Error(`anthropic_api_error ${err.status}: ${err.message}`);
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
        },
      };
    },
  };
}
