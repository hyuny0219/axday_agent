import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConditionChips } from '../../src/components/parts/ConditionChips';
import { countHiddenChips } from '../../src/components/parts/chipOverflow';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('countHiddenChips', () => {
  const list = { left: 83, right: 483 };
  it('칩이 전부 목록 안이면 0이다(목록 왼쪽 오프셋이 있어도)', () => {
    expect(countHiddenChips(list, [{ left: 83, right: 200 }, { left: 204, right: 483 }])).toBe(0);
  });
  it('오른쪽 끝을 넘은 칩만 센다', () => {
    expect(
      countHiddenChips(list, [
        { left: 83, right: 200 },
        { left: 204, right: 330 },
        { left: 334, right: 500 },
        { left: 504, right: 620 },
      ]),
    ).toBe(2);
  });
});

describe('ConditionChips "+N"·페이드', () => {
  const ids = ['LIMIT', 'LOG', 'REVIEW', 'OWNER', 'FULL_AUTO'];
  // 목록은 화면 x 83~483, 칩은 폭 120 + 간격 4, 스크롤한 만큼 왼쪽으로 민다.
  function stubLayout(getScroll: () => number) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('condition-chips__list')) {
        return { left: 83, right: 483, top: 0, bottom: 32, width: 400, height: 32, x: 83, y: 0, toJSON: () => ({}) };
      }
      const chip = this.closest('.condition-chip');
      if (chip) {
        const index = [...(chip.parentElement?.children ?? [])].indexOf(chip);
        const left = 83 + index * 124 - getScroll();
        return { left, right: left + 120, top: 0, bottom: 24, width: 120, height: 24, x: left, y: 0, toJSON: () => ({}) };
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    });
  }
  function renderChips(count: number) {
    return render(
      <ConditionChips
        scenario={aiApprovalScenario}
        proposedIds={ids.slice(0, count)}
        acceptedIds={[]}
        conflictPairs={[]}
        showNoMatchHint={false}
        onToggle={vi.fn()}
      />,
    );
  }

  it('칩이 전부 들어가면 +N과 페이드가 없다', () => {
    stubLayout(() => 0);
    const { container } = renderChips(3);
    expect(screen.getByTestId('condition-chips-more')).toHaveTextContent('');
    expect(container.querySelector('.condition-chips__list')).toHaveAttribute('data-more', 'false');
  });

  it('일부가 가려지면 정확한 N을 보이고, 끝까지 스크롤하면 0이 된다', () => {
    let scroll = 0;
    stubLayout(() => scroll);
    const { container } = renderChips(5);
    const list = container.querySelector('.condition-chips__list') as HTMLElement;
    // 칩 5개: right = 83+120, 327, 451, 575, 699 → 483을 넘는 것은 4·5번째 = 2개
    expect(screen.getByTestId('condition-chips-more')).toHaveTextContent('+2');
    expect(list).toHaveAttribute('data-more', 'true');
    scroll = 216; // 마지막 칩 right = 699-216 = 483
    fireEvent.scroll(list);
    expect(screen.getByTestId('condition-chips-more')).toHaveTextContent('');
    expect(list).toHaveAttribute('data-more', 'false');
  });
});
