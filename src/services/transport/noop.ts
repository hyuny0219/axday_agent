// 아무 것도 전송하지 않는 기본 Transport 구현. 관람 창·BroadcastChannel이 아직 없는
// P0에서 Transport 인터페이스를 쓰는 코드가 동작하도록 채워 넣는 자리다.

import type { Transport } from './types';

export function createNoopTransport(): Transport {
  return {
    publish(): void {
      // 의도적으로 아무 것도 하지 않는다.
    },
    subscribe(): void {
      // 의도적으로 아무 것도 하지 않는다.
    },
    close(): void {
      // 의도적으로 아무 것도 하지 않는다.
    },
  };
}
