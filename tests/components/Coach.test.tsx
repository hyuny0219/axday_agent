// 진행 도우미 말풍선 + 스포트라이트(T103).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Coach, placeBubble } from '../../src/components/parts/Coach';
import { CoachHost } from '../../src/components/parts/CoachHost';
import { EMPTY_COACH_UI } from '../../src/domain/coach';
import { createInitialSession } from '../../src/domain/session';
import { COACH_STEPS } from '../../src/content/coach';
import { findForbiddenWords } from '../../server/prompts/plainLanguage';

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function addTarget(name: string, rect = { left: 400, top: 200, width: 200, height: 80 }): HTMLElement {
  const el = document.createElement('button');
  el.setAttribute('data-coach', name);
  el.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  mockMatchMedia(false);
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function renderCoach(extra: Partial<React.ComponentProps<typeof Coach>> = {}) {
  const onSkip = vi.fn();
  const onAck = vi.fn();
  render(
    <Coach
      step={2}
      total={9}
      targetSelector="[data-coach='t']"
      title="제목"
      body="보조 문장"
      placement="left"
      onSkip={onSkip}
      {...extra}
    />,
  );
  return { onSkip, onAck };
}

describe('Coach', () => {
  it('머리에 "진행 도우미 · N/9"와 제목·보조 문장을 그린다', () => {
    addTarget('t');
    renderCoach();
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('진행 도우미 · 2/9');
    expect(screen.getByTestId('coach-title')).toHaveTextContent('제목');
    expect(screen.getByTestId('coach-bubble')).toHaveTextContent('보조 문장');
    expect(screen.getByTestId('coach-spot')).toBeInTheDocument();
  });

  it('대상이 없으면 아무것도 그리지 않는다', () => {
    renderCoach();
    expect(screen.queryByTestId('coach')).toBeNull();
  });

  it('스포트라이트는 대상 둘레(4px 여유)에 놓이고, 어두운 덮개가 그 자리를 비워 둔다', () => {
    addTarget('t', { left: 400, top: 200, width: 200, height: 80 });
    renderCoach();
    const spot = screen.getByTestId('coach-spot');
    expect(spot).toHaveStyle({ left: '396px', top: '196px', width: '208px', height: '88px' });
    // 어두운 덮개는 한 장이고 대상 자리가 구멍으로 비어 있다(구멍 안은 클릭도 통과).
    expect(document.querySelectorAll('.coach__dim')).toHaveLength(1);
    expect(screen.getByTestId('coach-dim')).toHaveAttribute('data-holes', '396,196,208,88');
  });

  it('"건너뛰기"와 Esc는 onSkip을 부른다', () => {
    addTarget('t');
    const { onSkip } = renderCoach();
    fireEvent.click(screen.getByTestId('coach-skip'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('onAck가 있을 때만 "알겠어요 ▶"를 그리고, 누르면 onAck을 부른다', () => {
    addTarget('t');
    const onAck = vi.fn();
    const { rerender } = render(
      <Coach step={2} total={9} targetSelector="[data-coach='t']" title="제목" body="b" placement="left" onSkip={vi.fn()} />,
    );
    expect(screen.queryByTestId('coach-ack')).toBeNull();
    rerender(
      <Coach step={2} total={9} targetSelector="[data-coach='t']" title="제목" body="b" placement="left" onSkip={vi.fn()} onAck={onAck} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '알겠어요 ▶' }));
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it('dim(팝업 안)이면 coach--dialog 클래스를 쓴다', () => {
    addTarget('t');
    renderCoach({ dim: true });
    expect(screen.getByTestId('coach')).toHaveClass('coach--dialog');
  });

  it('prefers-reduced-motion이면 data-motion이 none이다', () => {
    mockMatchMedia(true);
    addTarget('t');
    renderCoach();
    expect(screen.getByTestId('coach')).toHaveAttribute('data-motion', 'none');
  });

  it('보통 환경에서는 data-motion이 normal이다', () => {
    addTarget('t');
    renderCoach();
    expect(screen.getByTestId('coach')).toHaveAttribute('data-motion', 'normal');
  });

  it('대상이 나중에 나타나도 따라가서 그린다', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      renderCoach();
      expect(screen.queryByTestId('coach')).toBeNull();
      addTarget('t');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByTestId('coach')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Coach 운영 메뉴 예외', () => {
  it('운영 버튼 자리는 어둡게 덮지 않는 구멍으로 더한다', () => {
    addTarget('t', { left: 400, top: 200, width: 200, height: 80 });
    const trigger = document.createElement('button');
    trigger.className = 'operator-menu__trigger';
    trigger.getBoundingClientRect = () =>
      ({ left: 1200, top: 8, width: 56, height: 40, right: 1256, bottom: 48, x: 1200, y: 8, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(trigger);
    renderCoach();
    expect(screen.getByTestId('coach-dim')).toHaveAttribute(
      'data-holes',
      '396,196,208,88;1200,8,56,40',
    );
  });
});

describe('placeBubble', () => {
  const view = { width: 1280, height: 720 };
  const size = { width: 320, height: 200 };

  it('원하는 방향에 들어가면 그대로 쓴다', () => {
    const placed = placeBubble({ left: 700, top: 300, width: 200, height: 80 }, size, 'left', view);
    expect(placed.side).toBe('left');
    expect(placed.left + size.width).toBeLessThanOrEqual(700);
  });

  it('원하는 방향에 안 들어가면 반대편으로 옮긴다', () => {
    const placed = placeBubble({ left: 100, top: 300, width: 200, height: 80 }, size, 'left', view);
    expect(placed.side).toBe('right');
  });

  it('어떤 경우에도 화면 안(12px 여백)에 둔다', () => {
    const cases = [
      { left: 0, top: 0, width: 1280, height: 720 },
      { left: 1200, top: 650, width: 70, height: 60 },
      { left: 5, top: 5, width: 50, height: 40 },
    ];
    for (const spot of cases) {
      for (const p of ['left', 'right', 'above', 'below'] as const) {
        const placed = placeBubble(spot, size, p, view);
        expect(placed.left).toBeGreaterThanOrEqual(12);
        expect(placed.top).toBeGreaterThanOrEqual(12);
        expect(placed.left + size.width).toBeLessThanOrEqual(view.width - 12);
        expect(placed.top + size.height).toBeLessThanOrEqual(view.height - 12);
      }
    }
  });
});

describe('CoachHost', () => {
  it('읽기 단계에서 "알겠어요"를 누르면 COACH_DISMISS를 보낸다', () => {
    addTarget('opinion-cards');
    const dispatch = vi.fn();
    const session = { ...createInitialSession(0, 's'), stage: 'OPINIONS' as const };
    render(<CoachHost session={session} ui={EMPTY_COACH_UI} dispatch={dispatch} />);
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('2/9');
    fireEvent.click(screen.getByTestId('coach-ack'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'COACH_DISMISS', step: 2 });
  });

  it('건너뛰기는 이 화면의 남은 단계를 모두 기록한다(DISCUSS 3~6)', () => {
    addTarget('side-select');
    const dispatch = vi.fn();
    const session = { ...createInitialSession(0, 's'), stage: 'DISCUSS' as const };
    render(<CoachHost session={session} ui={EMPTY_COACH_UI} dispatch={dispatch} />);
    fireEvent.click(screen.getByTestId('coach-skip'));
    expect(dispatch.mock.calls.map((call) => call[0].step)).toEqual([3, 4, 5, 6]);
  });

  it('이미 끝난 단계는 화면에 그리지 않고 기록만 한다', () => {
    addTarget('side-select');
    const dispatch = vi.fn();
    const session = { ...createInitialSession(0, 's'), stage: 'DISCUSS' as const };
    render(<CoachHost session={session} ui={{ ...EMPTY_COACH_UI, side: 'FOR' }} dispatch={dispatch} />);
    expect(screen.queryByTestId('coach')).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: 'COACH_DISMISS', step: 3 });
  });

  it('코치가 꺼져 있으면 그리지 않는다', () => {
    addTarget('opinion-cards');
    const session = { ...createInitialSession(0, 's'), stage: 'OPINIONS' as const, coachEnabled: false };
    render(<CoachHost session={session} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach')).toBeNull();
  });

  it('근거 자료 팝업이 열려 있는 동안 1단계 말풍선을 숨긴다', () => {
    addTarget('evidence-open');
    const session = { ...createInitialSession(0, 's'), stage: 'BRIEFING' as const };
    const { rerender } = render(<CoachHost session={session} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.getByTestId('coach')).toBeInTheDocument();
    rerender(<CoachHost session={session} ui={{ ...EMPTY_COACH_UI, evidenceOpen: true }} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach')).toBeNull();
  });

  it('5단계는 팝업 안에서 어둡기가 낮은 coach--dialog로 그린다', () => {
    addTarget('assistant-next');
    const session = { ...createInitialSession(0, 's'), stage: 'DISCUSS' as const, coachDismissed: [3, 4] };
    render(
      <CoachHost
        session={session}
        ui={{ ...EMPTY_COACH_UI, side: 'FOR', draftReady: true, assistantOpen: true, assistantUsedCount: 1 }}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByTestId('coach')).toHaveClass('coach--dialog');
    expect(screen.getByTestId('coach-title')).toHaveTextContent('세 가지를 한 번씩 눌러 보세요');
  });
});

describe('코치 문구', () => {
  it('9단계가 모두 있고 쉬운 말만 쓴다', () => {
    expect(COACH_STEPS.map((item) => item.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const item of COACH_STEPS) {
      expect(findForbiddenWords(`${item.title} ${item.body}`)).toEqual([]);
      expect(item.title).toMatch(/[가-힣]/);
      expect(`${item.title}${item.body}`).not.toMatch(/(?<!AI )[A-Za-z]{3,}/);
      for (const key of item.keys) {
        expect(item.title).toContain(key);
      }
    }
  });
});
