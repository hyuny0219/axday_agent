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
  const noop = () => undefined;

  it('목적·성공 기준만 보여 주고 진행 5단계·팁은 없다(T103)', () => {
    render(<IntroScreen onStartWithCoach={noop} onStartWithoutCoach={noop} />);

    expect(screen.getByRole('heading', { name: '오늘 이사님은 특별 이사입니다' })).toBeInTheDocument();
    const purposes = Array.from(document.querySelectorAll('.intro-screen__purpose')).map((el) => el.textContent);
    expect(purposes).toEqual(['가상 임원 네 명과 안건을 두고 토론하고,', '마지막에 한 표를 던집니다.']);
    expect(screen.getByTestId('intro-success')).toHaveTextContent('3석 이상');
    expect(screen.queryByTestId('intro-steps')).toBeNull();
    expect(document.querySelector('.intro-screen__tips')).toBeNull();
    expect(document.body.textContent).not.toContain('진행 5단계');
  });

  it('꼭 읽어야 할 말을 key-term mark로 강조한다(T102)', () => {
    render(<IntroScreen onStartWithCoach={noop} onStartWithoutCoach={noop} />);

    const marked = Array.from(document.querySelectorAll('mark.key-term')).map((el) => el.textContent);
    expect(marked).toEqual(
      expect.arrayContaining(['가상 임원 네 명', '한 표', '같은 표가 3석 이상', '설득 도장']),
    );
    expect(screen.getByTestId('intro-success').querySelectorAll('mark.key-term').length).toBeGreaterThanOrEqual(2);
  });

  it('"안내 받으며 시작 ▶"는 코치 켜고 시작 콜백만 부른다', () => {
    const withCoach = vi.fn();
    const withoutCoach = vi.fn();
    render(<IntroScreen onStartWithCoach={withCoach} onStartWithoutCoach={withoutCoach} />);

    fireEvent.click(screen.getByRole('button', { name: '안내 받으며 시작 ▶' }));
    expect(withCoach).toHaveBeenCalledTimes(1);
    expect(withoutCoach).not.toHaveBeenCalled();
  });

  it('"안내 없이 시작"은 코치 끄고 시작 콜백만 부른다', () => {
    const withCoach = vi.fn();
    const withoutCoach = vi.fn();
    render(<IntroScreen onStartWithCoach={withCoach} onStartWithoutCoach={withoutCoach} />);

    fireEvent.click(screen.getByRole('button', { name: '안내 없이 시작' }));
    expect(withoutCoach).toHaveBeenCalledTimes(1);
    expect(withCoach).not.toHaveBeenCalled();
  });
});
