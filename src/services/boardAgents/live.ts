// live 임원 에이전트 어댑터(AGENT_BOARDROOM_SPEC.md 3·5·6장). /api/board/round·/api/board/vote를
// 호출해 서버가 검증까지 끝낸 응답만 Statement/Ballot으로 옮긴다. 실제 판단은 서버(T28
// handlers)가 하며 이 파일은 요청 조립·시간 예산·응답 형태 변환만 담당한다.
//
// 대기 시간은 min(8000ms, ctx.budgetMs)를 넘기지 않는다(스펙 6장 "실제 허용 대기는 min(8초,
// 남은 세션 시간)"). ctx.signal이 먼저 abort되면(세션 리셋 등) 그 즉시 요청도 취소한다.
// 서버 응답이 배열이 아니거나 개별 항목이 예상한 필드를 갖추지 못하면(네트워크 중간 오류·
// 스키마 변경 등) 해당 역할을 failed로 남길 뿐 예외를 던지지 않는다 — 늦거나 깨진 응답으로
// 세션이 멈추지 않게 한다.
//
// T30 live E2E 전용: 페이지 URL의 `?mock=fault:role[,fault:role...]` 쿼리(예:
// `?mock=timeout:cio`)가 있으면 그 role의 mock 장애 주입을 요청 본문의 mock 필드로 실어
// 보낸다. server/handlers/round·vote.ts는 이미 이 필드를 읽어 mock provider(T27/T28)에
// 전달하므로 서버 쪽은 바꾸지 않는다. 쿼리가 없으면 이 필드는 아예 만들지 않는다(운영 요청과
// 동일한 모양을 유지).

import type { ExecMemberId, Vote } from '../../content/types';
import type { StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from './types';

/** 임원 라운드별 최대 대기 시간(AGENT_BOARDROOM_SPEC.md 6장). */
export const MAX_ROUND_TIMEOUT_MS = 8000;

function timeoutMsFor(ctx: BoardAgentsContext): number {
  return Math.max(0, Math.min(MAX_ROUND_TIMEOUT_MS, ctx.budgetMs));
}

/** `?mock=timeout:cio,invalid:ceo` 형태를 `{ CIO: 'timeout', CEO: 'invalid' }`로 바꾼다.
 * 값이 없거나 형식이 안 맞으면 undefined(요청 본문에 mock 필드를 넣지 않는다). */
function mockOverridesFromLocation(): Record<string, string> | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const raw = new URLSearchParams(window.location.search).get('mock');
  if (!raw) {
    return undefined;
  }
  const overrides: Record<string, string> = {};
  for (const entry of raw.split(',')) {
    const [fault, roleId] = entry.split(':');
    if (!fault || !roleId) {
      continue;
    }
    overrides[roleId.trim().toUpperCase()] = fault.trim();
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVote(value: unknown): value is Vote {
  return value === 'YES' || value === 'HOLD' || value === 'NO';
}

function allFailed(reason: string): Array<{ roleId: ExecMemberId; status: 'failed'; failReason: string }> {
  return EXEC_MEMBER_ORDER.map((roleId) => ({ roleId, status: 'failed' as const, failReason: reason }));
}

function findEntry(raw: unknown[], roleId: ExecMemberId): Record<string, unknown> | undefined {
  const entry = raw.find((item) => isRecord(item) && item.roleId === roleId);
  return isRecord(entry) ? entry : undefined;
}

/** ctx.signal(외부 abort)과 자체 timeoutMs 중 먼저 일어나는 쪽으로 fetch를 취소한다. */
async function postBoardRequest(path: string, body: unknown, ctx: BoardAgentsContext): Promise<unknown> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (ctx.signal.aborted) {
    controller.abort();
  } else {
    ctx.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMsFor(ctx));
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

function buildRoundBody(ctx: BoardAgentsContext, stage: StatementStage) {
  return {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    mode: 'live' as const,
    stage,
    transcript: transcriptPayload(ctx),
    participantOpinion: latestParticipantOpinion(ctx),
    scenarioId: ctx.scenario.id,
    budgetMs: timeoutMsFor(ctx),
    mock: mockOverridesFromLocation(),
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
    const { message, evidenceIds, referencedStatementIds, concerns, suggestedConditionIds } = statement;
    if (
      typeof message === 'string' &&
      isStringArray(evidenceIds) &&
      isStringArray(referencedStatementIds) &&
      isStringArray(concerns) &&
      isStringArray(suggestedConditionIds)
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
          source: 'live',
          createdAt: 0,
        },
      };
    }
  }
  const failReason = typeof entry.failReason === 'string' ? entry.failReason : 'invalid_response';
  return { roleId, status: 'failed', failReason };
}

function buildRoundOutcomes(raw: unknown, stage: StatementStage): StatementOutcome[] {
  if (!Array.isArray(raw)) {
    return allFailed('invalid_response');
  }
  return EXEC_MEMBER_ORDER.map((roleId) => {
    const entry = findEntry(raw, roleId);
    return entry ? toStatementOutcome(roleId, entry, stage) : { roleId, status: 'failed', failReason: 'invalid_response' };
  });
}

async function runRoundRequest(ctx: BoardAgentsContext, stage: StatementStage): Promise<StatementOutcome[]> {
  let raw: unknown;
  try {
    raw = await postBoardRequest('/api/board/round', buildRoundBody(ctx, stage), ctx);
  } catch {
    return allFailed('timeout');
  }
  return buildRoundOutcomes(raw, stage);
}

function buildVoteBody(ctx: BoardAgentsContext) {
  const motion = ctx.session.finalMotion;
  if (!motion) {
    throw new Error('no_final_motion');
  }
  return {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    mode: 'live' as const,
    scenarioId: ctx.scenario.id,
    budgetMs: timeoutMsFor(ctx),
    transcript: transcriptPayload(ctx),
    motion: {
      id: motion.id,
      hash: motion.hash,
      text: motion.text,
      effectiveConditionIds: motion.effectiveConditionIds,
      executionMode: motion.executionMode,
    },
    mock: mockOverridesFromLocation(),
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
  if (!ctx.session.finalMotion) {
    return allFailed('no_final_motion');
  }
  let raw: unknown;
  try {
    raw = await postBoardRequest('/api/board/vote', buildVoteBody(ctx), ctx);
  } catch {
    return allFailed('timeout');
  }
  if (!Array.isArray(raw)) {
    return allFailed('invalid_response');
  }
  return EXEC_MEMBER_ORDER.map((roleId) => {
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
