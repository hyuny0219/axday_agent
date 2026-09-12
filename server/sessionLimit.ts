// 세션 상한(T37, Codex 검토 반영). 공개 URL에서 모델 호출 비용이 무제한으로 늘지 않도록
// (1) 시간당 새 세션 수, (2) 세션 수명, (3) 세션당 엔드포인트별 호출 횟수를 제한한다.
// validate.ts의 RequestIdRegistry처럼 프로세스 메모리에만 둔다 — 재시작하면 초기화되고
// 여러 인스턴스 간 공유하지 않는다(무료 플랜은 단일 인스턴스를 전제한다).
//
// 호출 상한 근거(AGENT_BOARDROOM_SPEC.md 6장 "세션당 임원 호출 ≤16"): 라운드 3회(OPINIONS·
// REACTIONS·FOLLOWUP) × 4명 + 최종표 1회 × 4명 = 16. 비서실장은 정리 2회(클라이언트 상한과
// 같음)·요약은 화면 진입마다 한 번이라 여유를 둔다. 클라이언트는 재시도하지 않으므로 이
// 값을 넘는 요청은 정상 흐름이 아니다.

import type { Clock } from './clock';

const WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS_PER_HOUR = 30;
/** 세션 수명. 체험 240초 + 결과 화면·무입력 복귀 여유. 이후 같은 sessionId는 거절한다. */
export const DEFAULT_SESSION_TTL_MINUTES = 15;

export type CallKind = 'round' | 'vote' | 'refine' | 'summarize';

export const DEFAULT_MAX_CALLS_PER_SESSION: Record<CallKind, number> = {
  round: 3,
  vote: 1,
  refine: 2,
  summarize: 4,
};

export type SessionLimitVerdict = 'ok' | 'session_limit' | 'session_expired' | 'call_limit';

export interface SessionLimitConfig {
  maxPerHour: number;
  sessionTtlMs: number;
  maxCalls: Record<CallKind, number>;
}

function positiveOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** 환경변수에서 세션 상한 설정을 만든다. 테스트에서는 env 객체를 직접 넘길 수 있다. */
export function loadSessionLimitConfig(env: NodeJS.ProcessEnv = process.env): SessionLimitConfig {
  return {
    maxPerHour: positiveOr(env.MAX_SESSIONS_PER_HOUR, DEFAULT_MAX_SESSIONS_PER_HOUR),
    sessionTtlMs: positiveOr(env.SESSION_TTL_MINUTES, DEFAULT_SESSION_TTL_MINUTES) * 60 * 1000,
    maxCalls: { ...DEFAULT_MAX_CALLS_PER_SESSION },
  };
}

interface SessionEntry {
  firstSeenAt: number;
  calls: Record<CallKind, number>;
}

/**
 * 최근 1시간 동안 새로 등록된 세션 수를 슬라이딩 윈도로 세고, 등록된 세션마다 첫 등록
 * 시각과 엔드포인트별 호출 횟수를 기억한다. Clock을 주입받아 시간 경과를 시계 값으로만
 * 판단하고, 호출 횟수나 setTimeout으로 셈하지 않는다.
 */
export class SessionLimitRegistry {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly registeredAt: number[] = [];
  private readonly config: SessionLimitConfig;

  constructor(
    private readonly clock: Clock,
    config: SessionLimitConfig | number,
  ) {
    this.config =
      typeof config === 'number'
        ? {
            maxPerHour: config,
            sessionTtlMs: DEFAULT_SESSION_TTL_MINUTES * 60 * 1000,
            maxCalls: { ...DEFAULT_MAX_CALLS_PER_SESSION },
          }
        : config;
  }

  private prune(now: number): void {
    while (this.registeredAt.length > 0 && now - this.registeredAt[0]! >= WINDOW_MS) {
      this.registeredAt.shift();
    }
    // 윈도 밖으로 나간 세션 항목도 지워 메모리를 제한한다(수명이 지난 뒤이므로 재사용 불가).
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.firstSeenAt >= WINDOW_MS) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * 'ok'면 통과(호출 횟수를 1 올린다). 'session_limit'은 시간당 새 세션 상한 초과,
   * 'session_expired'는 수명이 지난 세션의 재사용, 'call_limit'은 그 세션에서 해당 종류의
   * 호출이 상한을 넘은 경우다.
   */
  allow(sessionId: string, kind: CallKind): SessionLimitVerdict {
    const now = this.clock.now();
    this.prune(now);

    let entry = this.sessions.get(sessionId);
    if (entry === undefined) {
      if (this.registeredAt.length >= this.config.maxPerHour) {
        return 'session_limit';
      }
      entry = { firstSeenAt: now, calls: { round: 0, vote: 0, refine: 0, summarize: 0 } };
      this.sessions.set(sessionId, entry);
      this.registeredAt.push(now);
    } else if (now - entry.firstSeenAt >= this.config.sessionTtlMs) {
      return 'session_expired';
    }

    if (entry.calls[kind] >= this.config.maxCalls[kind]) {
      return 'call_limit';
    }
    entry.calls[kind] += 1;
    return 'ok';
  }
}
