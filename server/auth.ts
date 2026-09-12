// 접속 토큰(T37). 무료 호스팅에 올린 공개 URL에서 모델 호출 엔드포인트가 함부로 남용되지
// 않도록 선택적 토큰 검사를 더한다. 환경변수 ACCESS_TOKEN이 비어 있으면 지금까지처럼
// 완전히 개방한다 — 로컬 개발·CI의 mock 서버는 이 값을 설정하지 않으므로 동작이 바뀌지
// 않는다. 값이 있으면 /api/board/*·/api/assistant/* 요청은 헤더 x-access-token이 그
// 값과 정확히 같아야 한다. 문자열 비교는 길이 정보 노출을 줄이기 위해
// crypto.timingSafeEqual을 쓴다(길이가 다르면 애초에 같을 수 없으므로 그 경우만 상수
// 시간 비교를 건너뛴다).

import { timingSafeEqual } from 'node:crypto';

export interface AccessTokenConfig {
  /** 설정된 토큰 값. 비어 있으면 null(=검사하지 않음). */
  token: string | null;
}

/** 환경변수에서 접속 토큰 설정을 만든다. 테스트에서는 env 객체를 직접 넘길 수 있다. */
export function loadAccessTokenConfig(env: NodeJS.ProcessEnv = process.env): AccessTokenConfig {
  const raw = env.ACCESS_TOKEN?.trim();
  return { token: raw ? raw : null };
}

/** 토큰이 요구되는 배포인지(=ACCESS_TOKEN이 설정돼 있는지) 여부. health 응답의
 * authRequired 필드에 그대로 쓴다. */
export function requiresAccessToken(config: AccessTokenConfig): boolean {
  return config.token !== null;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** 요청 헤더 값이 설정된 접속 토큰과 일치하는지 본다. 토큰이 설정돼 있지 않으면(개방
 * 배포) 헤더와 무관하게 항상 true다. */
export function isAuthorized(config: AccessTokenConfig, headerValue: string | string[] | undefined): boolean {
  if (config.token === null) {
    return true;
  }
  if (typeof headerValue !== 'string' || headerValue.length === 0) {
    return false;
  }
  return timingSafeEqualStrings(headerValue, config.token);
}

/** 접속 토큰 검사 대상 경로인지(=board·assistant API인지) 본다. /api/health는 대상이
 * 아니다 — 호스팅 헬스체크는 토큰 없이도 항상 200을 받아야 하기 때문이다. */
export function isProtectedApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/board/') || pathname.startsWith('/api/assistant/');
}
