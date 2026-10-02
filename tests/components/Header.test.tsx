// Header.tsx 단위 테스트(T67, 2026-09-30 사용자 요청): 참가자 명패·단계 이름 칩을
// 없애고 진행 스트립을 헤더 한 줄 가운데로 올렸는지 확인한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Header } from '../../src/components/parts/Header';
import { createInitialSession } from '../../src/domain/session';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('ATTRACT에서는 명패·단계 이름 칩이 없고 헤더 가운데(진행 스트립)도 비어 있다', () => {
    const session = createInitialSession(0, 'session-attract');
    render(<Header session={session} scenario={null} onOperatorReset={vi.fn()} />);

    expect(screen.queryByTestId('nameplate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-strip')).not.toBeInTheDocument();
    expect(document.querySelector('.app-header__stage')).not.toBeInTheDocument();
    // 좌·우 구역은 그대로 남는다.
    expect(screen.getByText('BOARDROOM 2026')).toBeInTheDocument();
    expect(screen.getByTestId('mode-badge')).toBeInTheDocument();
  });

  it('진행 단계(BRIEFING 등)에서는 명패·단계 칩 없이 진행 스트립이 헤더 안에 나온다', () => {
    const session = { ...createInitialSession(0, 'session-briefing'), stage: 'BRIEFING' as const };
    render(<Header session={session} scenario={aiApprovalScenario} onOperatorReset={vi.fn()} />);

    expect(screen.queryByTestId('nameplate')).not.toBeInTheDocument();
    expect(document.querySelector('.app-header__stage')).not.toBeInTheDocument();

    const header = document.querySelector('.app-header');
    const strip = screen.getByTestId('progress-strip');
    expect(header).not.toBeNull();
    // 스트립이 헤더 요소의 자손으로 렌더된다(본문이 아니라 헤더 한 줄 안).
    expect(header!.contains(strip)).toBe(true);
    expect(screen.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');
  });

  // T78(2026-10-02, 안건 교체): 케이스 번호가 세션의 안건 caseLabel을 따르고, 안건이
  // 아직 없으면(ATTRACT·SELECT) "No. --"를 보인다(시안 Main.html 형식 유지).
  it('케이스 번호가 안건 caseLabel(01/02)을 따르고, 안건이 없으면 "No. --"를 보인다', () => {
    const session = createInitialSession(0, 'session-case');

    const { rerender } = render(
      <Header session={session} scenario={null} onOperatorReset={vi.fn()} />,
    );
    expect(document.querySelector('.app-header__case-file')).toHaveTextContent('CASE FILE No. --');

    rerender(<Header session={session} scenario={aiApprovalScenario} onOperatorReset={vi.fn()} />);
    expect(document.querySelector('.app-header__case-file')).toHaveTextContent('CASE FILE No. 01');

    rerender(
      <Header session={session} scenario={experienceFirstScenario} onOperatorReset={vi.fn()} />,
    );
    expect(document.querySelector('.app-header__case-file')).toHaveTextContent('CASE FILE No. 02');
  });
});
