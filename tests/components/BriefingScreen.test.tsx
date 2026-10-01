// BriefingScreen(T68): 자료 카드는 팝업을 열기 전에는 DOM에 없고, "근거 자료 보기"를
// 누르면 4장이 나타난다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BriefingScreen } from '../../src/components/screens/BriefingScreen';
import { anonBoardScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

describe('BriefingScreen', () => {
  it('팝업을 열기 전에는 evidence-card가 없고 "근거 자료 보기" 버튼만 보인다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    for (const card of anonBoardScenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('open-evidence')).toBeInTheDocument();
  });

  it('"근거 자료 보기"를 누르면 팝업에 자료 4장이 나타난다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));

    expect(screen.getByTestId('evidence-dialog')).toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.getByTestId(`evidence-card-${card.id}`)).toBeInTheDocument();
    }
  });

  it('팝업 닫기 버튼을 누르면 자료 카드가 다시 사라진다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));
    fireEvent.click(screen.getByTestId('evidence-dialog-close'));

    expect(screen.queryByTestId('evidence-dialog')).not.toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }
  });
});
