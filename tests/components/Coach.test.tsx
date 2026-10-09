// 진행 도우미(화면 사용법 안내, T103·T104): 말풍선 그리기, 화면별 한 번만, 첫 조작·알겠어요로 닫힘.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Coach } from '../../src/components/parts/Coach';
import { CoachHost } from '../../src/components/parts/CoachHost';
import { EMPTY_COACH_UI } from '../../src/domain/coach';
import { createInitialSession } from '../../src/domain/session';
import { COACH_SCREENS, coachCopy } from '../../src/content/coach';
import { findForbiddenWords } from '../../server/prompts/plainLanguage';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function sessionAt(stage: 'BRIEFING' | 'OPINIONS' | 'DISCUSS' | 'REACTIONS' | 'VOTE' | 'RESULT', patch = {}) {
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

describe('코치 문구', () => {
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
