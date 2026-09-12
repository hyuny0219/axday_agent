import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DraftEditor } from '../../src/components/parts/DraftEditor';
import { DRAFT_MAX_LENGTH } from '../../src/domain/draft';

afterEach(() => {
  cleanup();
});

describe('DraftEditor', () => {
  it('조합 중 Enter는 기본 동작을 막고, 조합이 끝난 뒤 Enter는 막지 않는다', () => {
    const onChange = vi.fn();
    render(<DraftEditor value="" onChange={onChange} />);
    const textarea = screen.getByTestId('draft-editor-textarea');

    fireEvent.compositionStart(textarea);
    const duringComposition = fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    expect(duringComposition).toBe(false);

    fireEvent.compositionEnd(textarea);
    const afterComposition = fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    expect(afterComposition).toBe(true);
  });

  it('현재 글자 수와 최대 글자 수를 표시한다', () => {
    render(<DraftEditor value="안녕하세요" onChange={vi.fn()} />);
    expect(screen.getByTestId('draft-editor-count')).toHaveTextContent(
      `5 / ${DRAFT_MAX_LENGTH}자`,
    );
    expect(screen.queryByTestId('draft-editor-error')).not.toBeInTheDocument();
  });

  it('300자를 넘으면 글자 수 표시와 함께 하단 오류를 보여준다', () => {
    const longText = 'a'.repeat(DRAFT_MAX_LENGTH + 1);
    render(<DraftEditor value={longText} onChange={vi.fn()} />);
    expect(screen.getByTestId('draft-editor-count')).toHaveTextContent(
      `${longText.length} / ${DRAFT_MAX_LENGTH}자`,
    );
    expect(screen.getByTestId('draft-editor-error')).toBeInTheDocument();
  });
});
