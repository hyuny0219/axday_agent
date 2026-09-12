// 추천 문구 체크박스와 직접 입력 textarea 사이의 편집 손실 방지 규칙.
// CLAUDE_IMPLEMENTATION.md 4장: 직접 수정 이후에는 체크 변경으로 draft를 조용히
// 덮어쓰지 않고, '직접 쓴 내용 유지 / 선택 문구로 다시 구성' 확인을 거친다.

import type { Scenario } from '../content/types';

export const DRAFT_MAX_LENGTH = 300;

export interface DraftState {
  selectedPhraseIds: string[];
  draftText: string;
  dirty: boolean;
}

export const EMPTY_DRAFT_STATE: DraftState = {
  selectedPhraseIds: [],
  draftText: '',
  dirty: false,
};

/** 선택된 문구 ID를 시나리오에 정의된 순서로 이어 붙여 draft 문구를 만든다. */
export function buildDraftText(scenario: Scenario, selectedPhraseIds: string[]): string {
  const selectedSet = new Set(selectedPhraseIds);
  return scenario.phrases
    .filter((phrase) => selectedSet.has(phrase.id))
    .map((phrase) => phrase.text)
    .join(' ');
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export type TogglePhraseResult =
  | { kind: 'applied'; state: DraftState }
  | { kind: 'needsConfirm'; pendingPhraseId: string };

/**
 * 문구 체크박스를 토글한다. 아직 직접 수정(dirty)이 없었다면 즉시 draft를 재구성한다.
 * 이미 직접 수정한 뒤라면 덮어쓰지 않고 확인이 필요하다는 결과만 반환한다.
 */
export function togglePhrase(
  state: DraftState,
  scenario: Scenario,
  phraseId: string,
): TogglePhraseResult {
  if (state.dirty) {
    return { kind: 'needsConfirm', pendingPhraseId: phraseId };
  }
  const selectedPhraseIds = toggleId(state.selectedPhraseIds, phraseId);
  return {
    kind: 'applied',
    state: {
      selectedPhraseIds,
      draftText: buildDraftText(scenario, selectedPhraseIds),
      dirty: false,
    },
  };
}

/**
 * `togglePhrase`가 'needsConfirm'을 반환했을 때 사용자의 선택을 반영한다.
 * 'keep'은 직접 쓴 draftText를 그대로 두고 체크 상태만 바꾼다(다시 dirty로 남는다).
 * 'rebuild'는 새 체크 선택 기준으로 draftText를 다시 구성한다(dirty 해제).
 */
export function resolveConfirm(
  state: DraftState,
  scenario: Scenario,
  pendingPhraseId: string,
  choice: 'keep' | 'rebuild',
): DraftState {
  const selectedPhraseIds = toggleId(state.selectedPhraseIds, pendingPhraseId);
  if (choice === 'keep') {
    return { selectedPhraseIds, draftText: state.draftText, dirty: true };
  }
  return {
    selectedPhraseIds,
    draftText: buildDraftText(scenario, selectedPhraseIds),
    dirty: false,
  };
}

export interface EditTextResult {
  state: DraftState;
  overLimit: boolean;
}

/**
 * 직접 입력을 반영한다. 300자를 넘어도 잘라내지 않고 overLimit만 알려준다.
 * 축약은 참가자가 결정한다.
 */
export function editText(state: DraftState, text: string): EditTextResult {
  return {
    state: { selectedPhraseIds: state.selectedPhraseIds, draftText: text, dirty: true },
    overLimit: text.length > DRAFT_MAX_LENGTH,
  };
}

/** 공백만 있거나 300자를 넘으면 전달할 수 없다. */
export function isSubmittable(state: DraftState): boolean {
  if (state.draftText.trim() === '') {
    return false;
  }
  return state.draftText.length <= DRAFT_MAX_LENGTH;
}
