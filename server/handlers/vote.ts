// 표결 핸들러: 고정된 최종안(motion)과 회의 기록으로 임원 4명에게 최종 표를 한 번 요청한다.
// AGENT_BOARDROOM_SPEC.md 3·5·6장. 참가자 표·다른 임원의 최종 표는 입력에도, 프롬프트에도
// 절대 넣지 않는다(스펙 6장: "임원에게 참가자의 최종 선택이나 다른 임원의 최종 표를 보내지 않는다").

import { z } from 'zod';
import {
  CONDITION_IDS,
  EVIDENCE_IDS,
  EXEC_ROLE_IDS,
  PARTICIPANT_STANCE_VALUES,
  VOTE_VALUES,
  voteResponseSchema,
  type ExecRoleId,
  type VoteResponse,
} from '../validate';
import type { ModelProvider } from '../providers/types';
import { parseMockFault } from '../providers/mock';
import { getScenarioMaterials, splitConditionLabels } from '../scenario-data';
import {
  ANSWER_JUDGMENT_RULE,
  VOTE_UNANSWERED_RULE,
  VOTE_UNDECIDED_START_RULE,
  buildCommonGuardrails,
  buildMeetingRecordBlock,
} from '../prompts/common';
import { ROLE_PROMPT_BUILDERS } from '../prompts/roles';
import {
  buildVoteDirectionReminder,
  buildVoteDirectionRule,
  ruleVoteBallot,
  ruleVoteDirection,
} from '../prompts/voteDirection';
import { PROMPT_VERSION } from '../prompts/version';
import { systemClock, type Clock } from '../clock';
import { DEFAULT_ROUND_TIMEOUT_MS } from '../config';
import { logCall } from '../log';
import { withTimeout } from './timeout';
import { classifyFailure, isRetryableFailure, MIN_RETRY_REMAINING_MS, followUpQuestionSchema, roleIdsSchema, type ProviderErrorClass, sumTokens, summarizeInvalidIssues, mergeInvalidIssues } from './shared';

const transcriptStatementSchema = z.object({
  id: z.string().min(1),
  roleId: z.enum(EXEC_ROLE_IDS),
  message: z.string().min(1),
});

/** 표결 요청 본문. motion은 MOTION 단계에서 참가자 확인 후 고정된 값 그대로 전달된다.
 * 참가자 표나 다른 임원의 표는 여기 필드로 존재하지 않는다 — 의도적으로 없다. */
const voteRequestShape = z.object({
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
  /** 참가자가 안건을 고정하기까지 밝힌 입장(T92). 참가자의 "최종 표"가 아니라 토론
   * 중 입장이라 스펙 6장의 "참가자 표는 보내지 않는다"와 다르다 — 안건에 붙은 조건이
   * 참가자의 요구였는지 판단하는 데 쓴다. */
  participantStance: z.enum(PARTICIPANT_STANCE_VALUES).optional(),
  /** 참가자가 추가 질문에 답을 전달했는지(T110, 프롬프트 v12). 생략하면(기존 요청) 답한 것과
   * 같게 다룬다 — false일 때만 "답하지 않고 넘어감" 규칙이 붙는다. */
  followUpAnswered: z.boolean().optional(),
  /** 화면의 추가 질문 하나와 참가자의 답변 문장(T122, 프롬프트 v14). 생략하면 v13까지의 동작이다. */
  followUpQuestion: followUpQuestionSchema.optional(),
  followUpAnswerText: z.string().min(1).max(300).optional(),
  /** 미표결(UNCAST) 임원만 다시 호출할 때 쓰는 선택 필드(T65, "미표결 임원 다시 요청").
   * 없으면 임원 4명 전체를 부른다. */
  roleIds: roleIdsSchema.optional(),
  /** 테스트/개발 전용: roleId -> mock 장애 주입. 운영 요청에는 없다. */
  mock: z.record(z.string(), z.string()).optional(),
});

/** PR #13 Codex 1차 검토 P2: CONDITION_IDS는 모든 활성 안건의 합집합이라, 안건②(SCOPE 등)
 * 요청에 안건①의 조건(LIMIT 등)을 실어도 형태상으로는 통과한다. motion.effectiveConditionIds는
 * scenarioId가 가리키는 안건 자신의 조건이어야만 유효하므로, 등록된 안건이면(알 수 없는
 * scenarioId는 handleVote가 던지는 unknown_scenario로 따로 처리) 그 안건의 conditions에 없는
 * ID가 섞이면 400 invalid_request로 거절한다. */
export const voteRequestSchema = voteRequestShape.superRefine((data, ctx) => {
  const materials = getScenarioMaterials(data.scenarioId);
  if (!materials) {
    return;
  }
  const validIds = new Set(materials.conditions.map((c) => c.id));
  const foreignIds = data.motion.effectiveConditionIds.filter((id) => !validIds.has(id));
  if (foreignIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motion', 'effectiveConditionIds'],
      message: `'${data.scenarioId}' 안건에 속하지 않는 조건 ID입니다: ${foreignIds.join(', ')}`,
    });
  }
});
export type VoteRequest = z.infer<typeof voteRequestShape>;

export interface Ballot {
  vote: VoteResponse['vote'];
  reason: string;
  evidenceIds: string[];
  remainingConcerns: string[];
  motionId: string;
  motionHash: string;
  /** 'rules'면 live 표가 방향 지시와 달라 규칙표 표로 바꿨다는 뜻이다(T138). */
  source?: 'rules';
  rulesCause?: 'direction';
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


function buildVoteSystemPrompt(
  roleId: ExecRoleId,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  input: VoteRequest,
  reminderVote?: 'YES' | 'NO',
): string {
  const rolePrompt = ROLE_PROMPT_BUILDERS[roleId](materials, 'VOTE');
  // T137: 반대 근거는 안건을 수정하지 않으므로 "적용 조건"이 아니라 "참가자가 든 반대 근거"로 따로 싣는다.
  const labels = splitConditionLabels(materials, input.motion.effectiveConditionIds);
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
      effectiveConditionLabels: labels.conditions,
      executionMode: input.motion.executionMode,
    },
    participantStance: input.participantStance ?? null,
    participantObjections: labels.objections,
    followUpAnswered: input.followUpAnswered,
    followUpQuestion: input.followUpQuestion,
    followUpAnswerText: input.followUpAnswerText,
  });
  return [
    buildCommonGuardrails(),
    rolePrompt,
    '지금은 최종 표결 단계입니다. 위 meeting_record의 고정된 안건(motionId/motionHash)에 대해' +
      ' 당신의 최종 판단 한 번만 내리십시오. 다른 임원이나 참가자가 어떻게 표결했는지는 전달되지' +
      ' 않으며, 당신은 그것을 알 수 없다는 전제로 스스로 판단하십시오.',
    '응답 형식 규칙(어기면 응답 전체가 거절되어 표가 인정되지 않습니다): ① motionId·motionHash는' +
      ' meeting_record에 적힌 값을 한 글자도 바꾸지 말고 그대로 복사하십시오. ② reason은 한국어' +
      ' 문장 하나로 공백 포함 160자 이내(길면 줄여 쓰기)이며, 자료 ID(E1 등)·조건 ID(LIMIT 등)·영문' +
      ' 약어를 쓰지 말고 자료·조건의 한국어 이름으로 쓰십시오("AI"와 임원 역할 이름만 예외입니다).',
    ...(materials.roleLenses?.[roleId]?.opening === 'UNDECIDED' && input.participantStance !== undefined
      ? [VOTE_UNDECIDED_START_RULE]
      : []),
    ...(() => {
      // T137(v20): 반대 참가자 경로는 규칙표로 이 임원의 표 방향을 계산해 지시한다(T132 첫 반응과 같은 방식).
      const rule = buildVoteDirectionRule(
        ruleVoteDirection({
          scenarioId: input.scenarioId,
          roleId,
          participantStance: input.participantStance,
          effectiveConditionIds: input.motion.effectiveConditionIds,
          followUpAnswered: input.followUpAnswered,
        }),
      );
      return rule ? [rule] : [];
    })(),
    ...(reminderVote ? [buildVoteDirectionReminder(reminderVote)] : []),
    ...(input.followUpAnswered === false ? [VOTE_UNANSWERED_RULE] : []),
    ...(input.followUpAnswered !== false && input.followUpAnswerText !== undefined ? [ANSWER_JUDGMENT_RULE] : []),
    meetingRecord,
  ].join('\n\n');
}

/** callRoleVote 내부에서만 쓰는 시도 1회 결과 — 로그 전용 providerErrorClass·httpStatus·
 * latencyMs·캐시 토큰 수까지 담아 둔다(T91, 재시도 판단과 최종 로그 한 줄에 쓴다). */
interface VoteAttemptResult extends VoteRoleResult {
  providerErrorClass?: ProviderErrorClass;
  httpStatus?: number;
  latencyMs: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** invalid_response일 때 원인 코드(T136, 로그 전용). */
  invalidIssues?: string[];
}

/** 제공자 호출 1회(파싱 포함). 로그를 남기지 않는다 — callRoleVote가 재시도 여부를 정한
 * 뒤 최종 결과만 한 줄로 남긴다(T91). */
async function attemptRoleVote(
  roleId: ExecRoleId,
  input: VoteRequest,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
  reminderVote?: 'YES' | 'NO',
): Promise<VoteAttemptResult> {
  const start = clock.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const system = buildVoteSystemPrompt(roleId, materials, input, reminderVote);
    const user = JSON.stringify({
      kind: 'vote',
      roleId,
      motionId: input.motion.id,
      motionHash: input.motion.hash,
      // PR #13 Codex 2차 검토 후속: mock 제공자가 역할별 인용 자료도 안건에 맞게 고르려면
      // scenarioId가 envelope에 있어야 한다(server/providers/mock.ts 참고).
      scenarioId: input.scenarioId,
      followUpAnswered: input.followUpAnswered,
      participantStance: input.participantStance,
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
      return {
        roleId,
        status: 'failed',
        failReason: 'invalid_response',
        providerErrorClass: 'invalid_response',
        invalidIssues: !parsed.success
          ? summarizeInvalidIssues(parsed.error, result.json, ['reason'])
          : ['roleId:mismatch'],
        latencyMs,
        modelId: result.modelId,
        // 응답까지는 받았으므로 캐시 토큰은 실제로 쓰였다 — 재시도 합산에 넣는다(Codex 36차 P2).
        cacheReadTokens: result.usage?.cacheReadInputTokens,
        cacheWriteTokens: result.usage?.cacheCreationInputTokens,
        promptVersion: PROMPT_VERSION,
      };
    }
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
      latencyMs,
      modelId: result.modelId,
      promptVersion: PROMPT_VERSION,
      cacheReadTokens: result.usage?.cacheReadInputTokens,
      cacheWriteTokens: result.usage?.cacheCreationInputTokens,
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

/** 임원 한 명에게 표결을 요청하고, 빠르게(timeout 외 이유로) 실패했는데 남은 예산이
 * 충분하면(MIN_RETRY_REMAINING_MS 이상) 같은 요청을 1회만 더 보낸다(T91). 최종 결과
 * 한 줄만 attempts 필드(1 또는 2)와 함께 로그에 남긴다. */
async function callRoleVote(
  roleId: ExecRoleId,
  input: VoteRequest,
  materials: NonNullable<ReturnType<typeof getScenarioMaterials>>,
  timeoutMs: number,
  provider: ModelProvider,
  clock: Clock,
): Promise<VoteRoleResult> {
  const overallStart = clock.now();
  let attempts = 1;
  let outcome = await attemptRoleVote(roleId, input, materials, timeoutMs, provider, clock);
  if (outcome.status === 'failed' && isRetryableFailure(outcome.failReason, outcome.providerErrorClass)) {
    // 재시도까지 포함한 전체 시간은 서버 상한(timeoutMs)을 넘지 않는다 — input.budgetMs는
    // 클라이언트가 보낸 값이라 서버 상한보다 클 수 있다(PR #20 Codex 17차 검토 P2).
    const remainingMs = timeoutMs - (clock.now() - overallStart);
    if (remainingMs >= MIN_RETRY_REMAINING_MS) {
      attempts = 2;
      const first = outcome;
      const second = await attemptRoleVote(roleId, input, materials, Math.min(timeoutMs, remainingMs), provider, clock);
      // 캐시 토큰은 두 시도를 합산한다(PR #20 Codex 36차 검토 P2).
      outcome = {
        ...second,
        cacheReadTokens: sumTokens(first.cacheReadTokens, second.cacheReadTokens),
        cacheWriteTokens: sumTokens(first.cacheWriteTokens, second.cacheWriteTokens),
        invalidIssues: mergeInvalidIssues(first.invalidIssues, second.invalidIssues),
      };
    }
  }
  // T138: 반대 참가자 경로에서 live 표가 규칙표 방향과 다르면 방향을 다시 알려 한 번 더 요청하고, 그래도 다르면 규칙표
  // 표(규칙표 이유, source 'rules')로 기록한다. 규칙표와 live가 갈라지면 같은 선택이 다른 결과를 내 체험의 설득 규칙이
  // 깨지기 때문이다. 첫 응답이 틀렸는데 재요청이 실패해도 첫 응답을 교정한다.
  let clamped = false;
  const directionInput = {
    scenarioId: input.scenarioId,
    roleId,
    participantStance: input.participantStance,
    effectiveConditionIds: input.motion.effectiveConditionIds,
    followUpAnswered: input.followUpAnswered,
  };
  const expected = ruleVoteBallot(directionInput);
  if (expected) {
    const wrongFirst = outcome.status === 'answered' && outcome.ballot !== undefined && outcome.ballot.vote !== expected.vote;
    if (wrongFirst) {
      const remainingMs = timeoutMs - (clock.now() - overallStart);
      if (remainingMs >= MIN_RETRY_REMAINING_MS) {
        attempts += 1;
        const again = await attemptRoleVote(roleId, input, materials, Math.min(timeoutMs, remainingMs), provider, clock, expected.vote);
        // 방향 재요청 결과가 성공이든 실패든 캐시 토큰과 형식 오류 원인은 로그에 합산한다(Codex P2). 표는 재요청이 맞게 왔을 때만 바꾼다.
        const merged = {
          cacheReadTokens: sumTokens(outcome.cacheReadTokens, again.cacheReadTokens),
          cacheWriteTokens: sumTokens(outcome.cacheWriteTokens, again.cacheWriteTokens),
          invalidIssues: mergeInvalidIssues(outcome.invalidIssues, again.invalidIssues),
        };
        outcome =
          again.status === 'answered' && again.ballot
            ? { ...again, ...merged }
            : { ...outcome, ...merged };
      }
      if (outcome.ballot && outcome.ballot.vote !== expected.vote) {
        outcome = {
          ...outcome,
          status: 'answered',
          failReason: undefined,
          ballot: {
            ...outcome.ballot,
            vote: expected.vote,
            reason: expected.reason,
            evidenceIds: [],
            remainingConcerns: [],
            source: 'rules',
            rulesCause: 'direction',
          },
        };
        clamped = true;
      }
    }
  }
  const latencyMs = clock.now() - overallStart;
  logCall({
    ts: new Date(clock.now()).toISOString(),
    kind: 'vote',
    sessionId: input.sessionId,
    stage: 'VOTE',
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
    // 재시도로 결국 성공했어도 첫 시도의 형식 오류 원인은 남긴다 — 재시도가 왜 필요했는지가 원인 분석에 가장 쓸모 있다(PR #22 Codex P2).
    invalidIssues: outcome.invalidIssues,
    note: clamped ? 'vote_direction_clamped' : undefined,
  });
  return {
    roleId,
    status: outcome.status,
    ballot: outcome.ballot,
    failReason: outcome.failReason,
    modelId: outcome.modelId,
    promptVersion: PROMPT_VERSION,
  };
}

/** 임원(기본 4명, roleIds가 있으면 그 역할만)에게 최종 표를 병렬로 요청한다(역할당 최대
 * 2회 — timeout 외 이유로 빠르게 실패하고 예산이 남아 있으면 callRoleVote가 1회 재시도한다,
 * T91). 참가자 표·다른 임원 표는 입력에도 프롬프트에도 포함하지 않는다. roleIds는 미표결
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
