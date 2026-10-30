// 모든 spec이 공유하는 Playwright fixture(T16). localhost(127.0.0.1 포함) 밖으로 나가는
// 요청은 실제로 나가기 전에 route.abort()로 막고 URL을 기록해, 테스트가 끝날 때
// 0건인지 자동으로 단언한다. mock board 서버(`/api`, 8787→4173 프록시)는 같은 호스트라
// 그대로 통과한다. 각 spec이 자체 `page.route()`로 특정 경로만 가로채도(live.spec.ts의
// `/api/board/round`·`/api/health` 가로채기 등) Playwright는 나중에 등록한 route를
// 먼저 적용하므로 이 fixture와 충돌하지 않는다.

import { test as base, expect, type Page, type Route } from '@playwright/test';

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

interface BoardroomFixtures {
  /** 이 테스트 실행 중 차단된 외부 요청 URL 목록. 직접 확인이 필요할 때만 참조한다. */
  externalRequests: string[];
}

// 부스 자동 진행(T143)이 기본 켜짐이라, 기존 e2e가 직접 진행 경로를 그대로 타도록 모든
// page.goto에 `auto=off`를 더한다(이미 auto 쿼리가 있으면 그대로 둔다). 자동 진행을 직접
// 검증하는 spec은 `?auto=on`을 명시한다.
function withAutoOff(url: string): string {
  if (!url.startsWith('/') && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
    return url;
  }
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  if (/[?&]auto=/.test(base)) return url;
  return `${base}${base.includes('?') ? '&' : '?'}auto=off${hash}`;
}

export const test = base.extend<BoardroomFixtures>({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);
    page.goto = ((url: string, options?: Parameters<Page['goto']>[1]) =>
      originalGoto(withAutoOff(url), options)) as Page['goto'];
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture의 use이지 React Hook이 아니다.
    await use(page);
  },
  // auto: true — 각 spec이 명시적으로 요청하지 않아도 모든 테스트에 적용된다.
  externalRequests: [
    async ({ page }, use) => {
      const externalRequests: string[] = [];

      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (ALLOWED_HOSTNAMES.has(url.hostname)) {
          await route.continue();
          return;
        }
        externalRequests.push(route.request().url());
        await route.abort();
      });

      await use(externalRequests);

      expect(
        externalRequests,
        `localhost 밖으로 나간 요청이 있으면 안 된다: ${externalRequests.join(', ')}`,
      ).toHaveLength(0);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page, Route };
