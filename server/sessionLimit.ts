// 세션 상한(T37, Codex 검토 반영). 공개 URL에서 모델 호출 비용이 무제한으로 늘지 않도록
// (1) 시간당 새 세션 수, (2) 세션 수명, (3) 세션당 엔드포인트별 호출 횟수를 제한한다.
// validate.ts의 RequestIdRegistry처럼 프로세스 메모리에만 둔다 — 재시작하면 초기화되고
// 여러 인스턴스 간 공유하지 않는다(무료 플랜은 단일 인스턴스를 전제한다).
//
// 호출 상한 근거(AGENT_BOARDROOM_SPEC.md 6장): 라운드 6회(OPINIONS·REACTIONS·FOLLOWUP
// 기본 3회 + 그 각각을 "다시 요청" 1회씩, T65 2026-09-30 결정 — 2026-09-29 시연은
// REACTIONS에서 실패했고 그 뒤 FOLLOWUP도 실패할 수 있어 세션 전체 1회로는 부족했다) ×
// 4명 + 최종표 2회("미표결 임원 다시 요청" 1회 포함) × 4명 = 32. 화면은 라운드 단계마다
// (실패한 역할이 있을 때만 보이는) 재요청 버튼을 한 번 누르면 잠그므로, 서버 상한을 넉넉히
// 열어도 실제로는 라운드 단계마다 최대 1회씩만 더 쓰인다. 비서실장은 정리 2회(클라이언트
// 상한과 같음)·요약은 화면 진입마다 한 번이라 여유를 둔다. 클라이언트는 자동 재시도를
// 하지 않으므로(수동 "다시 요청" 1회만 있다) 이 값을 넘는 요청은 정상 흐름이 아니다.

import type { Clock } from './clock';

const WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS_PER_HOUR = 30;
/**
 * 세션 수명 — **마지막 요청 이후** 이 시간 동안 요청이 없으면 만료한다(슬라이딩). 체험이
 * 시간으로 끝나지 않으므로(T50) 첫 요청 기준 절대 수명을 두면 오래 토론한 참가자의 반응·표결이
 * 429 session_expired로 거절된다(PR #10 Codex 8차 검토 P2). 요청 사이 무응답 30분은 부스에서
 * 정상 흐름이 아니므로 그때는 거절한다. 이후 같은 sessionId는 거절한다.
 */
export const DEFAULT_SESSION_TTL_MINUTES = 30;

export type CallKind = 'round' | 'vote' | 'refine' | 'summarize';

export const DEFAULT_MAX_CALLS_PER_SESSION: Record<CallKind, number> = {
  // T65 "다시 요청"(2026-09-30 결정): OPINIONS·REACTIONS·FOLLOWUP 기본 3회 + 각 단계별
  // 재요청 1회씩 최대 3회 = 6. 화면은 라운드 단계마다 실패한 역할이 있을 때만 버튼을
  // 보여주고 누르면 그 단계에서는 잠그므로, 실제 소모량은 부스 상황(어느 단계가 실패했는지)
  // 에 따라 3~6 사이다.
  round: 6,
  // T65 "미표결 임원 다시 요청": 최종표도 한 번 더 부를 수 있어야 한다.
  vote: 2,
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
  /** 마지막으로 통과한 요청 시각. 수명은 여기서부터 잰다(슬라이딩). */
  lastSeenAt: number;
  calls: Record<CallKind, number>;
}

/**
 * 최근 1시간 동안 새로 등록된 세션 수를 슬라이딩 윈도로 세고, 등록된 세션마다 첫 등록
 * 시각·마지막 통과 시각과 엔드포인트별 호출 횟수를 기억한다. Clock을 주입받아 시간 경과를 시계 값으로만
 * 판단하고, 호출 횟수나 setTimeout으로 셈하지 않는다.
 */
export class SessionLimitRegistry {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly registeredAt: number[] = [];
  private readonly config: SessionLimitConfig;

  constructor(
    private readonly clock: Clock,
    config: SessionLimitConfig | number,
    /** 세션이 메모리에서 지워질 때(아래 prune, 마지막 요청 뒤 1시간) 한 번 불린다(T65).
     * server/log.ts의 flushSessionSummary가 이 자리에서 세션 요약 로그 한 줄을 남긴다 —
     * 서버에는 별도의 "세션 종료" 신호가 없어 이 지연 정리 시점을 기준으로 삼는다(실시간은
     * 아니다: 다음 요청이 prune을 부를 때까지 최대 1시간 늦게 flush될 수 있다). */
    private readonly onSessionEnd?: (sessionId: string) => void,
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
    // 마지막 요청 뒤 1시간이 지난 세션 항목은 지워 메모리를 제한한다. 수명(≤1시간)이 먼저
    // 지나므로 재사용은 이미 거절된 뒤다. 호출 횟수를 잃지 않도록 활성 세션은 남긴다.
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastSeenAt >= WINDOW_MS) {
        this.sessions.delete(sessionId);
        this.onSessionEnd?.(sessionId);
      }
    }
  }

  /**
   * 'ok'면 통과(호출 횟수를 1 올리고 수명을 갱신한다). 'session_limit'은 시간당 새 세션 상한
   * 초과, 'session_expired'는 마지막 요청 뒤 수명이 지난 세션의 재사용, 'call_limit'은 그
   * 세션에서 해당 종류의 호출이 상한을 넘은 경우다.
   */
  allow(sessionId: string, kind: CallKind): SessionLimitVerdict {
    const now = this.clock.now();
    this.prune(now);

    let entry = this.sessions.get(sessionId);
    if (entry === undefined) {
      if (this.registeredAt.length >= this.config.maxPerHour) {
        return 'session_limit';
      }
      entry = {
        firstSeenAt: now,
        lastSeenAt: now,
        calls: { round: 0, vote: 0, refine: 0, summarize: 0 },
      };
      this.sessions.set(sessionId, entry);
      this.registeredAt.push(now);
    } else if (now - entry.lastSeenAt >= this.config.sessionTtlMs) {
      return 'session_expired';
    }

    if (entry.calls[kind] >= this.config.maxCalls[kind]) {
      return 'call_limit';
    }
    entry.calls[kind] += 1;
    entry.lastSeenAt = now;
    return 'ok';
  }
}
