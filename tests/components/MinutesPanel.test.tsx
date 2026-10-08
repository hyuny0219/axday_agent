// 회의록 패널의 낭독 속성(T41, PR #7 Codex 1차 검토 반영): live에서 "판단 중" 행이 같은
// 행 안에서 응답 문장으로 바뀔 때 발화자까지 한 덩어리로 읽히려면 목록이 text 변경을
// 알리고 각 행이 aria-atomic이어야 한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MinutesPanel } from '../../src/components/parts/MinutesPanel';
import type { MinutesEntry } from '../../src/components/minutes';

beforeAll(() => {
  // jsdom에는 matchMedia가 없다(다른 컴포넌트가 참조할 수 있어 안전하게 채워 둔다).
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

const chair: MinutesEntry = {
  id: 'chair',
  speaker: 'CEO',
  text: '상황 요약입니다.',
  kind: 'speech',
  timeLabel: '00:00',
};

describe('MinutesPanel 낭독', () => {
  it('목록은 추가와 텍스트 변경을 모두 알리고, 각 행은 aria-atomic이다', () => {
    render(
      <MinutesPanel
        entries={[chair, { id: 'op-CFO', speaker: 'CFO', text: '', kind: 'pending', timeLabel: '--:--' }]}
      />,
    );
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(list.getAttribute('aria-relevant')?.split(/\s+/)).toEqual(expect.arrayContaining(['additions', 'text']));
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('판단 중 행이 응답으로 바뀌면 같은 행 안에서 발화자와 문장이 함께 남는다(시안 "▌ 대기 중" 표시, T77)', () => {
    const { rerender } = render(
      <MinutesPanel
        entries={[chair, { id: 'op-CFO', speaker: 'CFO', text: '', kind: 'pending', timeLabel: '--:--' }]}
      />,
    );
    const before = screen.getByTestId('minutes-entry-op-CFO');
    // 시각을 모르는 행(T85 #12)은 "[--:--]"를 지어내 보이지 않고 역할 코드만 보인다.
    expect(before).not.toHaveTextContent('--:--');
    expect(before).toHaveTextContent('CFO');
    expect(before).toHaveTextContent('대기 중');

    rerender(
      <MinutesPanel
        entries={[
          chair,
          { id: 'op-CFO', speaker: 'CFO', text: '작게 시작합시다.', kind: 'speech', timeLabel: '00:09' },
        ]}
      />,
    );
    const after = screen.getByTestId('minutes-entry-op-CFO');
    expect(after).toBe(before);
    expect(after).toHaveAttribute('aria-atomic', 'true');
    expect(after).toHaveTextContent('재무책임임원(CFO)');
    expect(after).toHaveTextContent('[00:09] CFO');
    expect(after).toHaveTextContent('작게 시작합시다.');
    expect(after).not.toHaveTextContent('대기 중');
  });
});

// 2026-09-28 사용자 결정: 창 고정(최근 N건)·한 줄 말줄임을 없애고 전체 항목을 전문으로
// 보여준다. 넘치면 목록만 스크롤하고(페이지 스크롤 금지 유지) 새 항목이 오면 맨 아래로 내린다.
describe('MinutesPanel 전체 표시·스크롤', () => {
  const many: MinutesEntry[] = Array.from({ length: 12 }, (_, index) => ({
    id: `entry-${index}`,
    speaker: index % 2 === 0 ? 'CEO' : 'CFO',
    text: `발언 ${index}. `.repeat(6).trim(),
    kind: 'speech',
    timeLabel: '00:00',
  }));

  it('항목을 하나도 숨기지 않고 전문 그대로 렌더한다', () => {
    render(<MinutesPanel entries={many} />);
    const panel = screen.getByTestId('minutes-panel');
    expect(panel.querySelectorAll('.minutes__entry')).toHaveLength(12);
    expect(panel.querySelectorAll('.minutes__entry--hidden')).toHaveLength(0);
    expect(panel).not.toHaveClass('minutes--collapsed');
    expect(screen.getByTestId('minutes-entry-entry-11')).toHaveTextContent(many[11]!.text);
    // 시안 TRANSCRIPT 머리글 건수 배지 형식(T77, T83에서 한국어화): "N건".
    expect(screen.getByTestId('minutes-count')).toHaveTextContent('12건');
  });

  it('목록은 키보드로 스크롤할 수 있게 포커스를 받고, 이름은 "발언 흐름"이다', () => {
    render(<MinutesPanel entries={many} />);
    expect(screen.getByTestId('minutes-list')).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('region', { name: '발언 흐름' })).toBeInTheDocument();
  });

  it('새 항목이 오면 목록을 맨 아래로 내린다', () => {
    const { rerender } = render(<MinutesPanel entries={many.slice(0, 3)} />);
    const list = screen.getByTestId('minutes-list');
    // jsdom은 scrollHeight가 0이라 실제 값 대신 대입 호출 여부만 본다.
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 999 });
    let assigned = -1;
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      get: () => assigned,
      set: (v: number) => {
        assigned = v;
      },
    });
    rerender(<MinutesPanel entries={many.slice(0, 4)} />);
    expect(assigned).toBe(999);
  });
});
