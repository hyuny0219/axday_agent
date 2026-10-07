// round.ts·vote.ts·assistant.ts가 함께 쓰는 작은 헬퍼: 제공자 호출 실패를 failReason
// 문자열로, 그리고(T65) 로그용 providerErrorClass·httpStatus로 좁힌다. 참가자·모델 발언
// 본문은 다루지 않는다 — 오류 종류 판단에만 쓴다.

import { z } from 'zod';
import { EXEC_ROLE_IDS } from '../validate';
import { ModelRefusalError, ProviderCallError } from '../providers/types';

export type FailReason = 'timeout' | 'refusal' | 'invalid_response' | 'provider_error';

/** 빠르게 실패한 호출(연결 오류·5xx·invalid_response/스키마 거절 등)만 한 번 더 시도할
 * 가치가 있다(T91). timeout은 이미 전체 예산을 다 써서 재시도할 시간이 없으므로 뺀다.
 * round.ts·vote.ts의 RoundRoleResult/VoteRoleResult는 failReason을 string으로 느슨하게
 * 선언해 둬서(공개 응답 타입) 여기서도 string | undefined를 받는다. */
export function isRetryableFailure(failReason: string | undefined): boolean {
  return failReason !== undefined && failReason !== 'timeout';
}

/** 재시도를 허용할 남은 예산 하한(ms, T91). 이보다 적게 남았으면 재시도 대신 그대로
 * failed로 돌려준다 — 2026-10-07 시연에서 CISO 응답이 8초 예산을 다 쓰고 provider_error로
 * 끝난 사례를 보고, "빠르게 실패했고 남은 예산이 충분하면 1회만 더 시도"하는 규칙을 더했다. */
export const MIN_RETRY_REMAINING_MS = 6000;

/** logs/board-<날짜>.jsonl의 providerErrorClass 필드가 쓰는 값(T65 카드). */
export type ProviderErrorClass =
  | 'timeout'
  | 'rate_limit'
  | 'overloaded'
  | 'auth'
  | 'invalid_response'
  | 'network'
  | 'other';

export interface FailClassification {
  failReason: FailReason;
  providerErrorClass: ProviderErrorClass;
  httpStatus?: number;
}

const RATE_LIMIT_TYPES = new Set(['rate_limit_error']);
const OVERLOADED_TYPES = new Set(['overloaded_error']);
const AUTH_TYPES = new Set(['authentication_error', 'permission_error']);
const CONNECTION_ERROR_NAMES = new Set(['APIConnectionError', 'APIConnectionTimeoutError']);

/** provider.complete()가 던진 오류를 failed 응답에 담을 짧은 사유(failReason)와 로그 전용
 * providerErrorClass·httpStatus로 분류한다. AbortError·handler_timeout·mock_timeout·
 * APIUserAbortError(우리 자신의 타임아웃 AbortController)는 모두 'timeout'이다. */
export function classifyFailure(err: unknown): FailClassification {
  if (err instanceof ModelRefusalError) {
    return { failReason: 'refusal', providerErrorClass: 'other' };
  }

  if (err instanceof ProviderCallError) {
    const { httpStatus, errorType } = err;
    if (errorType === 'APIUserAbortError') {
      return { failReason: 'timeout', providerErrorClass: 'timeout', httpStatus };
    }
    if (errorType && RATE_LIMIT_TYPES.has(errorType)) {
      return { failReason: 'provider_error', providerErrorClass: 'rate_limit', httpStatus };
    }
    if (errorType && OVERLOADED_TYPES.has(errorType)) {
      return { failReason: 'provider_error', providerErrorClass: 'overloaded', httpStatus };
    }
    if (errorType && AUTH_TYPES.has(errorType)) {
      return { failReason: 'provider_error', providerErrorClass: 'auth', httpStatus };
    }
    if (httpStatus === 429) {
      return { failReason: 'provider_error', providerErrorClass: 'rate_limit', httpStatus };
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return { failReason: 'provider_error', providerErrorClass: 'auth', httpStatus };
    }
    if (httpStatus === 529) {
      return { failReason: 'provider_error', providerErrorClass: 'overloaded', httpStatus };
    }
    if (errorType && CONNECTION_ERROR_NAMES.has(errorType)) {
      return { failReason: 'provider_error', providerErrorClass: 'network', httpStatus };
    }
    return { failReason: 'provider_error', providerErrorClass: 'other', httpStatus };
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message === 'handler_timeout' || err.message === 'mock_timeout') {
      return { failReason: 'timeout', providerErrorClass: 'timeout' };
    }
    if (err.message === 'anthropic_invalid_json' || err.message === 'anthropic_no_text_block') {
      return { failReason: 'provider_error', providerErrorClass: 'invalid_response' };
    }
  }

  return { failReason: 'provider_error', providerErrorClass: 'other' };
}

/** provider.complete()가 던진 오류를 failed 응답에 담을 짧은 사유로 좁힌다(기존 호출부 유지용). */
export function mapFailReason(err: unknown): FailReason {
  return classifyFailure(err).failReason;
}

/** "다시 요청"의 roleIds(T65). 부스 URL 토큰만 있으면 누구나 호출할 수 있는데 세션 상한은 HTTP
 * 요청 단위로 세므로, 같은 역할을 반복해 보내 한 요청으로 유료 호출을 늘리지 못하게 최대
 * 4개·중복 없음으로 잘라 둔다(PR #11 Codex 21차 P1). */
export const roleIdsSchema = z
  .array(z.enum(EXEC_ROLE_IDS))
  .min(1)
  .max(EXEC_ROLE_IDS.length)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'roleIds must be unique' });
