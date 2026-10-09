// 진행 도우미(화면 사용법 안내, T103·T104): 말풍선 그리기, 화면별 한 번만, 첫 조작·알겠어요로 닫힘.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Coach, CoachIcon } from '../../src/components/parts/Coach';
import { CoachHost } from '../../src/components/parts/CoachHost';
import { EMPTY_COACH_UI } from '../../src/domain/coach';
import { createInitialSession } from '../../src/domain/session';
import { COACH_SCREENS, coachCopy } from '../../src/content/coach';
import { findForbiddenWords } from '../../server/prompts/plainLanguage';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function sessionAt(stage: 'INTRO' | 'BRIEFING' | 'OPINIONS' | 'DISCUSS' | 'REACTIONS' | 'VOTE' | 'RESULT', patch = {}) {
  return { ...createInitialSession(0, 's'), stage, ...patch };
}

describe('coachCopy의 live 분기(PR #20 Codex 36차 검토 P2)', () => {
  it('반응 화면(4)은 live에서 바뀐 임원을 찾으라 하지 않고 지금 입장을 확인하라고 안내한다', () => {
    expect(coachCopy(4, 'scripted').lines.join(' ')).toContain('입장이 바뀐 임원');
    expect(coachCopy(4, 'live').lines.join(' ')).not.toContain('바뀐');
    expect(coachCopy(4, 'live').lines.join(' ')).toContain('지금 입장');
    expect(coachCopy(4).lines).toEqual(coachCopy(4, 'scripted').lines);
  });
  it('linesLive가 없는 화면은 live에서도 같은 문장을 쓴다', () => {
    expect(coachCopy(1, 'live').lines).toEqual(coachCopy(1, 'scripted').lines);
  });
});

describe('Coach', () => {
  it('머리에 "안내 N/6"과 제목·번호 목록을 그리고 알겠어요만 있다(건너뛰기 없음)', () => {
    render(<Coach step={3} total={6} title="제목" lines={['하나', '둘', '셋']} onAck={vi.fn()} />);
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('안내 3/6');
    expect(screen.getByTestId('coach-title')).toHaveTextContent('제목');
    expect(screen.getByTestId('coach-lines').tagName).toBe('OL');
    expect(screen.getByTestId('coach-lines').querySelectorAll('li')).toHaveLength(3);
    expect(screen.queryByTestId('coach-skip')).toBeNull();
  });

  it('줄이 하나면 번호 없이 한 문장으로 그린다', () => {
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={vi.fn()} />);
    expect(screen.getByTestId('coach-lines').tagName).toBe('P');
  });

  it('덮개·스포트라이트가 없고 카드 하나뿐이다', () => {
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={vi.fn()} />);
    expect(screen.queryByTestId('coach-dim')).toBeNull();
    expect(screen.queryByTestId('coach-spot')).toBeNull();
  });

  it('알겠어요를 누르면 onAck을 부른다', () => {
    const onAck = vi.fn();
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={onAck} />);
    fireEvent.click(screen.getByTestId('coach-ack'));
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it('무대 사진(stage-band) 위 왼쪽에 얹히고, 없으면 기본 자리에 둔다', () => {
    const band = document.createElement('div');
    band.setAttribute('data-testid', 'stage-band');
    band.getBoundingClientRect = () =>
      ({ left: 48, top: 73, width: 460, height: 258, right: 508, bottom: 331, x: 48, y: 73, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(band);
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={vi.fn()} />);
    const card = screen.getByTestId('coach');
    expect(card.style.left).toBe('60px');
    expect(card.style.top).toBe('85px');
  });
});

describe('CoachHost', () => {
  it('화면에 들어오면 그 화면 안내 하나를 그리고, 알겠어요가 COACH_DISMISS를 보낸다', () => {
    const dispatch = vi.fn();
    render(<CoachHost session={sessionAt('BRIEFING')} ui={EMPTY_COACH_UI} dispatch={dispatch} />);
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('안내 1/6');
    expect(screen.getByTestId('coach-title')).toHaveTextContent('상황을 읽고 자료를 열어 보세요');
    fireEvent.click(screen.getByTestId('coach-ack'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'COACH_DISMISS', step: 1 });
  });

  it('그 화면의 첫 조작(버튼 클릭)이 있으면 자동으로 닫는다', async () => {
    const dispatch = vi.fn();
    render(
      <>
        <button type="button">아무 버튼</button>
        <CoachHost session={sessionAt('DISCUSS')} ui={EMPTY_COACH_UI} dispatch={dispatch} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: '아무 버튼' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'COACH_DISMISS', step: 3 }));
  });

  it('말풍선 안 클릭·운영 메뉴·버튼이 아닌 곳 클릭은 조작으로 세지 않는다', async () => {
    const dispatch = vi.fn();
    render(
      <>
        <div data-testid="blank">빈 곳</div>
        <button type="button" className="operator-menu__trigger">운영</button>
        <CoachHost session={sessionAt('DISCUSS')} ui={EMPTY_COACH_UI} dispatch={dispatch} />
      </>,
    );
    fireEvent.click(screen.getByTestId('blank'));
    fireEvent.click(screen.getByTestId('coach-title'));
    fireEvent.click(screen.getByRole('button', { name: '운영' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('이미 본 화면·코치 꺼짐·다시 답하기(2/2)에는 그리지 않는다', () => {
    const { rerender } = render(
      <CoachHost session={sessionAt('OPINIONS', { coachDismissed: [2] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />,
    );
    expect(screen.queryByTestId('coach')).toBeNull();
    rerender(<CoachHost session={sessionAt('OPINIONS', { coachEnabled: false })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach')).toBeNull();
    rerender(<CoachHost session={sessionAt('REACTIONS')} ui={{ reactionsStep: 'answer' }} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach')).toBeNull();
    rerender(<CoachHost session={sessionAt('REACTIONS')} ui={{ reactionsStep: 'listen' }} dispatch={vi.fn()} />);
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('안내 4/6');
  });
});

describe('안내 아이콘(T106)', () => {
  it('이미 본 화면에는 말풍선 대신 "안내" 아이콘이 있고, 누르면 닫기 버튼이 있는 말풍선이 다시 열린다', () => {
    const dispatch = vi.fn();
    render(<CoachHost session={sessionAt('OPINIONS', { coachDismissed: [2] })} ui={EMPTY_COACH_UI} dispatch={dispatch} />);
    expect(screen.queryByTestId('coach')).toBeNull();
    const icon = screen.getByTestId('coach-icon');
    expect(icon).toHaveTextContent('안내');
    expect(icon).toHaveAttribute('aria-label', '안내 다시 보기, 끌어서 옮길 수 있음');
    fireEvent.click(icon);
    expect(screen.getByTestId('coach-progress')).toHaveTextContent('안내 2/6');
    expect(screen.getByTestId('coach-ack')).toHaveTextContent('닫기 ▶');
    expect(screen.queryByTestId('coach-icon')).toBeNull();
    fireEvent.click(screen.getByTestId('coach-ack'));
    expect(screen.queryByTestId('coach')).toBeNull();
    expect(screen.getByTestId('coach-icon')).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled(); // 세션에는 아무것도 기록하지 않는다
  });

  it('처음 자동으로 뜬 말풍선은 "알겠어요"이고 아이콘은 없다', () => {
    render(<CoachHost session={sessionAt('OPINIONS')} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.getByTestId('coach-ack')).toHaveTextContent('알겠어요 ▶');
    expect(screen.queryByTestId('coach-icon')).toBeNull();
  });

  it('다시 연 말풍선은 다른 버튼을 눌러도 닫히지 않고, Esc로 닫힌다', async () => {
    render(
      <>
        <button type="button">아무 버튼</button>
        <CoachHost session={sessionAt('DISCUSS', { coachDismissed: [3] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByTestId('coach-icon'));
    fireEvent.click(screen.getByRole('button', { name: '아무 버튼' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('coach')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('coach')).toBeNull());
    expect(screen.getByTestId('coach-icon')).toBeInTheDocument();
  });

  it('팝업(role=dialog)이 열려 있는 동안은 말풍선·아이콘을 그리지 않고, 닫히면 다시 연 안내가 돌아온다(Codex 44차)', async () => {
    const { rerender } = render(
      <CoachHost session={sessionAt('DISCUSS', { coachDismissed: [3] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('coach-icon'));
    expect(screen.getByTestId('coach')).toBeInTheDocument();
    // 팝업이 열리면(role=dialog가 DOM에 생기면) 코치는 통째로 사라진다 — 축소 모드의 transform
    // stacking context 때문에 z-index로는 팝업 위 노출을 막을 수 없다.
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    await waitFor(() => expect(screen.queryByTestId('coach')).toBeNull());
    expect(screen.queryByTestId('coach-icon')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    dialog.remove();
    // 팝업이 닫히면 다시 연 상태가 그대로라 말풍선이 돌아온다(Esc는 팝업이 썼다).
    await waitFor(() => expect(screen.getByTestId('coach')).toBeInTheDocument());
    rerender(<CoachHost session={sessionAt('DISCUSS', { coachDismissed: [3] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
  });

  it('화면이 바뀌면 다시 연 상태가 초기화되고, 코치가 꺼져 있거나 안내 없는 화면에는 아이콘이 없다', () => {
    const { rerender } = render(
      <CoachHost session={sessionAt('OPINIONS', { coachDismissed: [2, 3] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('coach-icon'));
    expect(screen.getByTestId('coach')).toBeInTheDocument();
    rerender(<CoachHost session={sessionAt('DISCUSS', { coachDismissed: [2, 3] })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach')).toBeNull();
    expect(screen.getByTestId('coach-icon')).toBeInTheDocument();
    rerender(<CoachHost session={sessionAt('DISCUSS', { coachEnabled: false })} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach-icon')).toBeNull();
    rerender(<CoachHost session={sessionAt('INTRO')} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach-icon')).toBeNull();
    rerender(<CoachHost session={sessionAt('REACTIONS', { coachDismissed: [4] })} ui={{ reactionsStep: 'answer' }} dispatch={vi.fn()} />);
    expect(screen.queryByTestId('coach-icon')).toBeNull();
  });
});

describe('코치 문구', () => {
  it('반응 화면(4)은 고민 중인 임원이 답해야 찬성으로 바뀐다고 한 줄 알려 준다(T110)', () => {
    expect(COACH_SCREENS.find((item) => item.step === 4)?.lines).toContain('고민 중인 임원은 답해야 찬성으로 바뀝니다.');
    expect(COACH_SCREENS.find((item) => item.step === 4)?.linesLive?.join(' ')).toContain('답해야');
  });

  it('6화면이 모두 있고 쉬운 말만 쓴다(2~4줄)', () => {
    expect(COACH_SCREENS.map((item) => item.step)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const item of COACH_SCREENS) {
      const all = [item.title, ...item.lines, ...(item.linesLive ?? [])].join(' ');
      expect(findForbiddenWords(all)).toEqual([]);
      expect(item.title).toMatch(/[가-힣]/);
      expect(all).not.toMatch(/(?<!AI )[A-Za-z]{3,}/);
      expect(item.lines.length).toBeGreaterThanOrEqual(2);
      expect(item.lines.length).toBeLessThanOrEqual(4);
      for (const key of item.keys) {
        expect(item.title).toContain(key);
      }
    }
  });
});

// T112: 끌어서 옮기기. jsdom은 PointerEvent의 좌표를 안 실어 주므로 MouseEvent 기반으로 대신한다.
describe('코치 끌어서 옮기기(T112)', () => {
  function pointer(type: string, target: Element, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    fireEvent(target, event);
  }
  function drag(target: Element, from: [number, number], to: [number, number]) {
    pointer('pointerdown', target, ...from);
    pointer('pointermove', target, ...to);
    pointer('pointerup', target, ...to);
  }
  function left(el: HTMLElement) {
    return parseFloat(el.style.left);
  }
  function top(el: HTMLElement) {
    return parseFloat(el.style.top);
  }
  afterEach(() => window.sessionStorage.clear());

  it('말풍선 머리를 끌면 따라 움직이고, 비율로 sessionStorage에 저장된다', () => {
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={vi.fn()} />);
    const card = screen.getByTestId('coach');
    const startLeft = left(card);
    const startTop = top(card);
    drag(screen.getByTestId('coach-head'), [100, 100], [220, 160]);
    expect(left(card)).toBe(startLeft + 120);
    expect(top(card)).toBe(startTop + 60);
    const saved = JSON.parse(window.sessionStorage.getItem('coach-pos')!);
    expect(saved.x).toBeCloseTo(left(card) / window.innerWidth);
    expect(saved.y).toBeCloseTo(top(card) / window.innerHeight);
  });

  it('4px 미만 움직임은 클릭이다 — 아이콘이 열리고 자리는 그대로다', () => {
    const onOpen = vi.fn();
    render(<CoachIcon onOpen={onOpen} />);
    const icon = screen.getByTestId('coach-icon');
    const startLeft = left(icon);
    drag(icon, [50, 50], [52, 52]);
    fireEvent.click(icon);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(left(icon)).toBe(startLeft);
    expect(window.sessionStorage.getItem('coach-pos')).toBeNull();
  });

  it('끌어서 옮긴 직후의 click은 열기로 세지 않는다', async () => {
    const onOpen = vi.fn();
    render(<CoachIcon onOpen={onOpen} />);
    const icon = screen.getByTestId('coach-icon');
    drag(icon, [50, 50], [150, 150]);
    fireEvent.click(icon);
    expect(onOpen).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 5));
    fireEvent.click(icon);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('화면 밖으로는 나가지 않는다(여백 8px)', () => {
    render(<CoachIcon onOpen={vi.fn()} />);
    const icon = screen.getByTestId('coach-icon');
    drag(icon, [50, 50], [-5000, -5000]);
    expect(left(icon)).toBe(8);
    expect(top(icon)).toBe(8);
    drag(icon, [50, 50], [9000, 9000]);
    expect(left(icon)).toBe(window.innerWidth - 8); // jsdom은 요소 크기가 0이다.
    expect(top(icon)).toBe(window.innerHeight - 8);
  });

  it('저장된 자리는 말풍선↔아이콘이 바뀌어도 복원된다', () => {
    window.sessionStorage.setItem('coach-pos', JSON.stringify({ x: 0.25, y: 0.5 }));
    const { unmount } = render(<CoachIcon onOpen={vi.fn()} />);
    expect(left(screen.getByTestId('coach-icon'))).toBe(window.innerWidth * 0.25);
    unmount();
    render(<Coach step={1} total={6} title="제목" lines={['한 줄']} onAck={vi.fn()} />);
    const card = screen.getByTestId('coach');
    expect(left(card)).toBe(window.innerWidth * 0.25);
    expect(top(card)).toBe(window.innerHeight * 0.5);
  });

  it('저장소가 막혀 있어도 끌 수 있다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<CoachIcon onOpen={vi.fn()} />);
    const icon = screen.getByTestId('coach-icon');
    const startLeft = left(icon);
    expect(() => drag(icon, [10, 10], [60, 10])).not.toThrow();
    expect(left(icon)).toBe(startLeft + 50);
    spy.mockRestore();
  });

  it('아이콘을 두 번 빠르게 누르면 기본 자리로 돌아가고 저장도 지운다', () => {
    render(<CoachIcon onOpen={vi.fn()} />);
    const icon = screen.getByTestId('coach-icon');
    const startLeft = left(icon);
    drag(icon, [10, 10], [200, 10]);
    expect(left(icon)).not.toBe(startLeft);
    fireEvent.doubleClick(icon);
    expect(left(icon)).toBe(startLeft);
    expect(window.sessionStorage.getItem('coach-pos')).toBeNull();
  });

  it('아이콘에 포커스한 뒤 화살표로 16px씩 움직인다', () => {
    render(<CoachIcon onOpen={vi.fn()} />);
    const icon = screen.getByTestId('coach-icon');
    const startLeft = left(icon);
    const startTop = top(icon);
    fireEvent.keyDown(icon, { key: 'ArrowRight' });
    expect(left(icon)).toBe(startLeft + 16);
    fireEvent.keyDown(icon, { key: 'ArrowDown' });
    expect(top(icon)).toBe(startTop + 16);
    fireEvent.keyDown(icon, { key: 'ArrowLeft' });
    fireEvent.keyDown(icon, { key: 'ArrowLeft' });
    expect(left(icon)).toBe(startLeft - 16);
  });

  it('새 체험(sessionId 변경)이면 옮긴 자리를 지운다', () => {
    const session = sessionAt('BRIEFING', { coachDismissed: [1] });
    const { rerender } = render(<CoachHost session={session} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    window.sessionStorage.setItem('coach-pos', JSON.stringify({ x: 0.3, y: 0.3 }));
    rerender(<CoachHost session={{ ...session, sessionId: 'next' }} ui={EMPTY_COACH_UI} dispatch={vi.fn()} />);
    expect(window.sessionStorage.getItem('coach-pos')).toBeNull();
  });
});
