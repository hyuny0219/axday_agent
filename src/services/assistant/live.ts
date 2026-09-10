// live AI 비서실장 어댑터(T31, AGENT_BOARDROOM_SPEC.md 4장). /api/assistant/refine·
// /api/assistant/summarize를 호출해 서버가 검증까지 끝낸 응답만 결과로 옮긴다. 실제 판단은
// 서버(handlers/assistant.ts)가 하며 이 파일은 요청 조립·세션당 한도·응답 형태 변환만
// 담당한다(services/boardAgents/live.ts와 같은 원칙).
//
// '내 발언 정리'(refineDraft)는 세션당 최대 2회, 동시에 1개만 허용한다. 같은 draftRevision으로
// 이미 요청이 진행 중이면 새 요청은 즉시 거절하고("동시 요청 거절"), 참가자가 그사이 draftText를
// 바꿔 draftRevision이 달라졌다면 진행 중이던 이전 요청을 폐기하고 새 요청을 진행한다("입력이
// 바뀌면 이전 초안을 폐기한다"). 세션별 상태는 모듈 전역 Map에 두되, sessionId가 세션마다 새로
// 발급되는 UUID라 항목이 계속 쌓일 수 있다 — 데모 키오스크가 재시작 주기를 가지므로 이 카드
// 범위에서는 정리 로직을 추가하지 않는다.
//
// '의견 한눈에 보기'(summarizeOpinions)는 실제 회의 기록(transcript)을 서버에 보내 자유 형식
// 요약(summaryText)만 받는다 — scripted처럼 임원별 commonPoints/disagreements로 미리 쪼개
// 보여주지 않는다(사전에 쓰인 임원 요약을 live 결과에 붙이지 않기 위해서다).
//
// '조건 비교하기'(compareConditions)는 실제 AI를 부르지 않는다(정규화된 원안/제안 차이는
// 프로그램이 표시하면 된다 — 4장). scripted.ts의 buildCompare를 그대로 재사용하고 mode도
// 항상 'scripted'로 둔다("실제 AI 사용"이라고 과장하지 않기 위해서다).

import { accessHeaders } from '../transport/accessToken';
import { buildCompare } from './scripted';
import { AssistantTimeoutError } from './types';
import type {
  AssistantAdapter,
  CompareConditionsRequest,
  CompareConditionsResult,
  RefineDraftRequest,
  RefineDraftResult,
  SummarizeOpinionsRequest,
  SummarizeOpinionsResult,
} from './types';

/** 서버 요청 하나가 기다리는 최대 시간(AGENT_BOARDROOM_SPEC.md 4장 "요청당 5초"). */
export const ASSISTANT_LIVE_TIMEOUT_MS = 5000;
/** '내 발언 정리'가 세션당 허용하는 최대 요청 횟수. */
export const REFINE_MAX_REQUESTS_PER_SESSION = 2;

/** 요청 횟수 상한(세션당 2회)을 넘겼을 때 던진다. */
export class AssistantRefineLimitError extends Error {
  constructor(message = '내 발언 정리 요청 횟수를 모두 사용했습니다.') {
    super(message);
    this.name = 'AssistantRefineLimitError';
  }
}

/** 같은 draftRevision으로 이미 요청이 진행 중일 때 새 요청을 거절하며 던진다. */
export class AssistantRefineConcurrentError extends Error {
  constructor(message = '내 발언 정리 요청이 이미 진행 중입니다.') {
    super(message);
    this.name = 'AssistantRefineConcurrentError';
  }
}

interface RefineSessionState {
  requestCount: number;
  inFlight: { draftRevision: number; generation: number } | null;
  generation: number;
}

const refineSessions = new Map<string, RefineSessionState>();

function getRefineState(sessionId: string): RefineSessionState {
  let state = refineSessions.get(sessionId);
  if (!state) {
    state = { requestCount: 0, inFlight: null, generation: 0 };
    refineSessions.set(sessionId, state);
  }
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** ctx.signal(외부 abort)과 자체 timeoutMs 중 먼저 일어나는 쪽으로 fetch를 취소한다.
 * services/boardAgents/live.ts의 postBoardRequest와 같은 패턴이다. */
async function postAssistantRequest(
  path: string,
  body: unknown,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal.aborted) {
    controller.abort();
  } else {
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessHeaders() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`assistant_request_failed:${res.status}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onExternalAbort);
  }
}

function transcriptPayload(req: { transcript: SummarizeOpinionsRequest['transcript'] }) {
  return {
    revision: req.transcript.revision,
    statements: req.transcript.statements.map((s) => ({ id: s.id, roleId: s.roleId, message: s.text })),
  };
}

async function requestSummarize(req: SummarizeOpinionsRequest): Promise<SummarizeOpinionsResult> {
  const raw = await postAssistantRequest(
    '/api/assistant/summarize',
    {
      sessionId: req.sessionId,
      requestId: req.requestId,
      mode: 'live' as const,
      scenarioId: req.scenario.id,
      budgetMs: ASSISTANT_LIVE_TIMEOUT_MS,
      transcript: transcriptPayload(req),
    },
    req.signal,
    ASSISTANT_LIVE_TIMEOUT_MS,
  );
  if (
    isRecord(raw) &&
    raw.status === 'answered' &&
    typeof raw.draftText === 'string' &&
    isStringArray(raw.evidenceIds)
  ) {
    return {
      mode: 'live',
      evidenceIds: raw.evidenceIds,
      commonPoints: [],
      disagreements: [],
      summaryText: raw.draftText,
    };
  }
  throw new AssistantTimeoutError('의견 한눈에 보기 응답을 확인할 수 없습니다.');
}

async function requestRefine(req: RefineDraftRequest): Promise<RefineDraftResult> {
  const state = getRefineState(req.sessionId);
  if (state.requestCount >= REFINE_MAX_REQUESTS_PER_SESSION) {
    throw new AssistantRefineLimitError();
  }
  if (state.inFlight) {
    if (state.inFlight.draftRevision === req.draftRevision) {
      throw new AssistantRefineConcurrentError();
    }
    // 참가자가 그사이 draftText를 바꿔 revision이 달라졌다 — 이전 요청은 폐기 대상이다.
    // fetch 자체를 취소할 참조는 없지만, generation을 올려 그 요청이 나중에 도착해도
    // 무시하도록 만든다(아래 generation 비교).
    state.generation += 1;
  }
  const generation = state.generation;
  state.requestCount += 1;
  state.inFlight = { draftRevision: req.draftRevision, generation };
  try {
    const raw = await postAssistantRequest(
      '/api/assistant/refine',
      {
        sessionId: req.sessionId,
        requestId: req.requestId,
        mode: 'live' as const,
        scenarioId: req.scenario.id,
        budgetMs: ASSISTANT_LIVE_TIMEOUT_MS,
        draftText: req.draftText,
        draftRevision: req.draftRevision,
      },
      req.signal,
      ASSISTANT_LIVE_TIMEOUT_MS,
    );
    if (getRefineState(req.sessionId).generation !== generation) {
      // 응답이 도착하기 전에 새 revision 요청이 시작되어 이 초안은 폐기됐다.
      throw new AssistantTimeoutError('입력이 바뀌어 이전 초안을 폐기했습니다.');
    }
    if (
      isRecord(raw) &&
      raw.status === 'answered' &&
      typeof raw.draftText === 'string' &&
      isStringArray(raw.evidenceIds) &&
      isStringArray(raw.suggestedConditionIds)
    ) {
      return {
        mode: 'live',
        evidenceIds: raw.evidenceIds,
        suggestedConditionIds: raw.suggestedConditionIds,
        draftText: raw.draftText,
      };
    }
    throw new AssistantTimeoutError('내 발언 정리 응답을 확인할 수 없습니다.');
  } finally {
    const current = getRefineState(req.sessionId);
    if (current.inFlight?.generation === generation) {
      current.inFlight = null;
    }
  }
}

/** live 비서실장 어댑터를 만든다. fetch만 사용하고 CDN·외부 SDK는 부르지 않는다. */
export function createLiveAssistantAdapter(): AssistantAdapter {
  return {
    summarizeOpinions(req) {
      return requestSummarize(req);
    },
    compareConditions(req: CompareConditionsRequest): Promise<CompareConditionsResult> {
      return Promise.resolve(buildCompare(req.scenario, req.selectedConditionIds));
    },
    refineDraft(req) {
      return requestRefine(req);
    },
  };
}

export const liveAssistantAdapter: AssistantAdapter = createLiveAssistantAdapter();
