// services/transport/accessToken.ts: URL의 ?key=...를 sessionStorage로 옮기고 주소창에서
// 지우는 동작과 accessHeaders()의 헤더 구성을 확인한다(T37). 모듈이 import되는 순간
// 캡처가 일어나므로, 매 테스트마다 vi.resetModules()로 모듈을 새로 불러온다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importFresh() {
  vi.resetModules();
  return import('../../src/services/transport/accessToken');
}

describe('accessToken', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('URL에 ?key=...가 있으면 sessionStorage에 저장하고 URL에서 제거한다', async () => {
    window.history.pushState({}, '', '/?key=secret-1&mode=scripted');
    const { accessHeaders } = await importFresh();

    expect(window.sessionStorage.getItem('boardroom.accessToken')).toBe('secret-1');
    expect(window.location.search).toBe('?mode=scripted');
    expect(window.location.search.includes('key=')).toBe(false);
    expect(accessHeaders()).toEqual({ 'x-access-token': 'secret-1' });
  });

  it('key 하나만 있으면 제거 후 쿼리 문자열 자체가 사라진다', async () => {
    window.history.pushState({}, '', '/?key=only-token');
    await importFresh();
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('이미 sessionStorage에 저장된 값이 있으면 accessHeaders가 헤더를 돌려준다', async () => {
    window.sessionStorage.setItem('boardroom.accessToken', 'stored-token');
    const { accessHeaders } = await importFresh();
    expect(accessHeaders()).toEqual({ 'x-access-token': 'stored-token' });
  });

  it('저장된 값이 없으면 accessHeaders는 빈 객체를 돌려준다', async () => {
    const { accessHeaders } = await importFresh();
    expect(accessHeaders()).toEqual({});
  });
});
