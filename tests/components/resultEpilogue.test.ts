// "6개월 뒤" 에필로그 선택(T47, PR #8 Codex 2차 검토 반영): 가결은 반영 조건 유무로
// pass/passOriginal을 가른다 — 도장(resultStamp.ts)의 "조건부 가결"/"가결"과 같은 기준.

import { describe, expect, it } from 'vitest';
import { epilogueText } from '../../src/components/resultEpilogue';

const copy = { pass: '조건 있는 가결', passOriginal: '원안 가결', hold: '보류', reject: '부결' };

describe('epilogueText', () => {
  it('반영 조건이 있는 가결은 pass', () => {
    expect(epilogueText('PASS', true, copy)).toBe('조건 있는 가결');
  });

  it('반영 조건 없는 원안 가결은 passOriginal', () => {
    expect(epilogueText('PASS', false, copy)).toBe('원안 가결');
  });

  it('보류·부결은 조건 유무와 무관하다', () => {
    expect(epilogueText('HOLD', true, copy)).toBe('보류');
    expect(epilogueText('REJECT', false, copy)).toBe('부결');
  });

  it('결과가 없으면 null', () => {
    expect(epilogueText(null, false, copy)).toBeNull();
  });
});
