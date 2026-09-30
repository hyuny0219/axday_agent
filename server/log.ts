// 서버 호출 로그(T65). 2026-09-29 시연에서 참가자 발언 뒤 임원 반응이 "응답 지연·확인
// 필요"로 끝난 원인(모델 지연·제공자 오류·클라이언트 8초 중단 중 무엇인지)을 서버가 아무것도
// 남기지 않아 사후에 알 수 없었다. 라운드·표결·probe·refine·summarize 호출마다 한 줄 JSON을
// stdout과 logs/board-<YYYY-MM-DD>.jsonl(저장소 루트, .gitignore)에 남긴다.
//
// 참가자 발언·모델 발언 본문과 키는 절대 기록하지 않는다 — CallLogEntry에는 애초에 그런
// 필드가 없다(길이조차 남기지 않는다, 카드 범위).

import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProviderErrorClass } from './handlers/shared';

export type CallKind = 'round' | 'vote' | 'probe' | 'refine' | 'summarize';

export interface CallLogEntry {
  ts: string;
  kind: CallKind;
  sessionId?: string;
  stage?: string;
  roleId?: string;
  status: 'answered' | 'failed';
  failReason?: string;
  providerErrorClass?: ProviderErrorClass;
  httpStatus?: number;
  latencyMs: number;
  timeoutMs: number;
  promptVersion: string;
  modelId: string;
}

const LOG_DIR = resolve(process.cwd(), 'logs');

function logFilePath(dateKey: string): string {
  return resolve(LOG_DIR, `board-${dateKey}.jsonl`);
}

function dateKeyOf(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** 한 줄을 stdout에 찍고 파일에도 이어 붙인다. 디스크가 없거나 쓰기에 실패해도(부스 PC
 * 권한 문제 등) 응답 자체를 막지 않는다 — 로그는 부수 효과일 뿐이다. */
function writeLine(line: string, nowMs: number): void {
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(logFilePath(dateKeyOf(nowMs)), `${line}\n`, 'utf-8');
  } catch {
    // 로그 파일 쓰기 실패는 조용히 무시한다.
  }
}

interface SessionAggregate {
  calls: number;
  failures: number;
  maxLatencyMs: number;
}

const sessionAggregates = new Map<string, SessionAggregate>();

function recordForSummary(entry: CallLogEntry): void {
  if (!entry.sessionId) {
    return;
  }
  const previous = sessionAggregates.get(entry.sessionId) ?? { calls: 0, failures: 0, maxLatencyMs: 0 };
  sessionAggregates.set(entry.sessionId, {
    calls: previous.calls + 1,
    failures: previous.failures + (entry.status === 'failed' ? 1 : 0),
    maxLatencyMs: Math.max(previous.maxLatencyMs, entry.latencyMs),
  });
}

/** 호출 한 건을 로그로 남기고, 세션 종료 요약(flushSessionSummary)이 쓸 집계에도 더한다. */
export function logCall(entry: CallLogEntry, nowMs: number = Date.now()): void {
  writeLine(JSON.stringify(entry), nowMs);
  recordForSummary(entry);
}

/** 세션이 끝났다고 볼 때(session TTL 만료, sessionLimit.ts) 한 번 불러 세션당 요약 한 줄
 * (라운드 수·실패 수·최대 지연)을 남기고 집계를 비운다. 집계가 없던 세션(호출이 한 번도
 * 없었거나 이미 flush됨)은 아무것도 하지 않는다. */
export function flushSessionSummary(sessionId: string, nowMs: number = Date.now()): void {
  const aggregate = sessionAggregates.get(sessionId);
  if (!aggregate) {
    return;
  }
  sessionAggregates.delete(sessionId);
  writeLine(
    JSON.stringify({
      ts: new Date(nowMs).toISOString(),
      kind: 'session_summary',
      sessionId,
      calls: aggregate.calls,
      failures: aggregate.failures,
      maxLatencyMs: aggregate.maxLatencyMs,
    }),
    nowMs,
  );
}
