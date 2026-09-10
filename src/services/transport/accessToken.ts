// 접속 토큰(T37). 무료 호스팅에 올린 공개 URL이 함부로 남용되지 않도록 서버(server/auth.ts)
// 가 선택적으로 요구하는 x-access-token을 클라이언트에서 관리한다. 진행 요원이 나눠주는
// 접속 URL은 `https://<서비스>/?key=<토큰>` 형태이며, 이 모듈은 앱이 시작될 때(이 모듈이
// 처음 import될 때) 그 쿼리를 읽어 sessionStorage에 저장하고 URL에서 지운다 — 화면 공유·
// 새로고침 시 주소창에 토큰이 남아 보이지 않게 하기 위해서다. 이후에는 accessHeaders()가
// 저장된 값을 헤더 하나로 돌려준다. 토큰이 없는 로컬·개방 배포에서는 항상 빈 객체를
// 돌려주므로 기존 fetch 호출에 그대로 스프레드해도 동작이 바뀌지 않는다.

const STORAGE_KEY = 'boardroom.accessToken';

function captureFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  if (!key) {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // sessionStorage를 쓸 수 없는 환경(프라이빗 모드 제한 등)은 조용히 무시한다.
  }
  params.delete('key');
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

captureFromUrl();

/** 저장된 접속 토큰이 있으면 x-access-token 헤더 하나를 돌려주고, 없으면 빈 객체를
 * 돌려준다 — 호출부가 항상 `{ ...accessHeaders(), ... }`처럼 스프레드해서 쓸 수 있게. */
export function accessHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const token = window.sessionStorage.getItem(STORAGE_KEY);
    return token ? { 'x-access-token': token } : {};
  } catch {
    return {};
  }
}
