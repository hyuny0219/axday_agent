// BriefingScreen(T80, Main.html 시안 그대로): EXHIBIT 2×2 요약 카드(evidence-summary-<id>)는
// 팝업 없이 항상 보이고, 팝업 전용 전문 카드(evidence-card-<id>)는 "전문 보기"를 눌러야
// 나타난다 — 두 testid가 서로 다르므로 팝업이 열려도 배경 요약 카드와 겹치지 않는다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BriefingScreen } from '../../src/components/screens/BriefingScreen';
import { anonBoardScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

describe('BriefingScreen', () => {
  it('EXHIBIT 요약 카드 4장은 항상 보이고, 팝업 전문 카드는 "전문 보기" 전에는 없다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    for (const card of anonBoardScenario.evidence) {
      expect(screen.getByTestId(`evidence-summary-${card.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('open-evidence')).toBeInTheDocument();
  });

  it('"전문 보기"를 누르면 팝업에 자료 4장이 전문으로 나타나고, 배경 요약 카드도 그대로 남는다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));

    expect(screen.getByTestId('evidence-dialog')).toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.getByTestId(`evidence-card-${card.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`evidence-summary-${card.id}`)).toBeInTheDocument();
    }
  });

  it('팝업 닫기 버튼을 누르면 전문 카드만 사라지고 요약 카드는 남는다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));
    fireEvent.click(screen.getByTestId('evidence-dialog-close'));

    expect(screen.queryByTestId('evidence-dialog')).not.toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`evidence-summary-${card.id}`)).toBeInTheDocument();
    }
  });
});
