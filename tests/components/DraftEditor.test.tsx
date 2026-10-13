import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
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

  it('300자를 넘으면 글자 수 표시와 함께 오류를 보여준다', () => {
    const longText = 'a'.repeat(DRAFT_MAX_LENGTH + 1);
    render(<DraftEditor value={longText} onChange={vi.fn()} />);
    expect(screen.getByTestId('draft-editor-count')).toHaveTextContent(
      `${longText.length} / ${DRAFT_MAX_LENGTH}자`,
    );
    expect(screen.getByTestId('draft-editor-error')).toBeInTheDocument();
  });

  // T117: 입력 상자는 열의 남는 높이를 채우되(최소 44px, 여유가 있어도 --hud-textarea-h까지)
  // 넘치면 안쪽 스크롤이다. jsdom은 레이아웃을 계산하지 않으므로
  // 스타일시트 규칙과 컴포넌트가 높이를 직접 건드리지 않는 것을 확인한다(실제 위치는 e2e noscroll).
  it('CSS 규칙 문자열 점검: 입력 상자는 남는 높이(최소 44px)·안쪽 스크롤이고 글 길이로 늘어나지 않는다', () => {
    const css = readFileSync('src/styles/screens/discuss.css', 'utf8');
    const rule = /\.draft-editor__textarea \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('min-height: var(--hud-input-min)');
    expect(css).toContain('--hud-input-min: 44px');
    expect(rule).toContain('overflow-y: auto');
    expect(rule).toContain('resize: none');
    expect(rule).not.toMatch(/field-sizing/);
    const editorRule = /\.draft-editor \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(editorRule).toContain('minmax(0, var(--hud-textarea-h))');
    expect(editorRule).toContain('--hud-input-min');

    render(<DraftEditor value={'가'.repeat(600)} onChange={vi.fn()} />);
    const textarea = screen.getByTestId('draft-editor-textarea');
    expect(textarea.getAttribute('style')).toBeNull();
  });
});
