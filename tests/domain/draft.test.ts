import { describe, expect, it } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import {
  DRAFT_MAX_LENGTH,
  EMPTY_DRAFT_STATE,
  buildDraftText,
  editText,
  isSubmittable,
  resolveConfirm,
  togglePhrase,
} from '../../src/domain/draft';

const scenario = aiAssistantScenario;

describe('togglePhrase', () => {
  it('dirty가 아니면 체크 변경으로 draftText를 즉시 재구성한다', () => {
    const result = togglePhrase(EMPTY_DRAFT_STATE, scenario, 'P1');
    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') {
      expect(result.state.selectedPhraseIds).toEqual(['P1']);
      expect(result.state.draftText).toBe(buildDraftText(scenario, ['P1']));
      expect(result.state.dirty).toBe(false);
    }
  });

  it('같은 문구를 다시 토글하면 선택을 해제하고 draftText도 비운다', () => {
    const first = togglePhrase(EMPTY_DRAFT_STATE, scenario, 'P1');
    if (first.kind !== 'applied') throw new Error('applied expected');
    const second = togglePhrase(first.state, scenario, 'P1');
    expect(second.kind).toBe('applied');
    if (second.kind === 'applied') {
      expect(second.state.selectedPhraseIds).toEqual([]);
      expect(second.state.draftText).toBe('');
    }
  });

  it('직접 수정(dirty) 이후에는 체크를 조용히 덮어쓰지 않고 확인을 요구한다', () => {
    const edited = editText(EMPTY_DRAFT_STATE, '제가 직접 쓴 의견입니다.');
    const result = togglePhrase(edited.state, scenario, 'P1');
    expect(result).toEqual({ kind: 'needsConfirm', pendingPhraseId: 'P1' });
  });
});

describe('resolveConfirm', () => {
  const edited = editText(EMPTY_DRAFT_STATE, '제가 직접 쓴 의견입니다.').state;

  it("'keep'은 직접 쓴 draftText를 유지하고 체크만 반영한다(dirty 유지)", () => {
    const result = resolveConfirm(edited, scenario, 'P1', 'keep');
    expect(result.draftText).toBe('제가 직접 쓴 의견입니다.');
    expect(result.selectedPhraseIds).toEqual(['P1']);
    expect(result.dirty).toBe(true);
  });

  it("'rebuild'는 새 체크 선택 기준으로 draftText를 다시 구성한다(dirty 해제)", () => {
    const result = resolveConfirm(edited, scenario, 'P1', 'rebuild');
    expect(result.draftText).toBe(buildDraftText(scenario, ['P1']));
    expect(result.selectedPhraseIds).toEqual(['P1']);
    expect(result.dirty).toBe(false);
  });
});

describe('editText', () => {
  it('300자를 넘어도 잘라내지 않고 overLimit만 알려준다', () => {
    const longText = '가'.repeat(DRAFT_MAX_LENGTH + 10);
    const result = editText(EMPTY_DRAFT_STATE, longText);
    expect(result.state.draftText).toBe(longText);
    expect(result.state.draftText.length).toBe(DRAFT_MAX_LENGTH + 10);
    expect(result.overLimit).toBe(true);
    expect(result.state.dirty).toBe(true);
  });

  it('300자 이하이면 overLimit이 false다', () => {
    const result = editText(EMPTY_DRAFT_STATE, '짧은 의견');
    expect(result.overLimit).toBe(false);
  });
});

describe('isSubmittable', () => {
  it('공백만 있으면 전달 불가', () => {
    const state = editText(EMPTY_DRAFT_STATE, '   ').state;
    expect(isSubmittable(state)).toBe(false);
  });

  it('300자를 넘으면 전달 불가', () => {
    const state = editText(EMPTY_DRAFT_STATE, '가'.repeat(DRAFT_MAX_LENGTH + 1)).state;
    expect(isSubmittable(state)).toBe(false);
  });

  it('300자 이하의 공백 아닌 텍스트는 전달 가능', () => {
    const state = editText(EMPTY_DRAFT_STATE, '작은 범위로 시작합시다.').state;
    expect(isSubmittable(state)).toBe(true);
  });

  it('빈 draftText는 전달 불가', () => {
    expect(isSubmittable(EMPTY_DRAFT_STATE)).toBe(false);
  });
});
