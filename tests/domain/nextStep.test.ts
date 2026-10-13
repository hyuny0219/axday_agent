// T113 다음 할 일 점선의 규칙: 화면별 매핑, 한 번 한 것은 빠짐, 시작 지연.
import { describe, expect, it } from 'vitest';
import {
  FOCUS_DELAY_MS,
  briefingNextStep,
  discussNextStep,
  firstPending,
  focusDisabledBySearch,
  introNextStep,
  isFocusArmed,
  motionNextStep,
  opinionsNextStep,
  reactionsAnswerNextStep,
  reactionsListenNextStep,
  voteNextStep,
} from '../../src/domain/nextStep';

describe('시작 지연', () => {
  it('아무것도 안 누르면 6초가 지나야 켜진다', () => {
    expect(FOCUS_DELAY_MS).toBe(6000);
    expect(isFocusArmed({ enabled: true, interacted: false, idleMs: 5999 })).toBe(false);
    expect(isFocusArmed({ enabled: true, interacted: false, idleMs: 6000 })).toBe(true);
  });

  it('한 번이라도 눌렀으면 지연 없이 켜진다', () => {
    expect(isFocusArmed({ enabled: true, interacted: true, idleMs: 0 })).toBe(true);
  });

  it('꺼져 있으면 언제나 꺼져 있다', () => {
    expect(isFocusArmed({ enabled: false, interacted: true, idleMs: 99999 })).toBe(false);
  });

  it('?focus=off만 끈다', () => {
    expect(focusDisabledBySearch('?focus=off')).toBe(true);
    expect(focusDisabledBySearch('?coach=off&mode=scripted')).toBe(false);
    expect(focusDisabledBySearch('')).toBe(false);
  });
});

describe('firstPending', () => {
  it('위에서부터 처음 남은 항목을 고르고 모두 끝났으면 null', () => {
    expect(firstPending([['a', false], ['b', true], ['c', true]])).toBe('b');
    expect(firstPending([['a', false]])).toBeNull();
  });
});

describe('화면별 다음 할 일', () => {
  it('INTRO는 시작 버튼', () => {
    expect(introNextStep()).toBe('start');
  });

  it('BRIEFING은 근거 자료를 본 뒤에야 다음 버튼으로 옮겨 간다', () => {
    expect(briefingNextStep({ evidenceSeen: false })).toBe('evidence');
    expect(briefingNextStep({ evidenceSeen: true })).toBe('next');
  });

  it('OPINIONS·REACTIONS 듣기·MOTION은 잠겨 있으면 없다', () => {
    expect(opinionsNextStep({ locked: true })).toBeNull();
    expect(opinionsNextStep({ locked: false })).toBe('next');
    expect(reactionsListenNextStep({ locked: true })).toBeNull();
    expect(reactionsListenNextStep({ locked: false })).toBe('advance');
    expect(motionNextStep({ locked: true })).toBeNull();
    expect(motionNextStep({ locked: false })).toBe('freeze');
  });

  it('DISCUSS는 입장 → 추천 문구 → 비서실장 → 전달 순서로 옮겨 가고 전달 뒤에는 없다', () => {
    const base = { sideChosen: false, hasDraft: false, assistantUsed: false, canSubmit: false };
    expect(discussNextStep(base)).toBe('side');
    expect(discussNextStep({ ...base, sideChosen: true })).toBe('phrase');
    expect(discussNextStep({ ...base, sideChosen: true, hasDraft: true })).toBe('assistant');
    expect(discussNextStep({ ...base, sideChosen: true, hasDraft: true, assistantUsed: true })).toBeNull();
    expect(
      discussNextStep({ sideChosen: true, hasDraft: true, assistantUsed: true, canSubmit: true }),
    ).toBe('submit');
  });

  it('DISCUSS는 직접 쓴 글이 있으면 추천 문구 단계를 건너뛴다', () => {
    expect(
      discussNextStep({ sideChosen: true, hasDraft: true, assistantUsed: false, canSubmit: false }),
    ).toBe('assistant');
  });

  it('REACTIONS 2/2는 입장 → 추천 답변 → 답변 전달', () => {
    expect(reactionsAnswerNextStep({ sideChosen: false, hasAnswer: false, canSubmit: false })).toBe('side');
    expect(reactionsAnswerNextStep({ sideChosen: true, hasAnswer: false, canSubmit: false })).toBe('option');
    expect(reactionsAnswerNextStep({ sideChosen: true, hasAnswer: true, canSubmit: true })).toBe('submit');
    expect(reactionsAnswerNextStep({ sideChosen: true, hasAnswer: true, canSubmit: false })).toBeNull();
  });

  it('VOTE는 표를 고르기 전 두 도장 묶음, 고른 뒤 확정, 확정한 뒤 없다', () => {
    expect(voteNextStep({ picked: false, submitted: false })).toBe('choice');
    expect(voteNextStep({ picked: true, submitted: false })).toBe('confirm');
    expect(voteNextStep({ picked: true, submitted: true })).toBeNull();
  });
});
