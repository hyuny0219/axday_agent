import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StepGuide } from '../../src/components/parts/StepGuide';
import { stepGuideState } from '../../src/domain/stepGuide';
import type { AssistantFeatureKey } from '../../src/domain/assistantLog';

afterEach(() => {
  cleanup();
});

const none = new Set<AssistantFeatureKey>();
const all = new Set<AssistantFeatureKey>(['summary', 'compare', 'refine']);

describe('stepGuideState', () => {
  it('입장이 없으면 ①이 현재이고 나머지는 대기다', () => {
    const state = stepGuideState({ side: null, draftReady: false, featuresUsed: none });
    expect(state.current).toBe('side');
    expect(state.steps.map((step) => step.status)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('입장만 고르면 ②, 문구까지 있으면 ③, 세 기능을 쓰면 ④가 현재다', () => {
    expect(stepGuideState({ side: 'FOR', draftReady: false, featuresUsed: none }).current).toBe('phrase');
    expect(stepGuideState({ side: 'FOR', draftReady: true, featuresUsed: none }).current).toBe('assistant');
    const last = stepGuideState({ side: 'FOR', draftReady: true, featuresUsed: all });
    expect(last.current).toBe('submit');
    expect(last.steps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'current']);
  });

  it('앞 칩이 안 끝났으면 뒤 칩을 먼저 채워도 현재가 되지 않는다', () => {
    expect(stepGuideState({ side: null, draftReady: true, featuresUsed: all }).current).toBe('side');
  });

  it('requireAssistant=false면 비서실장 칩이 없다', () => {
    const state = stepGuideState({ side: 'FOR', draftReady: true, featuresUsed: none, requireAssistant: false });
    expect(state.steps.map((step) => step.key)).toEqual(['side', 'phrase', 'submit']);
    expect(state.current).toBe('submit');
  });
});

describe('StepGuide', () => {
  it('현재 칩에만 맥동 표시와 지시 문장이 붙는다', () => {
    render(<StepGuide variant="discuss" side={null} draftReady={false} featuresUsed={none} />);
    expect(screen.getByTestId('step-chip-side')).toHaveAttribute('data-guide', 'next');
    expect(screen.getByTestId('step-chip-phrase')).not.toHaveAttribute('data-guide');
    expect(screen.getByTestId('step-guide-say')).toHaveTextContent('찬성/반대 중 하나를 고르세요');
  });

  it('끝난 칩은 done 상태이고 대기 칩은 upcoming이다', () => {
    render(<StepGuide variant="discuss" side="FOR" draftReady featuresUsed={none} />);
    expect(screen.getByTestId('step-chip-side')).toHaveAttribute('data-status', 'done');
    expect(screen.getByTestId('step-chip-assistant')).toHaveAttribute('data-status', 'current');
    expect(screen.getByTestId('step-chip-submit')).toHaveAttribute('data-status', 'upcoming');
  });

  it('③ 칩의 체크 세 개는 사용한 기능만 채워진다', () => {
    render(
      <StepGuide
        variant="discuss"
        side="FOR"
        draftReady
        featuresUsed={new Set<AssistantFeatureKey>(['summary'])}
      />,
    );
    expect(screen.getByTestId('step-check-summary')).toHaveAttribute('data-checked', 'true');
    expect(screen.getByTestId('step-check-compare')).toHaveAttribute('data-checked', 'false');
    expect(screen.getByTestId('step-check-refine')).toHaveAttribute('data-checked', 'false');
  });

  it('reactions 변형은 3칩이고 선택 꼬리표가 붙는다', () => {
    render(<StepGuide variant="reactions" side="FOR" draftReady={false} />);
    expect(screen.queryByTestId('step-chip-assistant')).not.toBeInTheDocument();
    expect(screen.getByTestId('step-optional-tag')).toBeInTheDocument();
    expect(screen.getByTestId('step-chip-submit')).toHaveTextContent('답변 전달');
  });
});
