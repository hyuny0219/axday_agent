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
  | 'DRAFT_REFINE';

/** AssistantPanel이 실제로 결과를 렌더했을 때만 만드는 기록 한 건. requestedAt은
 * 참가자가 요청해 받은 결과(요약·비교·정리)의 시각이다. */
export interface AssistantAction {
  type: AssistantActionType;
  mode: AssistantMode;
  evidenceIds: string[];
  requestedAt?: number;
  /** '내 발언 정리'는 '내 발언에 적용'을 눌렀을 때만 true다. */
  applied?: boolean;
}

/** AssistantPanel이 결과를 실제로 렌더·적용했을 때 넘기는 입력. requestedAt은 세션
 * reducer가 주입된 Clock(now)으로 채운다 — 컴포넌트가 자체 시계를 만들지 않는다. */
export type AssistantActionEvent = Pick<AssistantAction, 'type' | 'mode' | 'evidenceIds'> & {
  applied?: boolean;
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
export function describeAdditionalHelp(actionLabels: readonly string[]): string[] {
  const order: AssistantActionType[] = [];
  const latestByType = new Map<AssistantActionType, AssistantAction>();
  for (const label of actionLabels) {
    const entry = decodeAssistantLogEntry(label);
    if (!entry) {
      continue;
    }
    const existing = latestByType.get(entry.type);
    if (!existing) {
      order.push(entry.type);
    }
    if (!existing || (entry.applied && !existing.applied)) {
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
  return lines;
}

/** AI 비서실장 도움을 하나라도 사용했는지. ResultScreen이 안내 문구 분기에 쓴다. */
export function hasAdditionalHelp(actionLabels: readonly string[]): boolean {
  return describeAdditionalHelp(actionLabels).length > 0;
}
