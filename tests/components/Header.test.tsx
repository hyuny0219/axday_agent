// Header.tsx 단위 테스트(T67, 2026-09-30 사용자 요청): 참가자 명패·단계 이름 칩을
// 없애고 진행 스트립을 헤더 한 줄 가운데로 올렸는지 확인한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Header } from '../../src/components/parts/Header';
import { createInitialSession } from '../../src/domain/session';

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('ATTRACT에서는 명패·단계 이름 칩이 없고 헤더 가운데(진행 스트립)도 비어 있다', () => {
    const session = createInitialSession(0, 'session-attract');
    render(<Header session={session} onOperatorReset={vi.fn()} />);

    expect(screen.queryByTestId('nameplate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-strip')).not.toBeInTheDocument();
    expect(document.querySelector('.app-header__stage')).not.toBeInTheDocument();
    // 좌·우 구역은 그대로 남는다.
    expect(screen.getByText('BOARDROOM 2026')).toBeInTheDocument();
    expect(screen.getByTestId('mode-badge')).toBeInTheDocument();
  });

  it('진행 단계(BRIEFING 등)에서는 명패·단계 칩 없이 진행 스트립이 헤더 안에 나온다', () => {
    const session = { ...createInitialSession(0, 'session-briefing'), stage: 'BRIEFING' as const };
    render(<Header session={session} onOperatorReset={vi.fn()} />);

    expect(screen.queryByTestId('nameplate')).not.toBeInTheDocument();
    expect(document.querySelector('.app-header__stage')).not.toBeInTheDocument();

    const header = document.querySelector('.app-header');
    const strip = screen.getByTestId('progress-strip');
    expect(header).not.toBeNull();
    // 스트립이 헤더 요소의 자손으로 렌더된다(본문이 아니라 헤더 한 줄 안).
    expect(header!.contains(strip)).toBe(true);
    expect(screen.getByTestId('progress-step-1')).toHaveAttribute('aria-current', 'step');
  });
});
