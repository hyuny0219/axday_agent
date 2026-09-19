import { describe, expect, it } from 'vitest';
import { STAGE_BUBBLE_MAX_LENGTH, firstSentenceClipped } from '../../src/components/stageText';

describe('firstSentenceClipped', () => {
  it('첫 문장이 40자 이하면 그대로 돌려준다', () => {
    expect(firstSentenceClipped('보고 준비를 줄이고 판단과 실행에 시간을 씁시다. 다음 문장은 버린다.')).toBe(
      '보고 준비를 줄이고 판단과 실행에 시간을 씁시다.',
    );
  });

  it('문장 부호가 없으면 전체 문자열을 한 문장으로 본다', () => {
    expect(firstSentenceClipped('짧은 문구')).toBe('짧은 문구');
  });

  it('첫 문장이 40자를 넘으면 40자에서 자르고 말줄임표를 붙인다', () => {
    const longSentence = '가'.repeat(60) + '.';
    const result = firstSentenceClipped(longSentence);
    expect(result).toBe(`${'가'.repeat(STAGE_BUBBLE_MAX_LENGTH)}…`);
    expect(result.length).toBe(STAGE_BUBBLE_MAX_LENGTH + 1);
  });

  it('앞뒤 공백을 제거한 뒤 판단한다', () => {
    expect(firstSentenceClipped('  안녕하세요.  다음 문장  ')).toBe('안녕하세요.');
  });

  it('빈 문자열은 빈 문자열로 돌려준다', () => {
    expect(firstSentenceClipped('')).toBe('');
    expect(firstSentenceClipped('   ')).toBe('');
  });

  it('물음표·느낌표도 문장 끝으로 인식한다', () => {
    expect(firstSentenceClipped('도입할까요? 조건은 어떻게 할까요?')).toBe('도입할까요?');
    expect(firstSentenceClipped('시작합시다! 다음 문장')).toBe('시작합시다!');
  });

  it('정확히 40자인 첫 문장은 자르지 않는다', () => {
    const exact = '가'.repeat(39) + '.';
    expect(exact.length).toBe(STAGE_BUBBLE_MAX_LENGTH);
    expect(firstSentenceClipped(exact)).toBe(exact);
  });
});
