// BriefingScreen(T86, 2026-10-07 사용자 — "예전처럼 버튼으로"): 자료 4장은 팝업 없이는
// 보이지 않고, "근거 자료 보기" 버튼을 눌러야 EvidenceDialog 팝업 안에 전문
// (evidence-card-<id>)으로 나타난다. DiscussScreen·ReactionsScreen과 같은 패턴이다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BriefingScreen } from '../../src/components/screens/BriefingScreen';
import { anonBoardScenario } from '../../src/content/scenarios';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';

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

  // T95(2026-10-08 사용자 — "필수로 보고 넘어가도록 버튼 활성/비활성"): 자료 팝업을
  // 한 번 열어 닫기 전까지 "의견 듣기 ▶"는 눌러도 onNext가 불리지 않는다.
  it('근거 자료를 열어 닫기 전에는 "의견 듣기"가 비활성이고, onNext를 부르지 않는다', () => {
    const onNext = vi.fn();
    render(<BriefingScreen scenario={anonBoardScenario} onNext={onNext} />);
    const nextButton = screen.getByRole('button', { name: '의견 듣기 ▶' });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveAccessibleDescription('근거 자료를 먼저 확인해 주세요');
    expect(screen.getByTestId('open-evidence')).toHaveAttribute('data-coach', 'evidence-open');

    fireEvent.click(nextButton);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('근거 자료를 한 번 열어 닫으면 "의견 듣기"가 활성화된다', () => {
    const onNext = vi.fn();
    render(<BriefingScreen scenario={anonBoardScenario} onNext={onNext} />);
    fireEvent.click(screen.getByTestId('open-evidence'));
    fireEvent.click(screen.getByTestId('evidence-dialog-close'));

    const nextButton = screen.getByRole('button', { name: '의견 듣기 ▶' });
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);
    expect(onNext).toHaveBeenCalledTimes(1);
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

  it('핵심 말이 mark로 강조되고, 제목(h2)에는 쓰이지 않는다(T99)', () => {
    const { container } = render(<BriefingScreen scenario={aiApprovalScenario} onNext={vi.fn()} />);
    const status = screen.getByTestId('briefing-status');
    const marked = Array.from(status.querySelectorAll('mark.key-term')).map((m) => m.textContent);
    expect(marked).toEqual(expect.arrayContaining(['하루 수십 건', 'AI 에이전트가 직접 승인', '금액 한도']));
    expect(container.querySelector('h2 mark')).toBeNull();
    // 문장은 그대로 읽힌다(강조 때문에 글자가 바뀌지 않는다).
    expect(status).toHaveTextContent(aiApprovalScenario.chairBriefing.situation);
  });

  it('상황·제안·미정 줄 클래스가 유지된다(글자 크기는 briefing.css가 정한다)', () => {
    const { container } = render(<BriefingScreen scenario={experienceFirstScenario} onNext={vi.fn()} />);
    for (const cls of ['situation', 'proposal', 'undecided']) {
      expect(container.querySelector(`.briefing-screen__${cls}`)).not.toBeNull();
    }
  });
});
