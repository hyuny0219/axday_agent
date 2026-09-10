// AI 비서실장 사용 기록의 형태와, 세션 리듀서(session.ts)의 단순 문자열 레이블
// (assistantActions: string[], RECORD_ASSISTANT_ACTION)과 ResultScreen에 보여줄
// 한국어 문구 사이를 잇는 순수 함수. 규칙은 여기(도메인)에 두고 컴포넌트는 호출만
// 한다(CLAUDE_IMPLEMENTATION.md 5장 "정상 완주 결과의 'AI가 도운 일'").

import type { AssistantMode } from '../services/assistant/types';

export type AssistantActionType =
  | 'SUMMARY_SHOWN'
  | 'OPINION_SUMMARY'
  | 'CONDITION_COMPARE'
  | 'DRAFT_REFINE';

/** AssistantPanel/BriefingScreen이 실제로 결과를 렌더했을 때만 만드는 기록 한 건.
 * shownAt은 버튼 조작 없이 상시 표시되는 카드(BRIEFING 자동 정리), requestedAt은
 * 참가자가 요청해 받은 결과(요약·비교·정리)에 쓴다. */
export interface AssistantAction {
  type: AssistantActionType;
  mode: AssistantMode;
  evidenceIds: string[];
  shownAt?: number;
  requestedAt?: number;
  /** '내 발언 정리'는 '내 발언에 적용'을 눌렀을 때만 true다. */
  applied?: boolean;
}

/** session.assistantActions(RECORD_ASSISTANT_ACTION의 label)에 남기는 문자열. */
export const ASSISTANT_ACTION_LABELS = {
  SUMMARY_SHOWN: 'SUMMARY_SHOWN',
  OPINION_SUMMARY: 'OPINION_SUMMARY_SHOWN',
  CONDITION_COMPARE: 'CONDITION_COMPARE_SHOWN',
  DRAFT_REFINE: 'DRAFT_REFINE_APPLIED',
} as const satisfies Record<AssistantActionType, string>;

const ADDITIONAL_HELP_DESCRIPTIONS: Record<string, string> = {
  [ASSISTANT_ACTION_LABELS.OPINION_SUMMARY]: '의견 한눈에 보기를 확인했습니다.',
  [ASSISTANT_ACTION_LABELS.CONDITION_COMPARE]: '조건 비교하기를 확인했습니다.',
  [ASSISTANT_ACTION_LABELS.DRAFT_REFINE]: '내 발언 정리를 내 발언에 적용했습니다.',
};

/** AssistantAction을 session.assistantActions에 남길 레이블 문자열로 줄인다. */
export function toAssistantActionLabel(action: AssistantAction): string {
  return ASSISTANT_ACTION_LABELS[action.type];
}

/**
 * session.assistantActions(문자열 레이블 배열)에서 '자료 자동 정리' 이외에 참가자가
 * 실제로 사용한 추가 도움만 한국어 문장으로 바꾼다. 같은 레이블이 여러 번 있어도
 * 한 줄만 보여주고, 모르는 레이블(예: 아직 정의되지 않은 값)은 조용히 무시해
 * 실제로 없었던 도움을 과장해 보여주지 않는다.
 */
export function describeAdditionalHelp(actionLabels: readonly string[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const label of actionLabels) {
    const description = ADDITIONAL_HELP_DESCRIPTIONS[label];
    if (description && !seen.has(label)) {
      seen.add(label);
      lines.push(description);
    }
  }
  return lines;
}

/** 추가 AI 도움을 하나라도 사용했는지. ResultScreen이 안내 문구 분기에 쓴다. */
export function hasAdditionalHelp(actionLabels: readonly string[]): boolean {
  return describeAdditionalHelp(actionLabels).length > 0;
}
