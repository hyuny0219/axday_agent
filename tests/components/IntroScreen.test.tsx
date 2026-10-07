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

    expect(screen.getByRole('heading', { name: '오늘 당신은 특별 이사입니다' })).toBeInTheDocument();
    expect(screen.getByText('가상 임원 네 명과 안건을 두고 토론하고,')).toBeInTheDocument();
    expect(screen.getByText('마지막에 한 표를 던집니다.')).toBeInTheDocument();
    expect(screen.getByTestId('intro-steps')).toHaveTextContent('상황 파악');
    expect(screen.getByTestId('intro-steps')).toHaveTextContent('표결');
    expect(screen.getByTestId('intro-success')).toHaveTextContent('3석 이상');
    expect(screen.getByText('조건을 붙여 임원을 움직여 보세요.')).toBeInTheDocument();
  });

  it('"안건 고르러 가기 ▶"를 누르면 onNext를 부른다', () => {
    const onNext = vi.fn();
    render(<IntroScreen onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: '안건 고르러 가기 ▶' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
