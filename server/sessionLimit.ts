// 세션 상한(T37). 공개 URL에서 모델 호출 비용이 무제한으로 늘지 않도록 시간당 새 세션
// 수를 제한한다. validate.ts의 RequestIdRegistry(메모리 Set)와 같은 방식으로 프로세스
// 메모리에만 둔다 — 재시작하면 초기화되고, 여러 인스턴스 간 공유하지 않는다(무료 플랜은
// 단일 인스턴스를 전제한다).

import type { Clock } from './clock';

const WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS_PER_HOUR = 30;

export interface SessionLimitConfig {
  maxPerHour: number;
}

/** 환경변수에서 세션 상한 설정을 만든다. 테스트에서는 env 객체를 직접 넘길 수 있다. */
export function loadSessionLimitConfig(env: NodeJS.ProcessEnv = process.env): SessionLimitConfig {
  const parsed = Number(env.MAX_SESSIONS_PER_HOUR);
  return { maxPerHour: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SESSIONS_PER_HOUR };
}

/**
 * 최근 1시간 동안 새로 등록된 세션 수를 슬라이딩 윈도로 센다. 이미 본 sessionId는 상한과
 * 무관하게 항상 통과한다(재요청·재시도가 새 세션으로 오인되지 않도록). Clock을 주입받아
 * 시간 경과를 시계 값으로만 판단하고, 호출 횟수나 setTimeout으로 셈하지 않는다.
 */
export class SessionLimitRegistry {
  private readonly seen = new Set<string>();
  private readonly registeredAt: number[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly maxPerHour: number,
  ) {}

  private prune(now: number): void {
    while (this.registeredAt.length > 0 && now - this.registeredAt[0]! >= WINDOW_MS) {
      this.registeredAt.shift();
    }
  }

  /** true면 통과(기존 세션이거나 상한 이내로 새로 등록됨), false면 상한 초과로 거절한다. */
  allow(sessionId: string): boolean {
    if (this.seen.has(sessionId)) {
      return true;
    }
    const now = this.clock.now();
    this.prune(now);
    if (this.registeredAt.length >= this.maxPerHour) {
      return false;
    }
    this.seen.add(sessionId);
    this.registeredAt.push(now);
    return true;
  }
}
