import { describe, expect, it } from 'vitest';
import { BUBBLE_MAX_LENGTH, bubbleLineOf } from '../../src/components/bubbleText';

describe('bubbleLineOf', () => {
  it('첫 문장을 쉼표 앞에서 끊는다', () => {
    expect(bubbleLineOf('결재 기록을 보면, 담당자가 없을 때 일이 멈춥니다. 다음 문장.')).toBe('결재 기록을 보면');
  });

  it('쉼표가 없으면 첫 문장 전체(마침표 제외)를 쓴다', () => {
    expect(bubbleLineOf('이유 남기는 장치부터. 그다음에 정하겠습니다.')).toBe('이유 남기는 장치부터');
  });

  it('쉼표 앞이 너무 짧으면 문장 전체를 쓴다', () => {
    expect(bubbleLineOf('그래도, 방향은 사람이 잡습니다.')).toBe('그래도, 방향은 사람이 잡습니다');
  });

  it('18자를 넘으면 17자에서 자르고 말줄임표를 붙여 최대 18자를 지킨다', () => {
    const result = bubbleLineOf('가'.repeat(30));
    expect(result).toBe(`${'가'.repeat(BUBBLE_MAX_LENGTH - 1)}…`);
    expect(result.length).toBe(BUBBLE_MAX_LENGTH);
  });

  it('숫자 속 쉼표·소수점에서는 끊지 않는다', () => {
    expect(bubbleLineOf('한도는 12,345원입니다. 다음.')).toBe('한도는 12,345원입니다');
    expect(bubbleLineOf('비용이 3.5배 늘었습니다. 다음.')).toBe('비용이 3.5배 늘었습니다');
  });

  it('문장 끝 닫는 따옴표 때문에 짝 없는 여는 따옴표가 남지 않는다', () => {
    expect(bubbleLineOf('“이유부터 남깁시다.” 라고 했습니다.')).toBe('이유부터 남깁시다');
    expect(bubbleLineOf('“이유부터 남깁시다”라고 했습니다.')).toBe('“이유부터 남깁시다”라고 했습니다');
  });

  it('빈 문자열은 빈 문자열이다', () => {
    expect(bubbleLineOf('   ')).toBe('');
  });
});
