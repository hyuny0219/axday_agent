// 요청/응답 검증. AGENT_BOARDROOM_SPEC.md 5장: 역할·세션·revision·안건 일치, 허용
// enum/ID, 길이, 중복 응답, 알 수 없는 근거·조건 ID를 서버가 거절한다.
// 시나리오 데이터(src/content/scenarios/aiAssistant.ts)의 ID 목록만 그대로 옮겨 쓴다.
// server는 src/에 의존하지 않고 이 파일 안에서 알려진 ID를 고정한다.

import { z } from 'zod';

export const EXEC_ROLE_IDS = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
export type ExecRoleId = (typeof EXEC_ROLE_IDS)[number];

export const REQUEST_ROLE_IDS = [...EXEC_ROLE_IDS, 'PARTICIPANT'] as const;

/** 현재 활성 안건(ai-approval·experience-first, T78)의 근거 카드 ID. 두 안건 모두
 * E1~E4라 공유된다. */
export const EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4'] as const;

/** 현재 활성 안건(ai-approval·experience-first, T78)의 조건 ID 합집합. 안건마다 다른
 * 조건 집합을 쓰므로 여기서는 두 안건의 ID를 모두 허용만 하고(REVIEW는 양쪽에 모두
 * 있어 한 번만 적는다), 실제로 어떤 조건이 그 안건에 속하는지는
 * src/content/scenarios/*.ts(Condition.id)가 가른다 — 이 enum은 "알 수 없는 ID
 * 거절" 용도일 뿐 안건별 유효성까지 검증하지 않는다. */
export const CONDITION_IDS = [
  'LIMIT',
  'LOG',
  'REVIEW',
  'OWNER',
  'FULL_AUTO',
  'SCOPE',
  'RECORD',
  'DATA_VETO',
  'EXP_ONLY',
] as const;

export const STATEMENT_STAGES = ['OPINIONS', 'REACTIONS', 'FOLLOWUP'] as const;
export const REQUEST_STAGES = [...STATEMENT_STAGES, 'VOTE', 'ASSISTANT'] as const;

export const VOTE_VALUES = ['YES', 'NO'] as const;

/** 발언 끝에 임원이 지금 기울어 있는 쪽(T63, src/domain/stance.ts의 Stance와 값이 같다). */
export const STANCE_VALUES = ['FOR', 'AGAINST', 'UNDECIDED'] as const;

const evidenceIdSchema = z.enum(EVIDENCE_IDS);
const conditionIdSchema = z.enum(CONDITION_IDS);

/**
 * T82: 조건 ID(LOG, OWNER, SCOPE 등)가 전부 라틴 문자 2자 이상의 연속이라, "응답 스키마
 * 필드에만 ID를 쓰라"는 프롬프트 가드레일(prompts/common.ts)을 모델이 어겨도 같은 모양으로
 * 잡힌다 — CONDITION_IDS를 따로 나열하지 않고, 사람이 보는 문장에 남은 라틴 문자 연속
 * 자체를 거절한다(새 조건을 추가해도 자동으로 걸러진다). 예외: "AI" 두 글자(가드레일에서
 * 허용한 유일한 영문 표기), 임원 역할 ID(이름이 없는 가상 인물이 서로를 가리킬 다른
 * 방법이 없다 — live 실측에서 "CISO·CFO 의견에 동의합니다" 같은 쓰임을 확인했다, T82
 * 조사). 숫자·단위(62%, 2.8일)는 라틴 문자가 아니라 원래부터 걸리지 않는다.
 */
const STRAY_LATIN_EXCEPTIONS = new Set<string>(['AI', ...EXEC_ROLE_IDS]);

/** 문장에서 예외가 아닌 라틴 문자 2자 이상 연속을 찾아 처음 걸린 것을 돌려준다(없으면
 * undefined). statementResponseSchema·voteResponseSchema·assistantResponseSchema가 사람이
 * 보는 필드(message·reason·draftText)에 붙여 쓴다. */
export function findStrayLatinRun(text: string): string | undefined {
  // 라틴 2자 이상 연속, 또는 라틴 문자와 숫자·밑줄이 붙은 토큰(자료 ID `E1`, `FULL_AUTO`
  // 같은 내부 식별자 — 영문자만 2자 이상 세면 `E1`이 빠져 "E1 자료에 따르면"이 그대로
  // 노출됐다, PR #20 Codex 3차 검토 P2).
  // 한 글자짜리("A안을 택하겠습니다"·"X 조건")도 금지 대상이다(PR #20 Codex 8차 검토 P2) —
  // 라틴 문자를 하나라도 포함한 영숫자·밑줄 토큰 전부를 보고 예외 목록만 뺀다.
  const matches = text.match(/[A-Za-z0-9_]*[A-Za-z][A-Za-z0-9_]*/g);
  return matches?.find((word) => !STRAY_LATIN_EXCEPTIONS.has(word));
}

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
      stance: z.enum(STANCE_VALUES),
    })
    .strict()
    .superRefine((data, ctx) => {
      const stray = findStrayLatinRun(data.message);
      if (stray) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: `발언에 허용되지 않는 영문 표현이 남아 있습니다: ${stray}`,
        });
      }
    });
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
    .strict()
    .superRefine((data, ctx) => {
      const stray = findStrayLatinRun(data.reason);
      if (stray) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: `판단 근거에 허용되지 않는 영문 표현이 남아 있습니다: ${stray}`,
        });
      }
    });
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
    .strict()
    .superRefine((data, ctx) => {
      const stray = findStrayLatinRun(data.draftText);
      if (stray) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['draftText'],
          message: `정리된 발언에 허용되지 않는 영문 표현이 남아 있습니다: ${stray}`,
        });
      }
    });
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
