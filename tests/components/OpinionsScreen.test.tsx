// OpinionsScreen(T95, 2026-10-08 사용자 — "필수로 보고 넘어가도록"): scripted 카드
// 4장은 0.8초 간격으로 차례로 나타나고, 다 나올 때까지 "내 의견 쓰러 가기 ▶"를 잠근다.
// prefers-reduced-motion이면 즉시 다 보여준다. live는 기존 roleStatus 기반 잠금을
// 그대로 쓴다(이 카드가 손대지 않은 동작, 다른 테스트에서 이미 확인).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { OpinionsScreen } from '../../src/components/screens/OpinionsScreen';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { scriptedStances } from '../../src/domain/stance';
import { EXEC_MEMBER_ORDER } from '../../src/domain/voting';
import type { RoleStatus } from '../../src/domain/types';

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const idleRoleStatus: Record<string, RoleStatus> = {
  CEO: 'idle',
  CFO: 'idle',
  CAIO: 'idle',
  CISO: 'idle',
};

const stances = scriptedStances(anonBoardScenario, { stage: 'OPINIONS', opinions: [] });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OpinionsScreen(scripted) 순차 노출', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    vi.useFakeTimers();
  });

  it('카드가 0.8초 간격으로 하나씩 나타나고, 다 나오기 전에는 CTA가 잠긴다', () => {
    render(
      <OpinionsScreen
        scenario={anonBoardScenario}
        mode="scripted"
        roleStatus={idleRoleStatus as Record<(typeof EXEC_MEMBER_ORDER)[number], RoleStatus>}
        statements={[]}
        stances={stances}
        onNext={vi.fn()}
      />,
    );

    const nextButton = screen.getByTestId('opinions-next');
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveAccessibleDescription('임원 의견이 다 나오면 열립니다');
    expect(document.querySelector('[data-coach="opinion-cards"]')).not.toBeNull();
    expect(document.querySelectorAll('.opinion-card')).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(document.querySelectorAll('.opinion-card')).toHaveLength(1);
    expect(nextButton).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(800 * 3);
    });
    expect(document.querySelectorAll('.opinion-card')).toHaveLength(
      anonBoardScenario.initialOpinions.length,
    );
    expect(nextButton).toBeEnabled();
    expect(document.querySelector('[data-guide]')).toBeNull();
  });
});

describe('OpinionsScreen(scripted) prefers-reduced-motion', () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it('카드가 즉시 모두 나타나고 CTA가 바로 활성이다', () => {
    render(
      <OpinionsScreen
        scenario={anonBoardScenario}
        mode="scripted"
        roleStatus={idleRoleStatus as Record<(typeof EXEC_MEMBER_ORDER)[number], RoleStatus>}
        statements={[]}
        stances={stances}
        onNext={vi.fn()}
      />,
    );

    expect(document.querySelectorAll('.opinion-card')).toHaveLength(
      anonBoardScenario.initialOpinions.length,
    );
    expect(screen.getByTestId('opinions-next')).toBeEnabled();
  });
});
