// 요청/응답 검증. AGENT_BOARDROOM_SPEC.md 5장: 역할·세션·revision·안건 일치, 허용
// enum/ID, 길이, 중복 응답, 알 수 없는 근거·조건 ID를 서버가 거절한다.
// 시나리오 데이터(src/content/scenarios/aiAssistant.ts)의 ID 목록만 그대로 옮겨 쓴다.
// server는 src/에 의존하지 않고 이 파일 안에서 알려진 ID를 고정한다.

import { z } from 'zod';

export const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
export type ExecRoleId = (typeof EXEC_ROLE_IDS)[number];

export const REQUEST_ROLE_IDS = [...EXEC_ROLE_IDS, 'PARTICIPANT'] as const;

/** 현재 시나리오(ai-assistant)의 근거 카드 ID. */
export const EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4'] as const;

/** 현재 시나리오(ai-assistant)의 조건 ID. */
export const CONDITION_IDS = ['PILOT', 'REVIEW', 'ACCESS', 'MEASURE', 'OPEN_ALL'] as const;

export const STATEMENT_STAGES = ['OPINIONS', 'REACTIONS', 'FOLLOWUP'] as const;
export const REQUEST_STAGES = [...STATEMENT_STAGES, 'VOTE', 'ASSISTANT'] as const;

export const VOTE_VALUES = ['YES', 'HOLD', 'NO'] as const;

const evidenceIdSchema = z.enum(EVIDENCE_IDS);
const conditionIdSchema = z.enum(CONDITION_IDS);

/** 모든 엔드포인트 요청 본문에 공통으로 들어가는 메타 필드. */
export const requestMetaSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  roleId: z.enum(REQUEST_ROLE_IDS),
  mode: z.enum(['live', 'scripted']),
  stage: z.enum(REQUEST_STAGES),
  transcriptRevision: z.number().int().min(0),
});
export type RequestMeta = z.infer<typeof requestMetaSchema>;

/** 발언(토론) 응답. ballot 관련 필드는 스키마에 없으므로 .strict()가 자동으로 거절한다. */
export function statementResponseSchema(knownStatementIds: readonly string[] = []) {
  const knownIdSet = new Set(knownStatementIds);
  return z
    .object({
      roleId: z.enum(EXEC_ROLE_IDS),
      message: z.string().min(1).max(120),
      evidenceIds: z.array(evidenceIdSchema),
      referencedStatementIds: z
        .array(z.string())
        .refine((ids) => ids.every((id) => knownIdSet.has(id)), {
          message: '알 수 없는 발언 ID가 포함되어 있습니다.',
        }),
      concerns: z.array(z.string()),
      suggestedConditionIds: z.array(conditionIdSchema),
    })
    .strict();
}
export type StatementResponse = z.infer<ReturnType<typeof statementResponseSchema>>;

/** 최종 표결 응답. motionId·motionHash가 현재 고정된 안건과 일치해야 한다. */
export function voteResponseSchema(opts: { motionId: string; motionHash: string }) {
  return z
    .object({
      roleId: z.enum(EXEC_ROLE_IDS),
      motionId: z.literal(opts.motionId),
      motionHash: z.literal(opts.motionHash),
      vote: z.enum(VOTE_VALUES),
      reason: z.string().min(1).max(160),
      evidenceIds: z.array(evidenceIdSchema),
      remainingConcerns: z.array(z.string()),
    })
    .strict();
}
export type VoteResponse = z.infer<ReturnType<typeof voteResponseSchema>>;

/** 비서실장(내 발언 정리) 응답. draftRevision이 요청 시점 revision과 같아야 한다. */
export function assistantResponseSchema(opts: { draftRevision: number }) {
  return z
    .object({
      draftRevision: z.literal(opts.draftRevision),
      draftText: z.string().min(1).max(300),
      evidenceIds: z.array(evidenceIdSchema),
      suggestedConditionIds: z.array(conditionIdSchema),
    })
    .strict();
}
export type AssistantResponse = z.infer<ReturnType<typeof assistantResponseSchema>>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; status: 400; error: string };

/** zod 결과를 서버가 바로 응답으로 쓸 수 있는 형태로 바꾼다. */
export function toValidationResult<T>(parsed: z.ZodSafeParseResult<T>): ValidationResult<T> {
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    status: 400,
    error: parsed.error.issues.map((issue: { message: string }) => issue.message).join('; '),
  };
}

/**
 * 같은 requestId로 온 요청을 다시 받아들이지 않기 위한 메모리 집합.
 * 프로세스 재시작 시 초기화되며, 세션 영속 저장소가 아니다.
 */
export class RequestIdRegistry {
  private readonly seen = new Set<string>();

  has(requestId: string): boolean {
    return this.seen.has(requestId);
  }

  /** 처음 보는 requestId면 등록하고 true, 이미 있었으면 등록하지 않고 false를 반환한다. */
  register(requestId: string): boolean {
    if (this.seen.has(requestId)) {
      return false;
    }
    this.seen.add(requestId);
    return true;
  }
}
