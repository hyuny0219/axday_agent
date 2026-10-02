// SelectScreen(T70, docs/design/mockups/S1_Select.html 시안대로): 카드 제목은
// chairBriefing.question(안건 질문 한 줄)만 쓰고 headline·hook·subtitle은 쓰지
// 않는다. 준비 중 안건은 비활성(disabled)이고, 활성 안건을 선택해야 "이사회 입장"
// CTA가 눌린다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectScreen } from '../../src/components/screens/SelectScreen';
import { scenarios, anonBoardScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

const preparingScenario = scenarios.find((s) => s.status === 'preparing')!;

describe('SelectScreen', () => {
  it('카드 제목에는 chairBriefing.question만 보이고 headline·hook·subtitle은 보이지 않는다', () => {
    render(<SelectScreen scenarios={scenarios} onEnter={vi.fn()} />);

    expect(
      screen.getByTestId(`scenario-card-${anonBoardScenario.id}`),
    ).toHaveTextContent(anonBoardScenario.chairBriefing.question);
    expect(screen.queryByText(anonBoardScenario.incident.headline)).not.toBeInTheDocument();
    expect(screen.queryByText(anonBoardScenario.incident.hook)).not.toBeInTheDocument();
    expect(screen.queryByText(anonBoardScenario.subtitle)).not.toBeInTheDocument();
  });

  it('준비 중 안건 카드는 비활성이고, 활성 안건 카드는 누를 수 있다', () => {
    render(<SelectScreen scenarios={scenarios} onEnter={vi.fn()} />);

    expect(screen.getByTestId(`scenario-card-${preparingScenario.id}`)).toBeDisabled();
    expect(screen.getByTestId(`scenario-card-${anonBoardScenario.id}`)).toBeEnabled();
  });

  it('카드를 선택하기 전에는 "이사회 입장" CTA가 비활성이고, 선택하면 활성화돼 onEnter를 호출한다', () => {
    const onEnter = vi.fn();
    render(<SelectScreen scenarios={scenarios} onEnter={onEnter} />);

    const cta = screen.getByRole('button', { name: '이사회 입장 ▶' });
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByTestId(`scenario-card-${anonBoardScenario.id}`));
    expect(cta).toBeEnabled();

    fireEvent.click(cta);
    expect(onEnter).toHaveBeenCalledWith(anonBoardScenario.id);
  });
});
