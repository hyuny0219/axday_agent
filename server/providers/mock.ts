// 결정적 mock 제공자. 실제 네트워크 호출 없이 역할·단계별 고정 JSON을 돌려주고,
// 장애 주입(timeout|invalid|late|refusal)을 지원한다. 서버(index.ts)는 HTTP 요청의
// x-mock-scenario 헤더나 body.mock 필드를 읽어 MockRequestEnvelope.mock에 실어
// provider.complete(req)의 req.user(JSON 문자열)로 전달한다. 라운드·표·비서 핸들러의
// 실제 프롬프트 구성은 T28·T31에서 채운다 — 이 모듈은 그 전까지도 단독으로 테스트 가능하다.

import type { ModelCompleteRequest, ModelCompleteResult, ModelProvider } from './types';
import { ModelRefusalError } from './types';
import { getScenarioMaterials } from '../scenario-data';
import type { ExecRoleId } from '../validate';

export type MockFault = 'timeout' | 'invalid' | 'late' | 'refusal';

export const MOCK_FAULTS: readonly MockFault[] = ['timeout', 'invalid', 'late', 'refusal'];

/** 헤더/바디에서 넘어온 임의 값을 알려진 장애 종류로만 좁힌다. 모르는 값은 무시한다(주입 없음). */
export function parseMockFault(value: unknown): MockFault | undefined {
  if (typeof value === 'string' && (MOCK_FAULTS as readonly string[]).includes(value)) {
    return value as MockFault;
  }
  return undefined;
}

export type MockRequestKind = 'statement' | 'vote' | 'assistant_refine' | 'assistant_summarize';

/**
 * provider.complete()의 req.user에 JSON.stringify로 실어 보내는 envelope.
 * ModelProvider 인터페이스는 필드가 고정돼 있어(system/user/schema/...) 역할·단계·장애
 * 주입 같은 mock 전용 정보는 user 문자열 안에 담는다.
 */
export interface MockRequestEnvelope {
  kind: MockRequestKind;
  roleId?: string;
  stage?: string;
  motionId?: string;
  motionHash?: string;
  draftRevision?: number;
  mock?: MockFault;
  /** PR #13 Codex 2차 검토 P1: 역할별 조건 ID를 안건에 맞게 고르려면 어느 안건인지
   * 알아야 한다(server/handlers/round.ts·assistant.ts가 envelope에 실어 보낸다). */
  scenarioId?: string;
  /** 참가자가 추가 질문에 답했는지(T110, 프롬프트 v12). 표결 envelope에서 false면 "답하지
   * 않고 넘어감" 규칙을 흉내 낸다. */
  followUpAnswered?: boolean;
  /** 참가자 입장(T110 대칭). 생략·FOR는 찬성 쪽 목표, AGAINST는 반대 쪽 목표다. */
  participantStance?: 'FOR' | 'AGAINST';
}

// 이 고정 맵은 scenarioId를 모를 때만 쓰는 폴백이다(아래 scenarioAwareRoleEvidence 참고).
const ROLE_EVIDENCE: Record<string, string> = {
  CEO: 'E1',
  CFO: 'E2',
  CAIO: 'E3',
  CISO: 'E4',
};

const EXEC_ROLE_ORDER = ['CEO', 'CFO', 'CAIO', 'CISO'];

/** PR #13 Codex 2차 검토 후속: 역할별 인용 자료도 scenarioAwareRoleCondition과 같은
 * 원칙으로 안건에 맞춘다 — roleLenses[role].evidenceIds의 첫 자료를 쓴다(그 역할이
 * 그 안건에서 실제로 무겁게 보는 자료, live-eval.ts의 roleLensEvidenceCited 휴리스틱이
 * 보는 바로 그 목록). ai-approval의 CISO 렌즈는 E3인데 옛 고정 맵은 E4를 줘서 live-eval
 * 휴리스틱이 FAIL로 나오던 불일치를 포함해 둘 다 고쳐진다. scenarioId가 없거나
 * 등록되지 않은 안건이면(예: envelope을 손으로 구성하는 일부 단위 테스트) 위 고정
 * 맵으로 되돌아간다. */
function scenarioAwareRoleEvidence(roleId: string, scenarioId: string | undefined): string {
  const materials = scenarioId ? getScenarioMaterials(scenarioId) : undefined;
  const lensEvidenceIds = materials?.roleLenses?.[roleId as ExecRoleId]?.evidenceIds;
  return lensEvidenceIds?.[0] ?? ROLE_EVIDENCE[roleId] ?? 'E1';
}

// T78(2026-10-02, 안건 교체)에서 validate.ts의 CONDITION_IDS가 현재 활성 안건(ai-approval·
// experience-first)의 조건 ID로 바뀌었다. 이 고정 맵은 scenarioId를 모를 때만 쓰는
// 폴백이다(아래 scenarioAwareRoleCondition 참고) — ai-approval의 ID라 그 안건에서는
// 그대로 유효하다.
const ROLE_CONDITION: Record<string, string> = {
  CEO: 'LIMIT',
  CFO: 'OWNER',
  CAIO: 'LOG',
  CISO: 'REVIEW',
};

/** PR #13 Codex 2차 검토 P1: 이전에는 역할마다 고정 조건 ID(LIMIT 등)를 돌려줘
 * ai-approval이 아닌 안건(예: experience-first)에서는 매 라운드 셋 중 셋이 유효하지
 * 않은 ID라 invalid_response로 떨어졌다. envelope에 scenarioId가 있으면 그 안건 자신의
 * conditions 목록에서 역할 순서(CEO·CFO·CAIO·CISO)대로 하나씩 골라 항상 유효한 ID를
 * 쓴다. scenarioId가 없거나 등록되지 않은 안건이면(예: 이 모듈을 직접 호출해 envelope을
 * 손으로 구성하는 일부 단위 테스트) 위 고정 맵으로 되돌아간다. */
function scenarioAwareRoleCondition(roleId: string, scenarioId: string | undefined): string {
  const materials = scenarioId ? getScenarioMaterials(scenarioId) : undefined;
  const index = EXEC_ROLE_ORDER.indexOf(roleId);
  const byIndex = materials && index >= 0 ? materials.conditions[index] : undefined;
  return byIndex?.id ?? ROLE_CONDITION[roleId] ?? 'LIMIT';
}

/** 비서실장(assistant)은 역할이 없는 단일 호출이라 안건의 첫 조건을 쓴다 — ai-approval은
 * LIMIT(기존과 동일), experience-first는 SCOPE. */
function scenarioAwareFirstCondition(scenarioId: string | undefined): string {
  const materials = scenarioId ? getScenarioMaterials(scenarioId) : undefined;
  return materials?.conditions[0]?.id ?? 'LIMIT';
}

const ROLE_VOTE: Record<string, 'YES' | 'NO'> = {
  CEO: 'YES',
  CFO: 'NO',
  CAIO: 'YES',
  CISO: 'NO',
};

/** 발언(statement)의 고정 stance(T63). REACTIONS·FOLLOWUP 등 OPINIONS 이후 단계에만
 * 쓴다(아래 scenarioAwareOpeningStance 참고) — ROLE_VOTE와 같은 방향으로 둬 mock
 * 실행에서도 "stance와 최종 표의 일치율"을 관측할 수 있게 한다. */
const ROLE_STANCE: Record<string, 'FOR' | 'AGAINST' | 'UNDECIDED'> = {
  CEO: 'FOR',
  CFO: 'AGAINST',
  CAIO: 'FOR',
  CISO: 'AGAINST',
};

/** PR #13 Codex 3차 검토: OPINIONS 단계의 stance는 안건마다 다른 "첫 반응"
 * (roleLenses[role].opening, client의 src/domain/stance.ts scriptedStances와 같은
 * 원칙)을 써야 한다 — 고정 ROLE_STANCE(CAIO 항상 FOR)만 쓰면 experience-first·
 * ai-approval 문서가 명시한 CAIO "미정"과 어긋난다. envelope에 scenarioId가 있으면
 * 그 안건의 roleLenses를 쓰고, 없거나 등록되지 않은 안건이면 위 고정 맵으로
 * 되돌아간다. REACTIONS·FOLLOWUP은 이 함수를 쓰지 않고 그대로 고정 맵을 쓴다(참가자
 * 발언을 들은 뒤의 반응은 "첫 반응" 개념이 아니다). */
function scenarioAwareOpeningStance(roleId: string, scenarioId: string | undefined): 'FOR' | 'AGAINST' | 'UNDECIDED' {
  const materials = scenarioId ? getScenarioMaterials(scenarioId) : undefined;
  const opening = materials?.roleLenses?.[roleId as ExecRoleId]?.opening;
  return opening ?? ROLE_STANCE[roleId] ?? 'UNDECIDED';
}

// T82: 발언 문장(message)·판단 근거(reason)·정리 문장(draftText)이 서버 응답 검증을 그대로
// 통과해야 하므로(findStrayLatinRun, validate.ts) roleId·"AI" 같은 허용된 예외 밖의 영문을
// 섞지 않는다 — 옛 "[mock]" 표기·단계 영문명(OPINIONS 등)은 라틴 문자 연속이라 그 자체로
// 걸려 e2e(live.spec.ts 등)가 깨졌다.
const STAGE_LABEL_KO: Record<string, string> = {
  OPINIONS: '의견',
  REACTIONS: '반응',
  FOLLOWUP: '후속',
  VOTE: '표결',
};

/** T110(v12): 첫 반응에서 참가자 쪽으로 움직이는 임원은 "고민 중"까지만 간다. mock은 고정 맵이
 * 참가자 목표 쪽(찬성 참가자면 FOR, 반대 참가자면 AGAINST)이면서 그 안건의 출발 성향은 목표가
 * 아닌 임원을 "움직이는 임원"으로 본다(찬성·반대 대칭). 안건을 모르면 고정 맵 그대로다. */
function movedTowardParticipant(
  roleId: string,
  scenarioId: string | undefined,
  participantStance: 'FOR' | 'AGAINST' | undefined,
): boolean {
  const materials = scenarioId ? getScenarioMaterials(scenarioId) : undefined;
  const opening = materials?.roleLenses?.[roleId as ExecRoleId]?.opening;
  const target = participantStance === 'AGAINST' ? 'AGAINST' : 'FOR';
  return ROLE_STANCE[roleId] === target && opening !== undefined && opening !== target;
}

function buildStatementJson(env: MockRequestEnvelope): unknown {
  const roleId = env.roleId ?? 'CEO';
  const stage = env.stage ?? 'OPINIONS';
  return {
    roleId,
    message: `[모의] ${roleId}의 ${STAGE_LABEL_KO[stage] ?? stage} 단계 발언입니다.`,
    evidenceIds: [scenarioAwareRoleEvidence(roleId, env.scenarioId)],
    referencedStatementIds: [],
    concerns: [`[모의] ${roleId} 우려사항`],
    suggestedConditionIds: [scenarioAwareRoleCondition(roleId, env.scenarioId)],
    stance:
      stage === 'OPINIONS'
        ? scenarioAwareOpeningStance(roleId, env.scenarioId)
        : stage === 'REACTIONS' && movedTowardParticipant(roleId, env.scenarioId, env.participantStance)
          ? 'UNDECIDED'
          : ROLE_STANCE[roleId] ?? 'UNDECIDED',
  };
}

function buildVoteJson(env: MockRequestEnvelope): unknown {
  const roleId = env.roleId ?? 'CEO';
  return {
    roleId,
    motionId: env.motionId ?? 'unknown-motion',
    motionHash: env.motionHash ?? '',
    // 답하지 않았다면 움직인 임원은 참가자 목표의 반대편(찬성 참가자면 NO, 반대 참가자면 YES)이다.
    vote:
      env.followUpAnswered === false && movedTowardParticipant(roleId, env.scenarioId, env.participantStance)
        ? env.participantStance === 'AGAINST'
          ? 'YES'
          : 'NO'
        : ROLE_VOTE[roleId] ?? 'NO',
    reason: `[모의] ${roleId}의 판단 근거입니다.`,
    evidenceIds: [scenarioAwareRoleEvidence(roleId, env.scenarioId)],
    remainingConcerns: [],
  };
}

function buildAssistantJson(env: MockRequestEnvelope): unknown {
  return {
    draftRevision: env.draftRevision ?? 0,
    draftText: '[모의] 참가자 발언을 짧게 정리한 문장입니다.',
    evidenceIds: ['E1'],
    suggestedConditionIds: [scenarioAwareFirstCondition(env.scenarioId)],
  };
}

function buildDeterministicJson(env: MockRequestEnvelope): unknown {
  switch (env.kind) {
    case 'statement':
      return buildStatementJson(env);
    case 'vote':
      return buildVoteJson(env);
    case 'assistant_refine':
    case 'assistant_summarize':
      return buildAssistantJson(env);
    default:
      return {};
  }
}

function parseEnvelope(user: string): MockRequestEnvelope {
  try {
    const parsed: unknown = JSON.parse(user);
    if (parsed && typeof parsed === 'object' && typeof (parsed as { kind?: unknown }).kind === 'string') {
      return parsed as MockRequestEnvelope;
    }
  } catch {
    // user가 envelope JSON이 아니면 기본값(statement)으로 취급한다.
  }
  return { kind: 'statement' };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('aborted', 'AbortError'));
        },
        { once: true },
      );
    }
  });
}

/** 항상 결정적으로 응답하는 mock 제공자. 실제 모델 호출을 대신해 테스트·오프라인 개발에 쓴다. */
/** mock 제공자의 고정 modelId. 서버(server/index.ts)와 평가 스크립트가 같은 값을 써서 산출물만
 * 보고도 실제 모델 결과와 구별할 수 있게 한다(PR #10 Codex 30차 검토 P2). */
export const MOCK_MODEL_ID = 'mock-model';

export function createMockProvider(modelId = MOCK_MODEL_ID): ModelProvider {
  return {
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResult> {
      // 운영 메뉴 "모델 연결 확인"(T49, server/handlers/probe.ts)의 고정 호출은 라운드·표·
      // 비서 envelope과 달리 그냥 user:'ok'를 보낸다 — round/vote/assistant 4종 kind
      // 안에는 { ok:true } 계약을 만족하는 분기가 없으므로 여기서 먼저 처리한다.
      if (req.user === 'ok') {
        return { json: { ok: true }, modelId };
      }

      const envelope = parseEnvelope(req.user);
      const fault = envelope.mock;

      if (fault === 'refusal') {
        throw new ModelRefusalError();
      }

      if (fault === 'timeout') {
        // 호출자의 timeoutMs/signal이 만료될 때까지 응답하지 않다가 실패로 끝난다.
        await delay(req.timeoutMs, req.signal);
        throw new Error('mock_timeout');
      }

      if (fault === 'invalid') {
        // 네트워크·형식 검사는 통과하지만 계약(schema)에는 맞지 않는 내용을 돌려준다.
        return { json: { invalid: true, reason: 'mock_invalid' }, modelId };
      }

      if (fault === 'late') {
        // 정상 내용이지만 허용 시간(timeoutMs)을 넘겨서 도착한다.
        await delay(req.timeoutMs + 20);
        return { json: buildDeterministicJson(envelope), modelId };
      }

      return { json: buildDeterministicJson(envelope), modelId };
    },
  };
}
