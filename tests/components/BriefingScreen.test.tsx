// BriefingScreen(T86, 2026-10-07 사용자 — "예전처럼 버튼으로"): 자료 4장은 팝업 없이는
// 보이지 않고, "근거 자료 보기" 버튼을 눌러야 EvidenceDialog 팝업 안에 전문
// (evidence-card-<id>)으로 나타난다. DiscussScreen·ReactionsScreen과 같은 패턴이다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BriefingScreen } from '../../src/components/screens/BriefingScreen';
import { anonBoardScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

describe('BriefingScreen', () => {
  it('근거 자료 보기 버튼은 있고, 팝업 전문 카드는 누르기 전에는 없다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    expect(screen.getByTestId('open-evidence')).toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }
  });

  it('"근거 자료 보기"를 누르면 팝업에 자료 4장이 전문으로 나타난다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));

    expect(screen.getByTestId('evidence-dialog')).toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.getByTestId(`evidence-card-${card.id}`)).toBeInTheDocument();
    }
  });

  it('팝업 닫기 버튼을 누르면 전문 카드가 사라진다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    fireEvent.click(screen.getByTestId('open-evidence'));
    fireEvent.click(screen.getByTestId('evidence-dialog-close'));

    expect(screen.queryByTestId('evidence-dialog')).not.toBeInTheDocument();
    for (const card of anonBoardScenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }
  });

  // T81(2026-10-07): 시안의 마지막 UNKNOWN 항목 먹칠을 제거했다 — 모든 미정 항목이
  // 가려지지 않은 평문으로 보이고, 먹칠용 클래스·aria-label은 남지 않는다.
  it('UNKNOWN 항목은 전부 평문으로 보이고 먹칠 요소가 없다', () => {
    render(<BriefingScreen scenario={anonBoardScenario} onNext={vi.fn()} />);
    const items = anonBoardScenario.motionBreakdown.undecidedItems.map((item) => item.text);
    const line = screen.getByText(items.join(' · '), { selector: '.briefing-screen__undecided-muted' });
    expect(line).toBeInTheDocument();
    expect(document.querySelector('.briefing-screen__undecided-redacted')).toBeNull();
    expect(document.querySelector('[aria-label*="먹칠"]')).toBeNull();
  });
});
