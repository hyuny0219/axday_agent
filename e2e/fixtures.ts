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

export const test = base.extend<BoardroomFixtures>({
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
