// live 임원 에이전트 어댑터(AGENT_BOARDROOM_SPEC.md 3·5·6장). /api/board/round·/api/board/vote를
// 호출해 서버가 검증까지 끝낸 응답만 Statement/Ballot으로 옮긴다. 실제 판단은 서버(T28
// handlers)가 하며 이 파일은 요청 조립·시간 예산·응답 형태 변환만 담당한다.
//
// 대기 시간은 stage별 상한(OPINIONS·VOTE 8초, REACTIONS·FOLLOWUP 12초, T65)과 ctx.budgetMs
// 중 작은 쪽을 넘기지 않는다(스펙 6장). 값은 서버 /api/health가 내려준 것을 services/
// transport/roundTimeouts.ts가 캐시해 두며, 하드코딩하지 않는다. ctx.signal이 먼저
// abort되면(세션 리셋 등) 그 즉시 요청도 취소한다. 서버 응답이 배열이 아니거나 개별 항목이
// 예상한 필드를 갖추지 못하면(네트워크 중간 오류·스키마 변경 등) 해당 역할을 failed로 남길
// 뿐 예외를 던지지 않는다 — 늦거나 깨진 응답으로 세션이 멈추지 않게 한다.
//
// ctx.roleIds가 있으면("다시 요청"/"미표결 임원 다시 요청", T65) 그 역할만 요청하고 응답도
// 그 역할만큼만 만든다 — 이미 성공한 역할의 발언·표를 건드리지 않는다(runner.ts가 병합한다).

import type { ExecMemberId, Vote } from '../../content/types';
import type { Stance, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { accessHeaders } from '../transport/accessToken';
import { getRoundTimeouts } from '../transport/roundTimeouts';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from './types';

/** OPINIONS 단계의 기본 최대 대기 시간(호환용 상수, tests/services/live.test.ts가 쓴다).
 * 실제 값은 서버 응답을 캐시한 getRoundTimeouts()에서 읽는다. */
export const MAX_ROUND_TIMEOUT_MS = 8000;

/** 클라이언트 fetch abort 타이머는 서버 per-role 타임아웃(budgetMs)보다 이만큼 더 늦게
 * 끊는다(PR #11 Codex 24차 P1). 서버는 요청을 받은 뒤에야 자기 타이머를 시작하므로, 클라이언트
 * 타이머가 서버와 정확히 같은 길이면 실제로는 네트워크 왕복·JSON 직렬화 시간만큼 먼저
 * abort된다 — 그러면 일부 역할만 실패한 Promise.allSettled 응답이 거의 도착한 순간에도
 * 클라이언트가 요청 전체를 끊어 4명 모두 failed(timeout)로 남고, "다시 요청"이 이미 도착했어야
 * 할 표까지 다시 부르게 된다. 여유를 두어 서버가 부분 실패를 내려줄 시간을 보장한다. */
export const TRANSPORT_MARGIN_MS = 1500;

/** REACTIONS·FOLLOWUP만 더 긴 예외 타임아웃을 쓴다(스펙 6장). VOTE는 stage 인자 없이 부르며
 * OPINIONS와 같은 기본 상한을 쓴다. */
function stageTimeoutMs(stage?: StatementStage): number {
  const timeouts = getRoundTimeouts();
  return stage === 'REACTIONS' || stage === 'FOLLOWUP' ? timeouts.reactionTimeoutMs : timeouts.roundTimeoutMs;
}

function timeoutMsFor(ctx: BoardAgentsContext, stage?: StatementStage): number {
  return Math.max(0, Math.min(stageTimeoutMs(stage), ctx.budgetMs));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVote(value: unknown): value is Vote {
  return value === 'YES' || value === 'NO';
}

function isStance(value: unknown): value is Stance {
  return value === 'FOR' || value === 'AGAINST' || value === 'UNDECIDED';
}

function findEntry(raw: unknown[], roleId: ExecMemberId): Record<string, unknown> | undefined {
  const entry = raw.find((item) => isRecord(item) && item.roleId === roleId);
  return isRecord(entry) ? entry : undefined;
}

/** ctx.signal(외부 abort)과 자체 timeoutMs 중 먼저 일어나는 쪽으로 fetch를 취소한다. */
async function postBoardRequest(
  path: string,
  body: unknown,
  ctx: BoardAgentsContext,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (ctx.signal.aborted) {
    controller.abort();
  } else {
    ctx.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessHeaders() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`board_request_failed:${res.status}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
    ctx.signal.removeEventListener('abort', onExternalAbort);
  }
}

function transcriptPayload(ctx: BoardAgentsContext) {
  return {
    revision: ctx.session.transcript.revision,
    statements: ctx.session.transcript.statements.map((s) => ({
      id: s.id,
      roleId: s.roleId,
      message: s.text,
    })),
  };
}

function latestParticipantOpinion(ctx: BoardAgentsContext): string | undefined {
  const opinions = ctx.session.opinions;
  if (opinions.length === 0) {
    return undefined;
  }
  return opinions[opinions.length - 1]?.originalText;
}

function buildRoundBody(ctx: BoardAgentsContext, stage: StatementStage, timeoutMs: number) {
  return {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    mode: 'live' as const,
    stage,
    transcript: transcriptPayload(ctx),
    participantOpinion: latestParticipantOpinion(ctx),
    scenarioId: ctx.scenario.id,
    budgetMs: timeoutMs,
    roleIds: ctx.roleIds,
  };
}

/** 응답 한 건을 StatementOutcome으로 바꾼다. id는 서버가 주지 않으므로 여기서 새로 만들고,
 * createdAt은 placeholder(0)로 두어 runner.ts가 주입된 Clock으로 덮어쓰게 한다. */
function toStatementOutcome(
  roleId: ExecMemberId,
  entry: Record<string, unknown>,
  stage: StatementStage,
): StatementOutcome {
  const statement = entry.statement;
  if (entry.status === 'answered' && isRecord(statement)) {
    const { message, evidenceIds, referencedStatementIds, concerns, suggestedConditionIds, stance } =
      statement;
    if (
      typeof message === 'string' &&
      isStringArray(evidenceIds) &&
      isStringArray(referencedStatementIds) &&
      isStringArray(concerns) &&
      isStringArray(suggestedConditionIds) &&
      isStance(stance)
    ) {
      return {
        roleId,
        status: 'answered',
        statement: {
          id: crypto.randomUUID(),
          roleId,
          stage,
          text: message,
          evidenceIds,
          referencedStatementIds,
          concerns,
          suggestedConditionIds,
          stance,
          source: 'live',
          createdAt: 0,
        },
      };
    }
  }
  const failReason = typeof entry.failReason === 'string' ? entry.failReason : 'invalid_response';
  return { roleId, status: 'failed', failReason };
}

/** roleIds가 있으면 그 역할만큼만 outcome을 만든다(재요청). 없으면 임원 4명 전체를
 * 기준으로 만든다(기존 동작) — 응답에 없는 역할은 failed(invalid_response)로 채운다. */
function buildRoundOutcomes(raw: unknown, stage: StatementStage, roleIds?: ExecMemberId[]): StatementOutcome[] {
  const targets = roleIds ?? EXEC_MEMBER_ORDER;
  if (!Array.isArray(raw)) {
    return targets.map((roleId) => ({ roleId, status: 'failed' as const, failReason: 'invalid_response' }));
  }
  return targets.map((roleId) => {
    const entry = findEntry(raw, roleId);
    return entry ? toStatementOutcome(roleId, entry, stage) : { roleId, status: 'failed', failReason: 'invalid_response' };
  });
}

async function runRoundRequest(ctx: BoardAgentsContext, stage: StatementStage): Promise<StatementOutcome[]> {
  const timeoutMs = timeoutMsFor(ctx, stage);
  let raw: unknown;
  try {
    raw = await postBoardRequest(
      '/api/board/round',
      buildRoundBody(ctx, stage, timeoutMs),
      ctx,
      timeoutMs + TRANSPORT_MARGIN_MS,
    );
  } catch {
    return (ctx.roleIds ?? EXEC_MEMBER_ORDER).map((roleId) => ({
      roleId,
      status: 'failed' as const,
      failReason: 'timeout',
    }));
  }
  return buildRoundOutcomes(raw, stage, ctx.roleIds);
}

function buildVoteBody(ctx: BoardAgentsContext, timeoutMs: number) {
  const motion = ctx.session.finalMotion;
  if (!motion) {
    throw new Error('no_final_motion');
  }
  return {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    mode: 'live' as const,
    scenarioId: ctx.scenario.id,
    budgetMs: timeoutMs,
    transcript: transcriptPayload(ctx),
    motion: {
      id: motion.id,
      hash: motion.hash,
      text: motion.text,
      effectiveConditionIds: motion.effectiveConditionIds,
      executionMode: motion.executionMode,
    },
    roleIds: ctx.roleIds,
  };
}

/** 참가자 표·다른 임원의 표는 요청 본문에 절대 넣지 않는다(스펙 6장). requestId는 runner.ts가
 * 준 값을 그대로 표에 남겨 어떤 호출에서 왔는지 추적할 수 있게 한다. */
function toBallotOutcome(
  roleId: ExecMemberId,
  entry: Record<string, unknown>,
  ctx: BoardAgentsContext,
): BallotOutcome {
  const ballot = entry.ballot;
  if (entry.status === 'answered' && isRecord(ballot)) {
    const { vote, reason, evidenceIds, remainingConcerns, motionId, motionHash } = ballot;
    if (
      isVote(vote) &&
      typeof reason === 'string' &&
      isStringArray(evidenceIds) &&
      isStringArray(remainingConcerns) &&
      typeof motionId === 'string' &&
      typeof motionHash === 'string'
    ) {
      return {
        roleId,
        status: 'answered',
        ballot: {
          memberId: roleId,
          motionId,
          motionHash,
          vote,
          confirmedAt: 0,
          source: 'live',
          reason,
          remainingConcerns,
          modelId: typeof entry.modelId === 'string' ? entry.modelId : undefined,
          promptVersion: typeof entry.promptVersion === 'string' ? entry.promptVersion : undefined,
          requestId: ctx.requestId,
        },
      };
    }
  }
  const failReason = typeof entry.failReason === 'string' ? entry.failReason : 'invalid_response';
  return { roleId, status: 'failed', failReason };
}

async function runFinalVotesRequest(ctx: BoardAgentsContext): Promise<BallotOutcome[]> {
  const targets = ctx.roleIds ?? EXEC_MEMBER_ORDER;
  if (!ctx.session.finalMotion) {
    return targets.map((roleId) => ({ roleId, status: 'failed' as const, failReason: 'no_final_motion' }));
  }
  const timeoutMs = timeoutMsFor(ctx);
  let raw: unknown;
  try {
    raw = await postBoardRequest(
      '/api/board/vote',
      buildVoteBody(ctx, timeoutMs),
      ctx,
      timeoutMs + TRANSPORT_MARGIN_MS,
    );
  } catch {
    return targets.map((roleId) => ({ roleId, status: 'failed' as const, failReason: 'timeout' }));
  }
  if (!Array.isArray(raw)) {
    return targets.map((roleId) => ({ roleId, status: 'failed' as const, failReason: 'invalid_response' }));
  }
  return targets.map((roleId) => {
    const entry = findEntry(raw, roleId);
    return entry ? toBallotOutcome(roleId, entry, ctx) : { roleId, status: 'failed', failReason: 'invalid_response' };
  });
}

/** live 임원 에이전트 어댑터를 만든다. fetch만 사용하고 CDN·외부 SDK는 부르지 않는다. */
export function createLiveBoardAgentsAdapter(): BoardAgentsAdapter {
  return {
    initialOpinions(ctx) {
      return runRoundRequest(ctx, 'OPINIONS');
    },
    reactions(ctx) {
      return runRoundRequest(ctx, 'REACTIONS');
    },
    followUp(ctx) {
      return runRoundRequest(ctx, 'FOLLOWUP');
    },
    finalVotes(ctx) {
      return runFinalVotesRequest(ctx);
    },
  };
}

export const liveBoardAgentsAdapter: BoardAgentsAdapter = createLiveBoardAgentsAdapter();
