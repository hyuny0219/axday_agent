import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { HighlightText, splitByTerms } from '../../src/components/parts/HighlightText';

afterEach(() => {
  cleanup();
});

describe('splitByTerms', () => {
  it('핵심 말만 강조 조각으로 나누고, 이어 붙이면 원문과 같다', () => {
    const text = '결재가 하루 수십 건씩 쌓입니다.';
    const parts = splitByTerms(text, ['하루 수십 건']);
    expect(parts).toEqual([
      { text: '결재가 ', highlight: false },
      { text: '하루 수십 건', highlight: true },
      { text: '씩 쌓입니다.', highlight: false },
    ]);
    expect(parts.map((p) => p.text).join('')).toBe(text);
  });

  it('겹치면 긴 말이 우선이다', () => {
    const parts = splitByTerms('금액 한도를 정합니다', ['한도', '금액 한도']);
    expect(parts.filter((p) => p.highlight).map((p) => p.text)).toEqual(['금액 한도']);
  });

  it('같은 말이 여러 번 나오면 모두 강조하고, 일치하지 않으면 그대로 둔다', () => {
    expect(splitByTerms('책임과 책임', ['책임']).filter((p) => p.highlight)).toHaveLength(2);
    expect(splitByTerms('없는 말', ['책임'])).toEqual([{ text: '없는 말', highlight: false }]);
  });

  it('빈 말·빈 문자열·말 목록이 없는 경우를 안전하게 처리한다', () => {
    expect(splitByTerms('', ['책임'])).toEqual([]);
    expect(splitByTerms('글', [''])).toEqual([{ text: '글', highlight: false }]);
    expect(splitByTerms('글', [])).toEqual([{ text: '글', highlight: false }]);
  });

  it('대소문자와 공백을 그대로 비교한다', () => {
    expect(splitByTerms('AI 에이전트', ['ai 에이전트']).some((p) => p.highlight)).toBe(false);
    expect(splitByTerms('AI 에이전트', ['AI 에이전트']).some((p) => p.highlight)).toBe(true);
  });
});

describe('HighlightText', () => {
  it('일치한 말은 mark.key-term으로 렌더한다', () => {
    const { container } = render(<p><HighlightText text="며칠씩 멈춥니다" terms={['며칠씩 멈춥니다']} /></p>);
    const marks = container.querySelectorAll('mark.key-term');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('며칠씩 멈춥니다');
  });
});
