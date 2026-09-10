// 비서실장 핸들러: '내 발언 정리'(refine)와 '의견 한눈에 보기'(summarize)를 한 번씩
// 모델에 요청한다(round.ts·vote.ts와 달리 임원 4명이 아니라 단일 호출). AGENT_BOARDROOM_SPEC.md
// 4·5·6장. 두 기능 모두 같은 응답 계약(validate.ts의 assistantResponseSchema: draftRevision·
// draftText·evidenceIds·suggestedConditionIds)을 쓴다 — refine은 draftText를 "정리된 발언"으로,
// summarize는 "실제 회의 기록 기반 요약문"으로 쓸 뿐 필드 모양은 같다.

import { z } from 'zod';
import { CONDITION_IDS, EVIDENCE_IDS, EXEC_ROLE_IDS, assistantResponseSchema } from '../validate';
import type { ModelProvider } from '../providers/types';
import { parseMockFault } from '../providers/mock';
import { getScenarioMaterials } from '../scenario-data';
import { buildMeetingRecordBlock } from '../prompts/common';
import { buildRefineSystemPrompt, buildSummarizeSystemPrompt } from '../prompts/assistant';
import { PROMPT_VERSION } from '../prompts/version';
import { withTimeout } from './timeout';
import { mapFailReason } from './shared';

const transcriptStatementSchema = z.object({
  id: z.string().min(1),
  roleId: z.enum(EXEC_ROLE_IDS),
  message: z.string().min(1),
});

/** '내 발언 정리' 요청 본문. transcript는 필요 없다 — 정리 대상은 draftText 자체다. */
export const refineRequestSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  mode: z.enum(['live', 'scripted']),
  scenarioId: z.string().min(1),
  budgetMs: z.number().int().positive(),
  draftText: z.string().min(1).max(2000),
  /** 참가자가 draftText를 바꿀 때마다 늘어나는 값. 응답의 draftRevision이 이 값과 같아야
   * 참가자가 최신 결과로 받아들인다(클라이언트 services/assistant/live.ts가 폐기 여부를 판단). */
  draftRevision: z.number().int().min(0),
  /** 테스트/개발 전용: mock 장애 주입. 운영 요청에는 없다. */
  mock: z.string().optional(),
});
export type AssistantRefineRequest = z.infer<typeof refineRequestSchema>;

/** '의견 한눈에 보기'(live) 요청 본문. 실제 회의 기록만 근거로 삼는다. */
export const summarizeRequestSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  mode: z.enum(['live', 'scripted']),
  scenarioId: z.string().min(1),
  budgetMs: z.number().int().positive(),
  transcript: z.object({
    revision: z.number().int().min(0),
    statements: z.array(transcriptStatementSchema),
  }),
  mock: z.string().optional(),
});
export type AssistantSummarizeRequest = z.infer<typeof summarizeRequestSchema>;

export interface AssistantResult {
  status: 'answered' | 'failed';
  draftText?: string;
  evidenceIds?: string[];
  suggestedConditionIds?: string[];
  failReason?: string;
  modelId: string;
  promptVersion: string;
}

export interface AssistantHandlerDeps {
  provider: ModelProvider;
}

function assistantJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['draftRevision', 'draftText', 'evidenceIds', 'suggestedConditionIds'],
    properties: {
      draftRevision: { type: 'number' },
      draftText: { type: 'string', minLength: 1, maxLength: 300 },
      evidenceIds: { type: 'array', items: { type: 'string', enum: [...EVIDENCE_IDS] } },
      suggestedConditionIds: { type: 'array', items: { type: 'string', enum: [...CONDITION_IDS] } },
    },
  };
}

/** refine·summarize 공통 호출부: 시스템 프롬프트와 draftRevision(응답이 그대로 돌려줘야 할
 * 값)만 받아 provider를 한 번 부르고 assistantResponseSchema로 검증한다. */
async function callAssistant(
  kind: 'assistant_refine' | 'assistant_summarize',
  system: string,
  draftRevision: number,
  timeoutMs: number,
  provider: ModelProvider,
  mockFault: string | undefined,
): Promise<AssistantResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const user = JSON.stringify({ kind, draftRevision, mock: parseMockFault(mockFault) });
    const raw = provider.complete({
      system,
      user,
      schema: assistantJsonSchema(),
      maxTokens: 400,
      timeoutMs,
      signal: controller.signal,
    });
    const result = await withTimeout(raw, timeoutMs);
    const parsed = assistantResponseSchema({ draftRevision }).safeParse(result.json);
    if (!parsed.success) {
      return {
        status: 'failed',
        failReason: 'invalid_response',
        modelId: result.modelId,
        promptVersion: PROMPT_VERSION,
      };
    }
    return {
      status: 'answered',
      draftText: parsed.data.draftText,
      evidenceIds: parsed.data.evidenceIds,
      suggestedConditionIds: parsed.data.suggestedConditionIds,
      modelId: result.modelId,
      promptVersion: PROMPT_VERSION,
    };
  } catch (err) {
    return {
      status: 'failed',
      failReason: mapFailReason(err),
      modelId: '',
      promptVersion: PROMPT_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** '내 발언 정리'. 참가자 원문(draftText)을 meeting_record의 참가자 발언 원문으로 실어
 * 보낸다 — 지금까지의 임원 발언은 이 기능의 입력이 아니다(카드 범위: draftText·자료·허용
 * 조건). 알 수 없는 scenarioId는 예외를 던진다(호출자가 400으로 변환). */
export async function handleAssistantRefine(
  input: AssistantRefineRequest,
  deps: AssistantHandlerDeps,
): Promise<AssistantResult> {
  const materials = getScenarioMaterials(input.scenarioId);
  if (!materials) {
    throw new Error(`unknown_scenario:${input.scenarioId}`);
  }
  const timeoutMs = Math.min(5000, input.budgetMs);
  const meetingRecord = buildMeetingRecordBlock({
    scenarioId: materials.scenarioId,
    originalMotionText: materials.originalMotionText,
    evidence: materials.evidence,
    conditions: materials.conditions,
    stage: 'ASSISTANT',
    transcriptRevision: input.draftRevision,
    statements: [],
    participantOpinion: input.draftText,
  });
  const system = buildRefineSystemPrompt(meetingRecord);
  return callAssistant('assistant_refine', system, input.draftRevision, timeoutMs, deps.provider, input.mock);
}

/** '의견 한눈에 보기'(live). 실제 회의 기록(transcript)만 근거로 삼고, 사전에 쓰인 임원
 * 요약을 붙이지 않는다. */
export async function handleAssistantSummarize(
  input: AssistantSummarizeRequest,
  deps: AssistantHandlerDeps,
): Promise<AssistantResult> {
  const materials = getScenarioMaterials(input.scenarioId);
  if (!materials) {
    throw new Error(`unknown_scenario:${input.scenarioId}`);
  }
  const timeoutMs = Math.min(5000, input.budgetMs);
  const meetingRecord = buildMeetingRecordBlock({
    scenarioId: materials.scenarioId,
    originalMotionText: materials.originalMotionText,
    evidence: materials.evidence,
    conditions: materials.conditions,
    stage: 'ASSISTANT',
    transcriptRevision: input.transcript.revision,
    statements: input.transcript.statements,
  });
  const system = buildSummarizeSystemPrompt(meetingRecord);
  return callAssistant(
    'assistant_summarize',
    system,
    input.transcript.revision,
    timeoutMs,
    deps.provider,
    input.mock,
  );
}
