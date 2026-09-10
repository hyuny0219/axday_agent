// 관람 뷰(P1)로 공개 payload를 내보내는 전송 어댑터 인터페이스.
// 실제 구현(BroadcastChannel, localhost 릴레이 등)은 이 카드의 범위 밖이다.
// 이 인터페이스만 고정해 P0에서는 noop 구현을, 이후 카드에서 실제 전송을 붙인다.

import type { PublicPayload } from '../../domain/publicPayload';

export type TransportListener = (payload: PublicPayload) => void;

export interface Transport {
  publish(payload: PublicPayload): void;
  subscribe(listener: TransportListener): void;
  close(): void;
}
