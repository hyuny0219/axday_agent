// round.ts·vote.ts가 함께 쓰는 작은 헬퍼: 제공자 호출 실패를 failReason 문자열로 바꾼다.

import { ModelRefusalError } from '../providers/types';

export type FailReason = 'timeout' | 'refusal' | 'invalid_response' | 'provider_error';

/** provider.complete()가 던진 오류를 failed 응답에 담을 짧은 사유로 좁힌다. */
export function mapFailReason(err: unknown): FailReason {
  if (err instanceof ModelRefusalError) {
    return 'refusal';
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message === 'handler_timeout' || err.message === 'mock_timeout') {
      return 'timeout';
    }
  }
  return 'provider_error';
}
