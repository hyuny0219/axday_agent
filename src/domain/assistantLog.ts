// AI 비서실장 사용 기록의 형태와, 세션 리듀서(session.ts)의 단순 문자열 레이블
// (assistantActions: string[], RECORD_ASSISTANT_ACTION)과 ResultScreen에 보여줄
// 한국어 문구 사이를 잇는 순수 함수. 규칙은 여기(도메인)에 두고 컴포넌트는 호출만
// 한다(CLAUDE_IMPLEMENTATION.md 5장 "정상 완주 결과의 'AI가 도운 일'").
//
// T31: session.assistantActions는 여전히 string[]이지만(도메인 타입 변경 없이), 이제
// AssistantAction을 JSON으로 인코딩한 문자열을 담아 mode·evidenceIds·applied까지 세션에
// 실제로 남긴다(T12 nit "evidenceIds·mode 기록이 아직 세션에 연결되지 않음" 해소). JSON이
// 아닌 평문 레이블은 decodeAssistantLogEntry가 조용히 무시한다. BRIEFING 자동 정리 카드의
// 'SUMMARY_SHOWN' 기록은 카드가 T52에서 제거되면서 함께 없앴다(PR #10 Codex 27차 검토 P2 —
// 보이지 않는 카드를 표시된 것으로 기록했다).

import type { AssistantMode } from '../services/assistant/types';

export type { AssistantMode } from '../services/assistant/types';

export type AssistantActionType =
  | 'OPINION_SUMMARY'
  | 'CONDITION_COMPARE'
  | 'DRAFT_REFINE'
  // T96(2026-10-08 사용자 지시 "AI 비서실장을 잘 쓰면 안건의 여러 측면에 맞는 조건을
  // 고르는 데 큰 도움이 된다고 느끼게"): "조건 추천"을 열어 확인할 때마다
  // CONDITION_RECOMMEND_VIEW 한 건, 추천 조건을 눌러 실제로 체크에 반영할 때마다
  // CONDITION_RECOMMEND_APPLY 한 건(evidenceIds에 반영한 조건 id 하나를 담는다 — 이
  // 필드는 이름과 달리 "조건 id를 담는 범용 문자열 칸"으로 재사용한다, 아래 count
  // 집계용). 기존 세 유형과 달리 "마지막 1건만"이 아니라 "몇 번·몇 개"로 모은다
  // (describeAdditionalHelp의 countConditionRecommendation 참고).
  | 'CONDITION_RECOMMEND_VIEW'
  | 'CONDITION_RECOMMEND_APPLY';

/** AssistantPanel이 실제로 결과를 렌더했을 때만 만드는 기록 한 건. requestedAt은
 * 참가자가 요청해 받은 결과(요약·비교·정리)의 시각이다. */
export interface AssistantAction {
  type: AssistantActionType;
  mode: AssistantMode;
  evidenceIds: string[];
  requestedAt?: number;
  /** '내 발언 정리'는 '내 발언에 적용'을 눌렀을 때만 true다. */
  applied?: boolean;
  /** T97: 결과를 못 받고(실패·연결 지연) 안내 문구만 본 경우 true다. "써 봤다"로는
   * 세지만(assistantFeaturesUsed) 결과 화면 'AI가 도운 일'에는 나오지 않는다. */
  failed?: boolean;
}

/** AssistantPanel이 결과를 실제로 렌더·적용했을 때 넘기는 입력. requestedAt은 세션
 * reducer가 주입된 Clock(now)으로 채운다 — 컴포넌트가 자체 시계를 만들지 않는다. */
export type AssistantActionEvent = Pick<AssistantAction, 'type' | 'mode' | 'evidenceIds'> & {
  applied?: boolean;
  failed?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const KNOWN_ACTION_TYPES: readonly AssistantActionType[] = [
  'OPINION_SUMMARY',
  'CONDITION_COMPARE',
  'DRAFT_REFINE',
  'CONDITION_RECOMMEND_VIEW',
  'CONDITION_RECOMMEND_APPLY',
];

/** AssistantActionEvent + requestedAt을 session.assistantActions(string[])에 그대로
 * 넣을 수 있는 JSON 문자열로 굳힌다. */
export function encodeAssistantLogEntry(event: AssistantActionEvent, requestedAt: number): string {
  const entry: AssistantAction = {
    type: event.type,
    mode: event.mode,
    evidenceIds: event.evidenceIds,
    requestedAt,
    applied: event.applied ?? false,
    ...(event.failed ? { failed: true } : {}),
  };
  return JSON.stringify(entry);
}

/** encodeAssistantLogEntry가 만든 문자열만 AssistantAction으로 되돌린다. 과거 세션의
 * 'SUMMARY_SHOWN' 같은 JSON이 아닌 평문 레이블은 null을 돌려주어 호출부가 조용히
 * 건너뛰게 한다(다른 레이블을 실제 도움으로 오해하지 않도록). */
export function decodeAssistantLogEntry(label: string): AssistantAction | null {
  try {
    const parsed: unknown = JSON.parse(label);
    if (
      isRecord(parsed) &&
      typeof parsed.type === 'string' &&
      KNOWN_ACTION_TYPES.includes(parsed.type as AssistantActionType) &&
      (parsed.mode === 'live' || parsed.mode === 'scripted') &&
      isStringArray(parsed.evidenceIds)
    ) {
      return {
        type: parsed.type as AssistantActionType,
        mode: parsed.mode,
        evidenceIds: parsed.evidenceIds,
        requestedAt: typeof parsed.requestedAt === 'number' ? parsed.requestedAt : undefined,
        applied: typeof parsed.applied === 'boolean' ? parsed.applied : undefined,
        ...(parsed.failed === true ? { failed: true } : {}),
      };
    }
  } catch {
    // JSON이 아닌 평문 레이블(예: 'SUMMARY_SHOWN')은 구조화된 기록이 아니다.
  }
  return null;
}

/** 디코딩된 AssistantAction 한 건을 RESULT 'AI가 도운 일' 한 줄로 바꾼다. scripted는
 * 절대 "실제 AI 사용"이라 말하지 않는다(AGENT_BOARDROOM_SPEC.md 4장) — live일 때만
 * "(실제 AI 호출)"을 문장 끝에 덧붙인다. */
function describeEntry(entry: AssistantAction): string | null {
  if (entry.failed) {
    return null;
  }
  const base = (() => {
    switch (entry.type) {
      case 'OPINION_SUMMARY':
        return '의견 한눈에 보기를 확인했습니다.';
      case 'CONDITION_COMPARE':
        return '조건 비교하기를 확인했습니다.';
      case 'DRAFT_REFINE':
        return entry.applied ? '내 발언 정리를 내 발언에 적용했습니다.' : null;
      default:
        return null;
    }
  })();
  if (!base) {
    return null;
  }
  return entry.mode === 'live' ? `${base} (실제 AI 호출)` : base;
}

/**
 * session.assistantActions(문자열 배열)에서 참가자가 실제로 사용한 도움만 한국어
 * 문장으로 바꾼다. 같은 유형(type)이 여러 번 있어도 한 줄만
 * 보여주되, 나중 기록이 applied:true면 먼저 있던 applied:false 기록 대신 그 줄을 쓴다
 * (미적용 요청 뒤에 실제로 적용한 경우 "미적용" 대신 "적용"으로 보여준다).
 * 디코딩할 수 없는 레이블(구조화되지 않은 값)은 조용히 무시해 실제로 없었던 도움을
 * 과장해 보여주지 않는다.
 */
/** T96 "조건 추천" 전용 집계 — 기존 세 유형("마지막 1건만 보여준다")과 달리 "몇 번
 * 열어 봤는지"·"조건을 몇 개 반영했는지"를 센다. appliedConditionIds는 evidenceIds[0]에
 * 담긴 조건 id를 중복 없이 모은다(같은 조건을 두 번 눌러도 1개로 센다). */
function countConditionRecommendation(actionLabels: readonly string[]): {
  viewCount: number;
  appliedConditionIds: string[];
} {
  let viewCount = 0;
  const appliedConditionIds: string[] = [];
  for (const label of actionLabels) {
    const entry = decodeAssistantLogEntry(label);
    if (!entry) {
      continue;
    }
    if (entry.failed) {
      continue;
    }
    if (entry.type === 'CONDITION_RECOMMEND_VIEW') {
      viewCount += 1;
    } else if (entry.type === 'CONDITION_RECOMMEND_APPLY') {
      const conditionId = entry.evidenceIds[0];
      if (conditionId && !appliedConditionIds.includes(conditionId)) {
        appliedConditionIds.push(conditionId);
      }
    }
  }
  return { viewCount, appliedConditionIds };
}

export function describeAdditionalHelp(actionLabels: readonly string[]): string[] {
  const order: AssistantActionType[] = [];
  const latestByType = new Map<AssistantActionType, AssistantAction>();
  for (const label of actionLabels) {
    const entry = decodeAssistantLogEntry(label);
    if (!entry || entry.type === 'CONDITION_RECOMMEND_VIEW' || entry.type === 'CONDITION_RECOMMEND_APPLY') {
      continue;
    }
    const existing = latestByType.get(entry.type);
    if (!existing) {
      order.push(entry.type);
    }
    // 성공 기록(failed 아님)은 같은 유형의 실패 기록을 대체한다(재시도 성공). applied:true는
    // 기존대로 먼저 있던 applied:false보다 우선하되, 실패 기록은 성공을 덮지 못한다.
    const replaces =
      !existing ||
      (existing.failed && !entry.failed) ||
      (!entry.failed && entry.applied && !existing.applied);
    if (replaces) {
      latestByType.set(entry.type, entry);
    }
  }
  const lines: string[] = [];
  for (const type of order) {
    const entry = latestByType.get(type);
    const line = entry ? describeEntry(entry) : null;
    if (line) {
      lines.push(line);
    }
  }
  const recommendation = countConditionRecommendation(actionLabels);
  if (recommendation.viewCount > 0) {
    lines.push(`조건 추천 ${recommendation.viewCount}회`);
  }
  if (recommendation.appliedConditionIds.length > 0) {
    lines.push(`추천 조건 ${recommendation.appliedConditionIds.length}개 반영`);
  }
  return lines;
}

export type AssistantFeatureKey = 'summary' | 'compare' | 'refine';

export const ASSISTANT_FEATURE_ORDER: readonly AssistantFeatureKey[] = ['summary', 'compare', 'refine'];

const FEATURE_OF_ACTION: Partial<Record<AssistantActionType, AssistantFeatureKey>> = {
  OPINION_SUMMARY: 'summary',
  CONDITION_RECOMMEND_VIEW: 'compare',
  CONDITION_COMPARE: 'compare',
  DRAFT_REFINE: 'refine',
};

/**
 * T97: DISCUSS에서 AI 비서실장 세 기능(한눈에 보기·조건 추천·발언 정리)을 각각 한 번
 * 이상 써 봤는지. 결과를 렌더했을 때뿐 아니라 실패·연결 지연 안내를 본 경우(failed)도
 * "써 본 것"으로 센다 — 연결이 늦어도 참가자가 막히지 않게 한다. 기록은 세션 단위라
 * stage는 지금 'DISCUSS'뿐이지만, 단계별 요구가 생기면 여기서 가른다.
 */
export function assistantFeaturesUsed(
  assistantActions: readonly string[],
  stage: 'DISCUSS',
): Set<AssistantFeatureKey> {
  const used = new Set<AssistantFeatureKey>();
  if (stage !== 'DISCUSS') {
    return used;
  }
  for (const label of assistantActions) {
    const entry = decodeAssistantLogEntry(label);
    const feature = entry ? FEATURE_OF_ACTION[entry.type] : undefined;
    if (feature) {
      used.add(feature);
    }
  }
  return used;
}

/** AI 비서실장 도움을 하나라도 사용했는지. ResultScreen이 안내 문구 분기에 쓴다. */
export function hasAdditionalHelp(actionLabels: readonly string[]): boolean {
  return describeAdditionalHelp(actionLabels).length > 0;
}
