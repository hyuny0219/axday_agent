// 결정적 mock 제공자. 실제 네트워크 호출 없이 역할·단계별 고정 JSON을 돌려주고,
// 장애 주입(timeout|invalid|late|refusal)을 지원한다. 서버(index.ts)는 HTTP 요청의
// x-mock-scenario 헤더나 body.mock 필드를 읽어 MockRequestEnvelope.mock에 실어
// provider.complete(req)의 req.user(JSON 문자열)로 전달한다. 라운드·표·비서 핸들러의
// 실제 프롬프트 구성은 T28·T31에서 채운다 — 이 모듈은 그 전까지도 단독으로 테스트 가능하다.

import type { ModelCompleteRequest, ModelCompleteResult, ModelProvider } from './types';
import { ModelRefusalError } from './types';

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
}

const ROLE_EVIDENCE: Record<string, string> = {
  CEO: 'E1',
  CFO: 'E2',
  CAIO: 'E3',
  CISO: 'E4',
};

const ROLE_CONDITION: Record<string, string> = {
  CEO: 'PILOT',
  CFO: 'MEASURE',
  CAIO: 'REVIEW',
  CISO: 'ACCESS',
};

const ROLE_VOTE: Record<string, 'YES' | 'HOLD' | 'NO'> = {
  CEO: 'YES',
  CFO: 'HOLD',
  CAIO: 'YES',
  CISO: 'NO',
};

function buildStatementJson(env: MockRequestEnvelope): unknown {
  const roleId = env.roleId ?? 'CEO';
  const stage = env.stage ?? 'OPINIONS';
  return {
    roleId,
    message: `[mock] ${roleId}의 ${stage} 단계 발언입니다.`,
    evidenceIds: [ROLE_EVIDENCE[roleId] ?? 'E1'],
    referencedStatementIds: [],
    concerns: [`[mock] ${roleId} 우려사항`],
    suggestedConditionIds: [ROLE_CONDITION[roleId] ?? 'PILOT'],
  };
}

function buildVoteJson(env: MockRequestEnvelope): unknown {
  const roleId = env.roleId ?? 'CEO';
  return {
    roleId,
    motionId: env.motionId ?? 'unknown-motion',
    motionHash: env.motionHash ?? '',
    vote: ROLE_VOTE[roleId] ?? 'HOLD',
    reason: `[mock] ${roleId}의 판단 근거입니다.`,
    evidenceIds: [ROLE_EVIDENCE[roleId] ?? 'E1'],
    remainingConcerns: [],
  };
}

function buildAssistantJson(env: MockRequestEnvelope): unknown {
  return {
    draftRevision: env.draftRevision ?? 0,
    draftText: '[mock] 참가자 발언을 짧게 정리한 문장입니다.',
    evidenceIds: ['E1'],
    suggestedConditionIds: ['PILOT'],
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
export function createMockProvider(modelId = 'mock-model'): ModelProvider {
  return {
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResult> {
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
