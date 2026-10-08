// IntroScreen(T95, 2026-10-08 사용자 — "첫 페이지 다음, 안건 선택 전에 게임의 목적과
// 어떻게 해야 성공하는지 소개 한 장"): 목적·진행 5단계·성공 기준·팁을 보여주고
// "안건 고르러 가기 ▶"를 누르면 onNext를 부른다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntroScreen } from '../../src/components/screens/IntroScreen';

afterEach(() => {
  cleanup();
});

describe('IntroScreen', () => {
  it('목적·진행 5단계·성공 기준·팁을 모두 보여준다', () => {
    render(<IntroScreen onNext={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '오늘 이사님은 특별 이사입니다' })).toBeInTheDocument();
    const purposes = Array.from(document.querySelectorAll('.intro-screen__purpose')).map((el) => el.textContent);
    expect(purposes).toEqual(['가상 임원 네 명과 안건을 두고 토론하고,', '마지막에 한 표를 던집니다.']);
    expect(screen.getByTestId('intro-steps')).toHaveTextContent('상황 파악');
    expect(screen.getByTestId('intro-steps')).toHaveTextContent('표결');
    expect(screen.getByTestId('intro-success')).toHaveTextContent('3석 이상');
    const tips = Array.from(document.querySelectorAll('.intro-screen__tips li')).map((el) => el.textContent);
    expect(tips).toContain('조건을 붙여 임원을 움직여 보세요.');
  });

  it('꼭 읽어야 할 말을 key-term mark로 강조한다(T102)', () => {
    render(<IntroScreen onNext={vi.fn()} />);

    const marked = Array.from(document.querySelectorAll('mark.key-term')).map((el) => el.textContent);
    expect(marked).toEqual(
      expect.arrayContaining(['가상 임원 네 명', '한 표', '같은 표가 3석 이상', '설득 도장', '조건을 붙여']),
    );
    expect(screen.getByTestId('intro-success').querySelectorAll('mark.key-term').length).toBeGreaterThanOrEqual(2);
  });

  it('"안건 고르러 가기 ▶"를 누르면 onNext를 부른다', () => {
    const onNext = vi.fn();
    render(<IntroScreen onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: '안건 고르러 가기 ▶' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
