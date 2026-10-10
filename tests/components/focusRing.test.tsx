// T113 점선 연결부: 6초 지연, 첫 조작 뒤 즉시, 팝업이 열리면 0개, ?focus=off면 0개, 동시에 1개 이하.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BriefingScreen } from '../../src/components/screens/BriefingScreen';
import { anonBoardScenario } from '../../src/content/scenarios';
import { FOCUS_DELAY_MS } from '../../src/domain/nextStep';

function ringed(): Element[] {
  return Array.from(document.querySelectorAll('[data-next-step]'));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('다음 할 일 점선', () => {
  it('들어온 뒤 6초 동안 아무것도 안 누르면 근거 자료 버튼에 한 개만 붙는다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    expect(ringed()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(FOCUS_DELAY_MS - 1);
    });
    expect(ringed()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ringed()).toEqual([screen.getByTestId('open-evidence')]);
  });

  it('무언가 누르면 지연 없이 켜지고, 팝업이 열려 있는 동안은 0개다', async () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));
    await act(async () => {
      vi.advanceTimersByTime(1); // 클릭 기록은 클릭이 끝난 뒤(setTimeout 0)에 반영된다
      await Promise.resolve();
    });
    expect(screen.getByTestId('evidence-dialog')).toBeInTheDocument();
    expect(ringed()).toHaveLength(0);

    fireEvent.click(screen.getByTestId('evidence-dialog-close'));
    await act(async () => {
      vi.advanceTimersByTime(1); // 클릭 기록은 클릭이 끝난 뒤(setTimeout 0)에 반영된다
      await Promise.resolve();
    });
    // 근거 자료를 보았으니 다음은 "의견 듣기" 버튼 하나.
    expect(ringed()).toEqual([screen.getByRole('button', { name: /의견 듣기/ })]);
  });

  it('?focus=off면 6초가 지나도 누른 뒤에도 0개다', () => {
    window.history.replaceState(null, '', '/?focus=off');
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(FOCUS_DELAY_MS * 2);
    });
    fireEvent.click(document.body);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ringed()).toHaveLength(0);
  });
});
