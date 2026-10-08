// GuideHint(T95): 진행 가이드 한 줄을 그대로 보여주는 아주 작은 공용 컴포넌트.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GuideHint } from '../../src/components/parts/GuideHint';

afterEach(() => {
  cleanup();
});

describe('GuideHint', () => {
  it('문구를 그대로 보여주고 기본 testId는 guide-hint다', () => {
    render(<GuideHint text="먼저 근거 자료 4장을 열어 보세요" />);
    expect(screen.getByTestId('guide-hint')).toHaveTextContent('먼저 근거 자료 4장을 열어 보세요');
  });

  it('testId를 넘기면 그 값을 쓴다', () => {
    render(<GuideHint text="추천 문구를 고르거나 직접 써 주세요" testId="discuss-guide-hint" />);
    expect(screen.getByTestId('discuss-guide-hint')).toBeInTheDocument();
  });
});
