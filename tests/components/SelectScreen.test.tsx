// SelectScreen(T70, docs/design/mockups/S1_Select.html 시안대로): 카드 제목은
// chairBriefing.question(안건 질문 한 줄)만 쓰고 headline·hook·subtitle은 쓰지
// 않는다. 준비 중 안건은 비활성(disabled)이고, 활성 안건을 선택해야 "이사회 입장"
// CTA가 눌린다.
// T78(2026-10-02, 안건 교체): 레지스트리의 두 카드(ai-approval·experience-first)가
// 모두 active라 실제 "준비 중" 카드가 없다 — 그 분기(status: 'preparing')는
// SelectScreen에 그대로 남아 있으므로, 이 파일 안에서만 쓰는 최소 시나리오로 따로
// 확인한다(레지스트리를 건드리지 않는다).
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectScreen } from '../../src/components/screens/SelectScreen';
import { scenarios, aiApprovalScenario } from '../../src/content/scenarios';
import type { Scenario } from '../../src/content/types';

afterEach(() => {
  cleanup();
});

/** status:'preparing' 분기만 확인하기 위한 최소 시나리오(실제 레지스트리에는 없다). */
function preparingScenario(): Scenario {
  return {
    ...aiApprovalScenario,
    id: 'preparing-fixture',
    chairBriefing: { ...aiApprovalScenario.chairBriefing, question: '다음 안건' },
    status: 'preparing',
  };
}

describe('SelectScreen', () => {
  it('카드에는 chairBriefing.question과 사건 한 줄(headline)만 보이고 hook·subtitle은 보이지 않는다(T84 #10)', () => {
    render(<SelectScreen scenarios={scenarios} onEnter={vi.fn()} />);

    const card = screen.getByTestId(`scenario-card-${aiApprovalScenario.id}`);
    expect(card).toHaveTextContent(aiApprovalScenario.chairBriefing.question);
    expect(card).toHaveTextContent(aiApprovalScenario.incident.headline);
    expect(screen.queryByText(aiApprovalScenario.incident.hook)).not.toBeInTheDocument();
    expect(screen.queryByText(aiApprovalScenario.subtitle)).not.toBeInTheDocument();
  });

  it('두 활성 안건 카드가 모두 눌릴 수 있다', () => {
    render(<SelectScreen scenarios={scenarios} onEnter={vi.fn()} />);

    for (const scenario of scenarios) {
      expect(screen.getByTestId(`scenario-card-${scenario.id}`)).toBeEnabled();
    }
  });

  it('준비 중(status: "preparing") 안건 카드는 비활성이다', () => {
    const mixed = [...scenarios, preparingScenario()];
    render(<SelectScreen scenarios={mixed} onEnter={vi.fn()} />);

    expect(screen.getByTestId('scenario-card-preparing-fixture')).toBeDisabled();
    expect(screen.getByTestId(`scenario-card-${aiApprovalScenario.id}`)).toBeEnabled();
  });

  it('카드를 누르면 바로 onEnter가 불리고, 이후 모든 카드가 잠겨 중복 입장을 막는다(T84 #10)', () => {
    const onEnter = vi.fn();
    render(<SelectScreen scenarios={scenarios} onEnter={onEnter} />);

    expect(screen.queryByRole('button', { name: '이사회 입장 ▶' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`scenario-card-${aiApprovalScenario.id}`));
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith(aiApprovalScenario.id);

    for (const scenario of scenarios) {
      expect(screen.getByTestId(`scenario-card-${scenario.id}`)).toBeDisabled();
    }
    fireEvent.click(screen.getByTestId(`scenario-card-${scenarios[1]!.id}`));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
