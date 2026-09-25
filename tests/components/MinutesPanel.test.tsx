// 회의록 패널의 낭독 속성(T41, PR #7 Codex 1차 검토 반영): live에서 "판단 중" 행이 같은
// 행 안에서 응답 문장으로 바뀔 때 발화자까지 한 덩어리로 읽히려면 목록이 text 변경을
// 알리고 각 행이 aria-atomic이어야 한다.

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    // 점은 장식(aria-hidden)이라 상태 문구가 접근 가능한 텍스트로 따로 있어야 한다.
    expect(before).toHaveTextContent('판단 중');
    expect(before.querySelector('.minutes__dots')).toHaveAttribute('aria-hidden', 'true');

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
    expect(after).not.toHaveTextContent('판단 중');
    expect(after.querySelector('.minutes__dots')).toBeNull();
  });
});

// T56 세로 예산 계산. 한 건도 못 담는 높이에서는 0건으로 접히고, 접힌 상태에서 max로
// 되돌아가 "max → 0 → max"를 반복하지 않아야 한다(PR #10 Codex 3차 검토 P1). 다시 펴는
// 것은 접을 때보다 가용 높이가 실제로 커졌을 때뿐이다.
describe('MinutesPanel 세로 예산', () => {
  let outerHeight = 0;
  const original = Element.prototype.getBoundingClientRect;

  beforeAll(() => {
    // jsdom은 크기를 0으로 준다. 행 20px·머리글 10px·바깥 칸은 테스트가 정한 높이로 흉내 낸다.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const height = this.classList.contains('minutes__entry')
        ? 20
        : this.classList.contains('minutes__head')
          ? 10
          : this.classList.contains('minutes')
            ? 0
            : outerHeight;
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({}) } as DOMRect;
    };
  });

  afterAll(() => {
    Element.prototype.getBoundingClientRect = original;
  });

  const entries: MinutesEntry[] = [
    chair,
    { id: 'op-CFO', speaker: 'CFO', text: '담당자부터 필요합니다.', kind: 'speech' },
  ];

  it('한 건도 못 담는 높이에서는 접힌 채로 머물고, 높이가 커져야 다시 편다', () => {
    outerHeight = 15; // 머리글 10을 빼면 5px — 행 20px이 한 건도 들어가지 않는다
    const { rerender } = render(<MinutesPanel entries={entries} stage="VOTE" />);
    const panel = screen.getByTestId('minutes-panel');
    expect(panel).toHaveClass('minutes--collapsed');
    expect(panel.querySelectorAll('.minutes__entry:not(.minutes__entry--hidden)')).toHaveLength(0);

    // 같은 높이에서 항목이 늘어도(effect 재실행) 접힘이 풀리지 않는다.
    const more: MinutesEntry[] = [...entries, { id: 'op-CISO', speaker: 'CISO', text: '로그는 별개입니다.', kind: 'speech' }];
    rerender(<MinutesPanel entries={more} stage="VOTE" />);
    expect(screen.getByTestId('minutes-panel')).toHaveClass('minutes--collapsed');

    // 가용 높이가 커지면(50 - 10 = 40px → 2건) 다시 편다.
    outerHeight = 50;
    rerender(<MinutesPanel entries={[...more, { id: 'op-CAIO', speaker: 'CAIO', text: '계정 체계와 연결해야 합니다.', kind: 'speech' }]} stage="VOTE" />);
    const expanded = screen.getByTestId('minutes-panel');
    expect(expanded).not.toHaveClass('minutes--collapsed');
    expect(expanded.querySelectorAll('.minutes__entry:not(.minutes__entry--hidden)')).toHaveLength(2);
  });
});
