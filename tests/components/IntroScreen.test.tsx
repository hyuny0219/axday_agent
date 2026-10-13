// IntroScreen(T95, 2026-10-08 사용자 — "첫 페이지 다음, 안건 선택 전에 게임의 목적과
// 어떻게 해야 성공하는지 소개 한 장"): 목적·진행 5단계·성공 기준·팁을 보여주고
// "안건 고르러 가기 ▶"를 누르면 onNext를 부른다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { findForbiddenWords } from '../../server/prompts/plainLanguage';
import { IntroScreen } from '../../src/components/screens/IntroScreen';

afterEach(() => {
  cleanup();
});

describe('IntroScreen', () => {
  const noop = () => undefined;

  it('목적·성공 기준만 보여 주고 진행 5단계는 없다(T103, 팁 카드는 T125)', () => {
    render(<IntroScreen onStart={noop} />);

    expect(screen.getByRole('heading', { name: '오늘 이사님은 특별 이사입니다' })).toBeInTheDocument();
    const purposes = Array.from(document.querySelectorAll('.intro-screen__purpose')).map((el) => el.textContent);
    expect(purposes).toEqual(['AI 임원 네 명과 안건을 두고 토론하고,', '마지막에 찬성·반대 중 하나를 골라 한 표를 던집니다.']);
    expect(screen.getByTestId('intro-success')).toHaveTextContent('3석 이상');
    expect(screen.queryByTestId('intro-steps')).toBeNull();
    expect(document.body.textContent).not.toContain('진행 5단계');
  });

  it('꼭 읽어야 할 말을 key-term mark로 강조한다(T102)', () => {
    render(<IntroScreen onStart={noop} />);

    const marked = Array.from(document.querySelectorAll('mark.key-term')).map((el) => el.textContent);
    expect(marked).toEqual(
      expect.arrayContaining(['AI 임원 네 명', '찬성·반대 중 하나', '한 표', '특별 이사의 의견', 'AI 임원들을 설득', '같은 편', '같은 표가 3석 이상', '성공 도장']),
    );
    expect(screen.getByTestId('intro-success').querySelectorAll('mark.key-term').length).toBeGreaterThanOrEqual(2);
    // 2026-10-09 사용자 지시: 성공 기준은 "특별 이사의 의견으로 AI 임원들을 설득해 같은 편으로 만드는 것".
    expect(screen.getByTestId('intro-success').textContent).toContain('특별 이사의 의견으로 AI 임원들을 설득해 같은 편으로 만드는 것');
  });

  it('팁 4단계 카드를 라벨 \'팁\'과 함께 보여 주고 핵심 말을 강조한다(T125)', () => {
    render(<IntroScreen onStart={noop} />);

    const tips = screen.getByTestId('intro-tips');
    expect(tips).toHaveTextContent('팁');
    expect(tips.textContent).not.toContain('이기는 순서');
    const cards = screen.getAllByTestId('intro-tip');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.querySelector('b')?.textContent)).toEqual(['01 · 읽기', '02 · 담기', '03 · 답하기', '주의']);
    expect(cards[0]).toHaveTextContent('근거 자료에서 임원마다 무엇을 걱정하는지 찾습니다.');
    expect(cards[1]).toHaveTextContent('그 걱정을 덜어 줄 조건을 의견에 담습니다. 현황판과 AI 비서실장이 도와줍니다.');
    expect(cards[2]).toHaveTextContent('임원의 추가 질문에 답해야 마음이 확정됩니다. 넘어가면 원래 입장으로 돌아갑니다.');
    expect(cards[3]).toHaveTextContent('듣기 좋은 조건이 오히려 반대를 부를 수도 있습니다.');
    expect(cards[3]).toHaveClass('intro-screen__tip--warn');
    const marked = cards.map((c) => Array.from(c.querySelectorAll('mark.key-term')).map((m) => m.textContent));
    expect(marked).toEqual([['무엇을 걱정하는지'], ['조건'], ['추가 질문에 답해야'], ['오히려 반대']]);
  });

  it('팁 문구에 어려운 말이 없다(T93 규칙)', () => {
    render(<IntroScreen onStart={noop} />);
    expect(findForbiddenWords(screen.getByTestId('intro-tips').textContent ?? '')).toEqual([]);
  });

  it('시작 버튼은 "확인" 하나뿐이고 누르면 콜백을 부른다', () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '안내 없이 시작' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
