// 표결 핸들러: 고정된 최종안(motion)과 회의 기록으로 임원 4명에게 최종 표를 한 번 요청한다.
// AGENT_BOARDROOM_SPEC.md 3·5·6장. 참가자 표·다른 임원의 최종 표는 입력에도, 프롬프트에도
// 절대 넣지 않는다(스펙 6장: "임원에게 참가자의 최종 선택이나 다른 임원의 최종 표를 보내지 않는다").

import { z } from 'zod';
import {
  CONDITION_IDS,
  EVIDENCE_IDS,
  EXEC_ROLE_IDS,
  VOTE_VALUES,
  voteResponseSchema,
  type ExecRoleId,
  type VoteResponse,
} from '../validate';
import type { ModelProvider } from '../providers/types';
import { parseMockFault } from '../providers/mock';
import { getScenarioMaterials } from '../scenario-data';
import { buildCommonGuardrails, buildMeetingRecordBlock } from '../prompts/common';
import { ROLE_PROMPT_BUILDERS } from '../prompts/roles';
import { PROMPT_VERSION } from '../prompts/version';
import { systemClock, type Clock } from '../clock';
import { DEFAULT_ROUND_TIMEOUT_MS } from '../config';
import { logCall } from '../log';
import { withTimeout } from './timeout';
import { classifyFailure, roleIdsSchema } from './shared';

const transcriptStatementSchema = z.object({
  id: z.string().min(1),
  roleId: z.enum(EXEC_ROLE_IDS),
  message: z.string().min(1),
});

/** 표결 요청 본문. motion은 MOTION 단계에서 참가자 확인 후 고정된 값 그대로 전달된다.
 * 참가자 표나 다른 임원의 표는 여기 필드로 존재하지 않는다 — 의도적으로 없다. */
export const voteRequestSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  mode: z.enum(['live', 'scripted']),
  scenarioId: z.string().min(1),
  budgetMs: z.number().int().positive(),
  transcript: z.object({
    revision: z.number().int().min(0),
    statements: z.array(transcriptStatementSchema),
  }),
  motion: z.object({
    id: z.string().min(1),
    hash: z.string().min(1),
    text: z.string().min(1),
    effectiveConditionIds: z.array(z.enum(CONDITION_IDS)),
    executionMode: z.string().min(1),
  }),
  /** 미표결(UNCAST) 임원만 다시 호출할 때 쓰는 선택 필드(T65, "미표결 임원 다시 요청").
   * 없으면 임원 4명 전체를 부른다. */
  roleIds: roleIdsSchema.optional(),
  /** 테스트/개발 전용: roleId -> mock 장애 주입. 운영 요청에는 없다. */
  mock: z.record(z.string(), z.string()).optional(),
});
export type VoteRequest = z.infer<typeof voteRequestSchema>;

export interface Ballot {
  vote: VoteResponse['vote'];
  reason: string;
  evidenceIds: string[];
  remainingConcerns: string[];
  motionId: string;
  motionHash: string;
}

export interface VoteRoleResult {
  roleId: ExecRoleId;
  status: 'answered' | 'failed';
  ballot?: Ballot;
  failReason?: string;
  modelId: string;
  promptVersion: string;
}

export interface VoteHandlerDeps {
  provider: ModelProvider;
  clock?: Clock;
  /** OPINIONS·VOTE·probe와 같은 타임아웃(ms, T65). 생략하면 8000이다. */
  timeoutMs?: number;
}

function voteJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'roleId',
      'motionId',
      'motionHash',
      'vote',
      'reason',
      'evidenceIds',
      'remainingConcerns',
    ],
    properties: {
      roleId: { type: 'string', enum: [...EXEC_ROLE_IDS] },
      motionId: { type: 'string' },
      motionHash: { type: 'string' },
      vote: { type: 'string', enum: [...VOTE_VALUES] },
      reason: { type: 'string' }, // 길이 제약(1~160자)은 validate.ts에서 검증한다
      evidenceIds: { type: 'array', items: { type: 'string', enum: [...EVIDENCE_IDS] } },
      remainingConcerns: { type: 'array', items: { type: 'string' } },
    },
  };
}

function conditionLabels(
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  conditionIds: string[],
): string[] {
  const byId = new Map(materials.conditions.map((c) => [c.id, c.label] as const));
  return conditionIds.map((id) => byId.get(id) ?? id);
}

function buildVoteSystemPrompt(
  roleId: ExecRoleId,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  input: VoteRequest,
): string {
  const rolePrompt = ROLE_PROMPT_BUILDERS[roleId](materials, 'VOTE');
  const meetingRecord = buildMeetingRecordBlock({
    scenarioId: materials.scenarioId,
    originalMotionText: materials.originalMotionText,
    evidence: materials.evidence,
    conditions: materials.conditions,
    stage: 'VOTE',
    transcriptRevision: input.transcript.revision,
    statements: input.transcript.statements,
    motion: {
      id: input.motion.id,
      text: input.motion.text,
      effectiveConditionLabels: conditionLabels(materials, input.motion.effectiveConditionIds),
      executionMode: input.motion.executionMode,
    },
  });
  return [
    buildCommonGuardrails(),
    rolePrompt,
    '지금은 최종 표결 단계입니다. 위 meeting_record의 고정된 안건(motionId/motionHash)에 대해' +
      ' 당신의 최종 판단 한 번만 내리십시오. 다른 임원이나 참가자가 어떻게 표결했는지는 전달되지' +
      ' 않으며, 당신은 그것을 알 수 없다는 전제로 스스로 판단하십시오.',
    '응답의 motionId·motionHash는 meeting_record에 적힌 값과 정확히 같아야 하고, reason은' +
      ' 160자 이내여야 합니다.',
    meetingRecord,
  ].join('\n\n');
}

async function callRoleVote(
  roleId: ExecRoleId,
  input: VoteRequest,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
): Promise<VoteRoleResult> {
  const start = clock.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const system = buildVoteSystemPrompt(roleId, materials, input);
    const user = JSON.stringify({
      kind: 'vote',
      roleId,
      motionId: input.motion.id,
      motionHash: input.motion.hash,
      mock: parseMockFault(input.mock?.[roleId]),
    });
    const raw = provider.complete({
      system,
      user,
      schema: voteJsonSchema(),
      maxTokens: 400,
      timeoutMs,
      signal: controller.signal,
    });
    const result = await withTimeout(raw, timeoutMs);
    const latencyMs = clock.now() - start;
    const parsed = voteResponseSchema({
      motionId: input.motion.id,
      motionHash: input.motion.hash,
    }).safeParse(result.json);
    if (!parsed.success || parsed.data.roleId !== roleId) {
      logCall({
        ts: new Date(clock.now()).toISOString(),
        kind: 'vote',
        sessionId: input.sessionId,
        stage: 'VOTE',
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
        modelId: result.modelId,
        promptVersion: PROMPT_VERSION,
      };
    }
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'vote',
      sessionId: input.sessionId,
      stage: 'VOTE',
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
      ballot: {
        vote: parsed.data.vote,
        reason: parsed.data.reason,
        evidenceIds: parsed.data.evidenceIds,
        remainingConcerns: parsed.data.remainingConcerns,
        motionId: parsed.data.motionId,
        motionHash: parsed.data.motionHash,
      },
      modelId: result.modelId,
      promptVersion: PROMPT_VERSION,
    };
  } catch (err) {
    const latencyMs = clock.now() - start;
    const { failReason, providerErrorClass, httpStatus } = classifyFailure(err);
    logCall({
      ts: new Date(clock.now()).toISOString(),
      kind: 'vote',
      sessionId: input.sessionId,
      stage: 'VOTE',
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
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 임원(기본 4명, roleIds가 있으면 그 역할만)에게 최종 표를 병렬로 한 번씩 요청한다(재시도
 * 0회). 참가자 표·다른 임원 표는 입력에도 프롬프트에도 포함하지 않는다. roleIds는 미표결
 * (UNCAST) 임원만 다시 부르는 "다시 요청"(T65)이 쓴다. */
export async function handleVote(
  input: VoteRequest,
  deps: VoteHandlerDeps,
): Promise<VoteRoleResult[]> {
  const materials = getScenarioMaterials(input.scenarioId);
  if (!materials) {
    throw new Error(`unknown_scenario:${input.scenarioId}`);
  }
  const clock = deps.clock ?? systemClock;
  const timeoutMs = Math.min(deps.timeoutMs ?? DEFAULT_ROUND_TIMEOUT_MS, input.budgetMs);
  const targets = input.roleIds ?? EXEC_ROLE_IDS;

  const settled = await Promise.allSettled(
    targets.map((roleId) => callRoleVote(roleId, input, materials, timeoutMs, deps.provider, clock)),
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
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  });
}
