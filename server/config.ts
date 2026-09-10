// 서버 실행 설정. AGENT_BOARDROOM_SPEC.md 5-6장, DEV_PLAN.md 11절.
// 모델 교체 지점은 두 곳뿐이다: 운영 중에는 환경변수 MODEL_ID, 코드 기본값은 이 파일의
// DEFAULT_MODEL_ID 상수 한 줄. 다른 코드는 이 파일이 만든 config.modelId만 참조한다.

import { PROMPT_VERSION } from './prompts/version';

/** 코드 기본 모델. 교체 시 이 상수 한 줄만 바꾼다(2026-09-10 결정: claude-sonnet-5). */
export const DEFAULT_MODEL_ID = 'claude-sonnet-5';

/** 응답 계약(발언/표/비서 스키마) 버전. 단일 출처는 server/prompts/version.ts. */
export { PROMPT_VERSION };

export const DEFAULT_PORT = 8787;

export type ProviderName = 'mock' | 'anthropic';

export interface ServerConfig {
  port: number;
  provider: ProviderName;
  modelId: string;
  promptVersion: string;
}

function parseProvider(value: string | undefined): ProviderName {
  return value === 'anthropic' ? 'anthropic' : 'mock';
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

/** 환경변수에서 서버 설정을 만든다. 테스트에서는 env 객체를 직접 넘길 수 있다. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT),
    provider: parseProvider(env.MODEL_PROVIDER),
    modelId: env.MODEL_ID?.trim() || DEFAULT_MODEL_ID,
    promptVersion: PROMPT_VERSION,
  };
}
