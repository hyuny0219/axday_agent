// 라운드 핸들러: OPINIONS/REACTIONS/FOLLOWUP 단계에서 임원 4명을 병렬 호출한다.
// AGENT_BOARDROOM_SPEC.md 3·5·6장. 시나리오 규칙표(voteRules 등)는 프롬프트에 넣지 않는다.

import { z } from 'zod';
import {
  CONDITION_IDS,
  EVIDENCE_IDS,
  EXEC_ROLE_IDS,
  STANCE_VALUES,
  STATEMENT_STAGES,
  statementResponseSchema,
  type ExecRoleId,
  type StatementResponse,
} from '../validate';
import type { ModelProvider } from '../providers/types';
import { parseMockFault } from '../providers/mock';
import { getScenarioMaterials } from '../scenario-data';
import { buildCommonGuardrails, buildMeetingRecordBlock } from '../prompts/common';
import { ROLE_PROMPT_BUILDERS } from '../prompts/roles';
import { PROMPT_VERSION } from '../prompts/version';
import { systemClock, type Clock } from '../clock';
import { DEFAULT_REACTION_TIMEOUT_MS, DEFAULT_ROUND_TIMEOUT_MS } from '../config';
import { logCall } from '../log';
import { withTimeout } from './timeout';
import { classifyFailure, roleIdsSchema } from './shared';

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
        ' 수정을 할 수 있습니다. referencedStatementIds에는 실제로 언급한 발언 ID만 넣으십시오.'
      );
    case 'FOLLOWUP':
      return (
        '지금은 후속 보완 단계입니다. 직전까지의 전체 발언과 참가자의 후속 의견을 반영해 짧게' +
        ' 보완하십시오.'
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
  });
  return [
    buildCommonGuardrails(),
    rolePrompt,
    stageInstruction(input.stage),
    '응답은 message 120자 이내로 요약하고, roleId 필드에는 당신의 역할 ID를 그대로 넣으십시오.',
    meetingRecord,
  ].join('\n\n');
}

async function callRole(
  roleId: ExecRoleId,
  input: RoundRequest,
  materials: ReturnType<typeof getScenarioMaterials>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
): Promise<RoundRoleResult> {
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
    if (!parsed.success || parsed.data.roleId !== roleId) {
      logCall({
        ts: new Date(clock.now()).toISOString(),
        kind: 'round',
        sessionId: input.sessionId,
        stage: input.stage,
        roleId,
        status: 'failed',
        failReason: 'invalid_response',
        providerErrorClass: 'invalid_response',
        latencyMs,
        timeoutMs,
        promptVersion: PROMPT_VERSION,
        modelId: result.modelId,
      });
      return {
        roleId,
        status: 'failed',
        failReason: 'invalid_response',
        latencyMs,
        modelId: result.modelId,
        promptVersion: PROMPT_VERSION,
      };
    }
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'round',
      sessionId: input.sessionId,
      stage: input.stage,
      roleId,
      status: 'answered',
      latencyMs,
      timeoutMs,
      promptVersion: PROMPT_VERSION,
      modelId: result.modelId,
    });
    return {
      roleId,
      status: 'answered',
      statement: parsed.data,
      latencyMs,
      modelId: result.modelId,
      promptVersion: PROMPT_VERSION,
    };
  } catch (err) {
    const latencyMs = clock.now() - start;
    const { failReason, providerErrorClass, httpStatus } = classifyFailure(err);
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'round',
      sessionId: input.sessionId,
      stage: input.stage,
      roleId,
      status: 'failed',
      failReason,
      providerErrorClass,
      httpStatus,
      latencyMs,
      timeoutMs,
      promptVersion: PROMPT_VERSION,
      modelId: '',
    });
    return {
      roleId,
      status: 'failed',
      failReason,
      latencyMs,
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 임원(기본 4명, roleIds가 있으면 그 역할만)을 병렬 호출한다(재시도 0회). 알 수 없는
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
    targets.map((roleId) => callRole(roleId, input, materials, timeoutMs, deps.provider, clock)),
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
