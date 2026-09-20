// 회의록 패널의 낭독 속성(T41, PR #7 Codex 1차 검토 반영): live에서 "판단 중" 행이 같은
// 행 안에서 응답 문장으로 바뀔 때 발화자까지 한 덩어리로 읽히려면 목록이 text 변경을
// 알리고 각 행이 aria-atomic이어야 한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MinutesPanel } from '../../src/components/parts/MinutesPanel';
import type { MinutesEntry } from '../../src/components/minutes';

beforeAll(() => {
  // jsdom에는 matchMedia가 없다. 1080 창(6건)으로 고정한다.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

const chair: MinutesEntry = { id: 'chair', speaker: 'CEO', text: '상황 요약입니다.', kind: 'speech' };

describe('MinutesPanel 낭독', () => {
  it('목록은 추가와 텍스트 변경을 모두 알리고, 각 행은 aria-atomic이다', () => {
    render(<MinutesPanel entries={[chair, { id: 'op-CFO', speaker: 'CFO', text: '', kind: 'pending' }]} stage="OPINIONS" />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(list.getAttribute('aria-relevant')?.split(/\s+/)).toEqual(expect.arrayContaining(['additions', 'text']));
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('판단 중 행이 응답으로 바뀌면 같은 행 안에서 발화자와 문장이 함께 남는다', () => {
    const { rerender } = render(
      <MinutesPanel entries={[chair, { id: 'op-CFO', speaker: 'CFO', text: '', kind: 'pending' }]} stage="OPINIONS" />,
    );
    const before = screen.getByTestId('minutes-entry-op-CFO');
    expect(before.querySelector('.minutes__dots')).not.toBeNull();

    rerender(
      <MinutesPanel
        entries={[chair, { id: 'op-CFO', speaker: 'CFO', text: '작게 시작합시다.', kind: 'speech' }]}
        stage="OPINIONS"
      />,
    );
    const after = screen.getByTestId('minutes-entry-op-CFO');
    expect(after).toBe(before);
    expect(after).toHaveAttribute('aria-atomic', 'true');
    expect(after).toHaveTextContent('재무책임임원(CFO)');
    expect(after).toHaveTextContent('작게 시작합시다.');
    expect(after.querySelector('.minutes__dots')).toBeNull();
  });
});
