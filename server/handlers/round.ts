// 라운드 핸들러: OPINIONS/REACTIONS/FOLLOWUP 단계에서 임원 4명을 병렬 호출한다.
// AGENT_BOARDROOM_SPEC.md 3·5·6장. 시나리오 규칙표(voteRules 등)는 프롬프트에 넣지 않는다.

import { z } from 'zod';
import {
  CONDITION_IDS,
  EVIDENCE_IDS,
  EXEC_ROLE_IDS,
  PARTICIPANT_STANCE_VALUES,
  STANCE_VALUES,
  STATEMENT_STAGES,
  statementResponseSchema,
  type ExecRoleId,
  type StatementResponse,
} from '../validate';
import type { ModelProvider } from '../providers/types';
import { parseMockFault } from '../providers/mock';
import { getScenarioMaterials } from '../scenario-data';
import {
  FOLLOWUP_ANSWERED_RULE,
  FOLLOWUP_NO_VERDICT_RULE,
  REACTIONS_FIRST_PASS_RULE,
  buildCommonGuardrails,
  buildMeetingRecordBlock,
} from '../prompts/common';
import { ROLE_PROMPT_BUILDERS } from '../prompts/roles';
import { PROMPT_VERSION } from '../prompts/version';
import { systemClock, type Clock } from '../clock';
import { DEFAULT_REACTION_TIMEOUT_MS, DEFAULT_ROUND_TIMEOUT_MS } from '../config';
import { logCall } from '../log';
import { findVerdictWords, maskedFollowUpMessage } from '../../src/domain/verdictWords';
import { withTimeout } from './timeout';
import { classifyFailure, isRetryableFailure, MIN_RETRY_REMAINING_MS, roleIdsSchema, type ProviderErrorClass, sumTokens } from './shared';

const transcriptStatementSchema = z.object({
  id: z.string().min(1),
  roleId: z.enum(EXEC_ROLE_IDS),
  message: z.string().min(1),
});

/** 라운드 요청 본문. 서버는 매 라운드 임원 4명을 같은 snapshot으로 병렬 호출한다. */
export const roundRequestSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  mode: z.enum(['live', 'scripted']),
  stage: z.enum(STATEMENT_STAGES),
  transcript: z.object({
    revision: z.number().int().min(0),
    statements: z.array(transcriptStatementSchema),
  }),
  participantOpinion: z.string().min(1).optional(),
  /** 참가자가 가장 최근 의견에서 밝힌 입장(T92). 없으면 입장을 고르지 않은 것이다. */
  participantStance: z.enum(PARTICIPANT_STANCE_VALUES).optional(),
  /** 참가자가 추가 질문에 답을 전달했는지(T110, 프롬프트 v12). 없으면(기존 요청) 답한 것으로
   * 보지 않는다 — REACTIONS는 단계 자체가 "아직 답하기 전"이라 이 값과 무관하다. */
  followUpAnswered: z.boolean().optional(),
  scenarioId: z.string().min(1),
  budgetMs: z.number().int().positive(),
  /** 실패한 역할만 다시 호출할 때 쓰는 선택 필드(T65, "다시 요청"). 없으면 임원 4명 전체를
   * 부른다 — 기존 요청은 이 필드가 없으므로 동작이 그대로다. */
  roleIds: roleIdsSchema.optional(),
  /** 테스트/개발 전용: roleId -> mock 장애 주입. 운영 요청에는 없다. */
  mock: z.record(z.string(), z.string()).optional(),
});
export type RoundRequest = z.infer<typeof roundRequestSchema>;

export interface RoundRoleResult {
  roleId: ExecRoleId;
  status: 'answered' | 'failed';
  statement?: StatementResponse;
  failReason?: string;
  latencyMs: number;
  modelId: string;
  promptVersion: string;
}

export interface RoundHandlerDeps {
  provider: ModelProvider;
  clock?: Clock;
  /** OPINIONS·VOTE와 REACTIONS·FOLLOWUP의 타임아웃(ms, T65). 생략하면 config.ts 기본값
   * (8000/12000)을 쓴다 — 기존 테스트가 그대로 통과한다. */
  timeouts?: { roundTimeoutMs: number; reactionTimeoutMs: number };
  /** T114(Codex 54차): FOLLOWUP 임원 한 명의 시도별 원시 응답·위반과 대체 여부를 받는 내부 수집기.
   * 평가 스크립트만 넘긴다 — 클라이언트 응답 JSON에는 실리지 않는다(반환값·로그와 별개). */
  followUpAudit?: FollowUpAuditEntry[];
}

export interface FollowUpAuditEntry {
  roleId: ExecRoleId;
  /** 시도별 원시 message(스키마를 통과한 응답만; 형식 오류·타임아웃 시도는 건너뛴다). */
  attempts: Array<{ text: string; violations: string[] }>;
  /** 재시도 뒤에도 방향 표현이 남아 중립 문장으로 대체했는가(로그 note followup_verdict_masked). */
  masked: boolean;
}

const DEFAULT_TIMEOUTS = {
  roundTimeoutMs: DEFAULT_ROUND_TIMEOUT_MS,
  reactionTimeoutMs: DEFAULT_REACTION_TIMEOUT_MS,
};

/** REACTIONS·FOLLOWUP만 더 긴 예외 타임아웃을 쓴다(스펙 6장 "REACTIONS·FOLLOWUP은 12초까지") —
 * 프롬프트가 참가자 의견·이전 발언까지 실어 OPINIONS보다 길다. */
function stageTimeoutMs(
  stage: RoundRequest['stage'],
  timeouts: { roundTimeoutMs: number; reactionTimeoutMs: number },
): number {
  return stage === 'REACTIONS' || stage === 'FOLLOWUP' ? timeouts.reactionTimeoutMs : timeouts.roundTimeoutMs;
}

const STATEMENT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'roleId',
    'message',
    'evidenceIds',
    'referencedStatementIds',
    'concerns',
    'suggestedConditionIds',
    'stance',
  ],
  properties: {
    roleId: { type: 'string', enum: [...EXEC_ROLE_IDS] },
    message: { type: 'string' }, // 길이 제약(1~120자)은 구조화 출력이 지원하지 않아 validate.ts에서 검증한다
    evidenceIds: { type: 'array', items: { type: 'string', enum: [...EVIDENCE_IDS] } },
    referencedStatementIds: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    suggestedConditionIds: { type: 'array', items: { type: 'string', enum: [...CONDITION_IDS] } },
    stance: { type: 'string', enum: [...STANCE_VALUES] },
  },
};

function stageInstruction(stage: RoundRequest['stage']): string {
  switch (stage) {
    case 'OPINIONS':
      return '지금은 초기 의견 단계입니다. 자료와 원안을 근거로 짧은 논거와 확인 질문을 내십시오.';
    case 'REACTIONS':
      return (
        '지금은 반응 단계입니다. 참가자 발언과 동료 임원의 기존 발언(ID)을 참고해 동의·반론·입장' +
        ' 수정을 할 수 있습니다. referencedStatementIds에는 실제로 언급한 발언 ID만 넣으십시오.' +
        ' 참가자 발언의 핵심 주장 한 가지를 짚어 그 주장에 직접 답하십시오 — "말씀은 잘' +
        ' 들었습니다" 같은 수신 확인만 하고 넘어가지 마십시오. ' +
        REACTIONS_FIRST_PASS_RULE
      );
    case 'FOLLOWUP':
      return (
        '지금은 후속 보완 단계입니다. 직전까지의 전체 발언과 참가자의 후속 의견을 반영해 짧게' +
        ' 보완하십시오. ' +
        FOLLOWUP_ANSWERED_RULE +
        ' ' +
        FOLLOWUP_NO_VERDICT_RULE
      );
  }
}

function buildRoundSystemPrompt(
  roleId: ExecRoleId,
  materials: ReturnType<typeof getScenarioMaterials>,
  input: RoundRequest,
): string {
  if (!materials) {
    throw new Error(`unknown_scenario:${input.scenarioId}`);
  }
  const rolePrompt = ROLE_PROMPT_BUILDERS[roleId](materials, input.stage);
  const meetingRecord = buildMeetingRecordBlock({
    scenarioId: materials.scenarioId,
    originalMotionText: materials.originalMotionText,
    evidence: materials.evidence,
    conditions: materials.conditions,
    stage: input.stage,
    transcriptRevision: input.transcript.revision,
    statements: input.transcript.statements,
    participantOpinion: input.participantOpinion,
    participantStance: input.participantStance ?? null,
    followUpAnswered: input.followUpAnswered,
  });
  return [
    buildCommonGuardrails(),
    rolePrompt,
    stageInstruction(input.stage),
    '응답은 message 120자 이내로 요약하고, roleId 필드에는 당신의 역할 ID를 그대로 넣으십시오.',
    meetingRecord,
  ].join('\n\n');
}

/** callRole 내부에서만 쓰는 시도 1회 결과 — 로그 전용 providerErrorClass·httpStatus·캐시
 * 토큰 수까지 담아 둔다(T91, 재시도 판단과 최종 로그 한 줄에 쓴다). */
interface RoleAttemptResult extends RoundRoleResult {
  providerErrorClass?: ProviderErrorClass;
  httpStatus?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** T114: FOLLOWUP 응답이 스키마는 통과했지만 문장에 방향 단어가 있어 거절된 시도의 원본.
   * callRole이 재시도 뒤에도 이 값이 남아 있으면 그 임원 발언을 중립 문장으로 대체한다. */
  verdictStatement?: StatementResponse;
  /** T114: 스키마를 통과한 이 시도의 원시 message(평가 수집용). */
  rawMessage?: string;
}

/** 제공자 호출 1회(파싱·조건 ID 검증 포함). 로그를 남기지 않는다 — callRole이 재시도
 * 여부를 정한 뒤 최종 결과만 한 줄로 남긴다(T91). */
async function attemptRole(
  roleId: ExecRoleId,
  input: RoundRequest,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
): Promise<RoleAttemptResult> {
  const start = clock.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const knownStatementIds = input.transcript.statements.map((s) => s.id);
  try {
    const system = buildRoundSystemPrompt(roleId, materials, input);
    const user = JSON.stringify({
      kind: 'statement',
      roleId,
      stage: input.stage,
      // PR #13 Codex 2차 검토 P1: mock 제공자가 안건별로 유효한 조건 ID를 고르려면
      // scenarioId가 envelope에 있어야 한다(server/providers/mock.ts 참고).
      scenarioId: input.scenarioId,
      followUpAnswered: input.followUpAnswered,
      participantStance: input.participantStance,
      mock: parseMockFault(input.mock?.[roleId]),
    });
    const raw = provider.complete({
      system,
      user,
      schema: STATEMENT_JSON_SCHEMA,
      maxTokens: 500,
      timeoutMs,
      signal: controller.signal,
    });
    const result = await withTimeout(raw, timeoutMs);
    const latencyMs = clock.now() - start;
    const parsed = statementResponseSchema(knownStatementIds).safeParse(result.json);
    // PR #13 Codex 1차 검토 P2: CONDITION_IDS는 모든 활성 안건의 합집합이라 스키마만으로는
    // 다른 안건의 조건(예: 안건①에 SCOPE)도 통과한다. 이 안건(materials) 자신의 조건이
    // 아니면 모르는 ID와 같은 취급으로 응답 전체를 거절한다(정답표 노출·잘못된 라벨 방지).
    const validConditionIds = new Set(materials.conditions.map((c) => c.id));
    const hasForeignCondition =
      parsed.success &&
      parsed.data.suggestedConditionIds.some((id) => !validConditionIds.has(id));
    if (!parsed.success || parsed.data.roleId !== roleId || hasForeignCondition) {
      return {
        roleId,
        status: 'failed',
        failReason: 'invalid_response',
        providerErrorClass: 'invalid_response',
        latencyMs,
        modelId: result.modelId,
        // 응답까지는 받았으므로 캐시 토큰은 실제로 쓰였다 — 재시도 합산에 넣는다(Codex 36차 P2).
        cacheReadTokens: result.usage?.cacheReadInputTokens,
        cacheWriteTokens: result.usage?.cacheCreationInputTokens,
        promptVersion: PROMPT_VERSION,
      };
    }
    // T114: 답변 뒤 방향은 결과에서 공개한다 — FOLLOWUP 문장에 찬성·반대 같은 말이 있으면
    // invalid_response로 보고 기존 재시도 경로를 탄다.
    if (input.stage === 'FOLLOWUP' && findVerdictWords(parsed.data.message).length > 0) {
      return {
        roleId,
        status: 'failed',
        failReason: 'invalid_response',
        providerErrorClass: 'invalid_response',
        latencyMs,
        modelId: result.modelId,
        cacheReadTokens: result.usage?.cacheReadInputTokens,
        cacheWriteTokens: result.usage?.cacheCreationInputTokens,
        promptVersion: PROMPT_VERSION,
        verdictStatement: parsed.data,
        rawMessage: parsed.data.message,
      };
    }
    return {
      roleId,
      status: 'answered',
      statement: parsed.data,
      latencyMs,
      modelId: result.modelId,
      promptVersion: PROMPT_VERSION,
      cacheReadTokens: result.usage?.cacheReadInputTokens,
      cacheWriteTokens: result.usage?.cacheCreationInputTokens,
      rawMessage: parsed.data.message,
    };
  } catch (err) {
    const latencyMs = clock.now() - start;
    const { failReason, providerErrorClass, httpStatus } = classifyFailure(err);
    return {
      roleId,
      status: 'failed',
      failReason,
      providerErrorClass,
      httpStatus,
      latencyMs,
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 임원 한 명을 호출하고, 빠르게(timeout 외 이유로) 실패했는데 남은 예산이 충분하면
 * (MIN_RETRY_REMAINING_MS 이상) 같은 요청을 1회만 더 보낸다(T91). 최종 결과 한 줄만
 * attempts 필드(1 또는 2)와 함께 로그에 남긴다 — latencyMs는 재시도까지 포함한 총
 * 소요 시간이다. */
async function callRole(
  roleId: ExecRoleId,
  input: RoundRequest,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
  audit?: FollowUpAuditEntry[],
): Promise<RoundRoleResult> {
  const overallStart = clock.now();
  let attempts = 1;
  let outcome = await attemptRole(roleId, input, materials, timeoutMs, provider, clock);
  const rawAttempts: FollowUpAuditEntry['attempts'] = [];
  const noteAttempt = (attempt: RoleAttemptResult) => {
    if (attempt.rawMessage !== undefined) {
      rawAttempts.push({ text: attempt.rawMessage, violations: findVerdictWords(attempt.rawMessage) });
    }
  };
  noteAttempt(outcome);
  if (outcome.status === 'failed' && isRetryableFailure(outcome.failReason, outcome.providerErrorClass)) {
    // 재시도까지 포함한 전체 시간은 서버 상한(timeoutMs)을 넘지 않는다 — input.budgetMs는
    // 클라이언트가 보낸 값이라 서버 상한보다 클 수 있다(PR #20 Codex 17차 검토 P2).
    const remainingMs = timeoutMs - (clock.now() - overallStart);
    if (remainingMs >= MIN_RETRY_REMAINING_MS) {
      attempts = 2;
      const first = outcome;
      const second = await attemptRole(roleId, input, materials, Math.min(timeoutMs, remainingMs), provider, clock);
      noteAttempt(second);
      // 캐시 토큰은 두 시도를 합산한다(PR #20 Codex 36차 검토 P2).
      outcome = {
        ...second,
        cacheReadTokens: sumTokens(first.cacheReadTokens, second.cacheReadTokens),
        cacheWriteTokens: sumTokens(first.cacheWriteTokens, second.cacheWriteTokens),
      };
    }
  }
  // T114: 재시도(또는 재시도 예산 부족) 뒤에도 방향 단어가 남았으면 그 발언만 중립 문장으로 바꿔
  // 내려보낸다. 나머지 필드(stance·근거·조건)는 그대로 둔다.
  let masked = false;
  if (outcome.status === 'failed' && outcome.verdictStatement) {
    outcome = {
      ...outcome,
      status: 'answered',
      failReason: undefined,
      providerErrorClass: undefined,
      statement: { ...outcome.verdictStatement, message: maskedFollowUpMessage(roleId) },
      verdictStatement: undefined,
    };
    masked = true;
  }
  if (audit && input.stage === 'FOLLOWUP') {
    audit.push({ roleId, attempts: rawAttempts, masked });
  }
  const latencyMs = clock.now() - overallStart;
  logCall({
    ts: new Date(clock.now()).toISOString(),
    kind: 'round',
    sessionId: input.sessionId,
    stage: input.stage,
    roleId,
    status: outcome.status,
    failReason: outcome.failReason,
    providerErrorClass: outcome.providerErrorClass,
    httpStatus: outcome.httpStatus,
    latencyMs,
    timeoutMs,
    attempts,
    cacheReadTokens: outcome.cacheReadTokens,
    cacheWriteTokens: outcome.cacheWriteTokens,
    promptVersion: PROMPT_VERSION,
    modelId: outcome.modelId,
    note: masked ? 'followup_verdict_masked' : undefined,
  });
  return {
    roleId,
    status: outcome.status,
    statement: outcome.statement,
    failReason: outcome.failReason,
    latencyMs,
    modelId: outcome.modelId,
    promptVersion: PROMPT_VERSION,
  };
}

/** 임원(기본 4명, roleIds가 있으면 그 역할만)을 병렬 호출한다(역할당 최대 2회 — timeout
 * 외 이유로 빠르게 실패하고 예산이 남아 있으면 callRole이 1회 재시도한다, T91). 알 수 없는
 * scenarioId는 예외를 던진다(호출자가 400 등으로 변환). 개별 임원 실패는 failed 결과로만
 * 남고 다른 임원 호출에 영향을 주지 않는다. roleIds는 실패한 역할만 다시 부르는 "다시
 * 요청"(T65)이 쓴다 — 응답은 요청한 역할만큼만 돌아온다. */
export async function handleRound(
  input: RoundRequest,
  deps: RoundHandlerDeps,
): Promise<RoundRoleResult[]> {
  const materials = getScenarioMaterials(input.scenarioId);
  if (!materials) {
    throw new Error(`unknown_scenario:${input.scenarioId}`);
  }
  const clock = deps.clock ?? systemClock;
  const timeouts = deps.timeouts ?? DEFAULT_TIMEOUTS;
  const timeoutMs = Math.min(stageTimeoutMs(input.stage, timeouts), input.budgetMs);
  const targets = input.roleIds ?? EXEC_ROLE_IDS;

  const settled = await Promise.allSettled(
    targets.map((roleId) => callRole(roleId, input, materials, timeoutMs, deps.provider, clock, deps.followUpAudit)),
  );

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const roleId = targets[index] as ExecRoleId;
    return {
      roleId,
      status: 'failed',
      failReason: 'provider_error',
      latencyMs: 0,
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  });
}
