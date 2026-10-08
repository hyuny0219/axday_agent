// AI 비서실장 "조건 추천" 적용 기록(T96, Codex 27차 검토 P2-3): onRecommendCondition이
// 실제로 반영했는지(true/false)를 돌려줄 때만 CONDITION_RECOMMEND_APPLY를 기록해, 결과
// 화면 "추천 조건 N개 반영"이 실제 반영 수와 일치하는지 확인한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantPanel } from '../../src/components/parts/AssistantPanel';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { scriptedStances } from '../../src/domain/stance';
import type { AssistantActionEvent } from '../../src/domain/assistantLog';
import { scriptedAssistantAdapter } from '../../src/services/assistant/scripted';
import type { AssistantAdapter } from '../../src/services/assistant/types';

afterEach(() => {
  cleanup();
});

const scenario = aiApprovalScenario;

function baseProps(
  onAssistantAction: (event: AssistantActionEvent) => void,
  onRecommendCondition: (id: string) => boolean,
) {
  const stances = scriptedStances(scenario, { stage: 'DISCUSS', opinions: [] });
  return {
    scenario,
    sessionId: 's1',
    selectedConditionIds: [] as string[],
    participantStance: 'FOR' as const,
    mode: 'scripted' as const,
    stances,
    onRecommendCondition,
    draftText: '',
    draftRevision: 0,
    transcript: { revision: 0, statements: [] },
    onApplyDraft: () => {},
    onAssistantAction,
  };
}

async function openRecommendation() {
  fireEvent.click(screen.getByTestId('assistant-toggle'));
  fireEvent.click(screen.getByTestId('assistant-action-compare'));
  await screen.findByTestId('assistant-recommend-opening', {}, { timeout: 2000 });
}

describe('AssistantPanel "조건 추천" 적용 기록(T96)', () => {
  it('onRecommendCondition이 true를 돌려주면 그 조건 하나만 CONDITION_RECOMMEND_APPLY로 기록된다', async () => {
    const onAssistantAction = vi.fn();
    const onRecommendCondition = vi.fn().mockReturnValue(true);
    render(<AssistantPanel {...baseProps(onAssistantAction, onRecommendCondition)} />);
    await openRecommendation();

    // LOG는 단독으로 CAIO를 움직이는 단일 행이다(조건이 하나도 없는 상태).
    // handleApplyRecommendation은 비동기(await onRecommendCondition(...))라 act로
    // 감싸 마이크로태스크가 끝날 때까지 기다린다.
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-recommend-apply-LOG'));
    });

    const applyCalls = onAssistantAction.mock.calls.filter(
      ([event]) => event.type === 'CONDITION_RECOMMEND_APPLY',
    );
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]?.[0].evidenceIds).toEqual(['LOG']);
  });

  it('onRecommendCondition이 false를 돌려주면(매칭되는 문구 없음) 기록하지 않는다', async () => {
    const onAssistantAction = vi.fn();
    const onRecommendCondition = vi.fn().mockReturnValue(false);
    render(<AssistantPanel {...baseProps(onAssistantAction, onRecommendCondition)} />);
    await openRecommendation();

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-recommend-apply-LOG'));
    });

    const applyCalls = onAssistantAction.mock.calls.filter(
      ([event]) => event.type === 'CONDITION_RECOMMEND_APPLY',
    );
    expect(applyCalls).toHaveLength(0);
  });

  it('묶음 적용에서 조건 하나만 실제로 반영되면("추천 조건 N개 반영") N은 실제 반영 수와 같다', async () => {
    const onAssistantAction = vi.fn();
    // CFO 묶음(LIMIT+REVIEW)의 "모두 적용" — LIMIT은 매칭되는 문구가 없어 false,
    // REVIEW만 실제로 반영된다고 가정한다.
    const onRecommendCondition = vi.fn((id: string) => id === 'REVIEW');
    render(<AssistantPanel {...baseProps(onAssistantAction, onRecommendCondition)} />);
    await openRecommendation();

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-recommend-apply-bundle-LIMIT+REVIEW'));
    });

    const applyCalls = onAssistantAction.mock.calls.filter(
      ([event]) => event.type === 'CONDITION_RECOMMEND_APPLY',
    );
    // 버튼은 한 번 눌렀지만(조건 2개짜리 묶음), 실제로 반영된 조건은 REVIEW 하나뿐이라
    // 기록도 1건이어야 한다 — "추천 조건 N개 반영"이 실제 반영 수와 일치해야 한다는
    // Codex 27차 검토 요구사항.
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]?.[0].evidenceIds).toEqual(['REVIEW']);
  });
});

describe('AssistantPanel 묶음 일괄 적용(Codex 28차 P2-1)', () => {
  it('onRecommendConditions가 있으면 묶음 전체를 한 번에 넘기고 반영된 조건만 기록한다', async () => {
    const onAssistantAction = vi.fn();
    const onRecommendConditions = vi.fn((ids: string[]) => ids.filter((id) => id !== 'LIMIT'));
    const onRecommendCondition = vi.fn().mockReturnValue(true);
    render(
      <AssistantPanel
        {...baseProps(onAssistantAction, onRecommendCondition)}
        onRecommendConditions={onRecommendConditions}
      />,
    );
    await openRecommendation();
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-recommend-apply-bundle-LIMIT+REVIEW'));
    });
    expect(onRecommendConditions).toHaveBeenCalledTimes(1);
    expect(onRecommendConditions).toHaveBeenCalledWith(['LIMIT', 'REVIEW']);
    expect(onRecommendCondition).not.toHaveBeenCalled();
    const applyCalls = onAssistantAction.mock.calls.filter(([event]) => event.type === 'CONDITION_RECOMMEND_APPLY');
    expect(applyCalls.map(([event]) => event.evidenceIds)).toEqual([['REVIEW']]);
  });
});

// T97: DISCUSS 전용 첫 화면 소개·체크리스트와 실패 기록.
describe('AssistantPanel 필수 사용 소개(T97)', () => {
  const noopAction = () => {};
  const base = () => baseProps(noopAction, () => true);

  it('requiredFeatures를 넘기지 않으면 소개 블록도 완료 표시도 없다', () => {
    render(<AssistantPanel {...base()} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    expect(screen.queryByTestId('assistant-intro')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-check-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-action-summary')).not.toHaveAttribute('data-coach');
  });

  it('첫 화면에 제목·기능 세 줄·체크가 보이고, 안 쓴 첫 기능 버튼이 코치 대상이다', () => {
    render(<AssistantPanel {...base()} requiredFeatures={{ used: new Set(['summary']) }} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    const intro = screen.getByTestId('assistant-intro');
    expect(intro).toHaveTextContent('AI 비서실장이 도와드립니다 — 세 가지를 한 번씩 눌러 보세요');
    expect(intro).toHaveTextContent('임원 네 명 말을 한 줄씩 정리합니다');
    expect(intro).toHaveTextContent('지금 쓴 발언을 더 또렷하게 다듬어 줍니다');
    expect(screen.getByTestId('assistant-check-summary')).toHaveTextContent('☑');
    expect(screen.getByTestId('assistant-check-compare')).toHaveTextContent('☐');
    expect(screen.getByTestId('assistant-done-summary')).toHaveTextContent('완료');
    expect(screen.getByTestId('assistant-action-summary')).not.toHaveAttribute('data-coach');
    expect(screen.getByTestId('assistant-action-compare')).toHaveAttribute('data-coach', 'assistant-next');
    expect(screen.queryByTestId('assistant-intro-done')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-close')).toHaveAttribute('data-coach', 'assistant-close');
  });

  it('세 기능을 다 쓰면 완료 문구가 뜨고 코치 대상 기능 버튼은 없어진다', () => {
    render(
      <AssistantPanel
        {...base()}
        requiredFeatures={{ used: new Set(['summary', 'compare', 'refine']) }}
      />,
    );
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    expect(screen.getByTestId('assistant-intro-done')).toHaveTextContent(
      '이제 팝업을 닫고 의견을 전달하세요',
    );
    expect(screen.getByTestId('assistant-action-refine')).not.toHaveAttribute('data-coach');
  });

  it('결과가 생기면 소개가 한 줄로 줄어든다', async () => {
    render(<AssistantPanel {...base()} requiredFeatures={{ used: new Set() }} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-compare'));
    await screen.findByTestId('assistant-recommend-opening', {}, { timeout: 2000 });
    expect(screen.queryByTestId('assistant-intro')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-intro-compact')).toHaveTextContent('한눈에 보기');
    expect(screen.getByTestId('assistant-intro-compact')).toHaveTextContent('조건 추천');
  });

  it('세 기능이 채워지는 순간 onAllUsed가 한 번 불린다', () => {
    const onAllUsed = vi.fn();
    const props = base();
    const { rerender } = render(
      <AssistantPanel {...props} requiredFeatures={{ used: new Set(['summary']), onAllUsed }} />,
    );
    expect(onAllUsed).not.toHaveBeenCalled();
    rerender(
      <AssistantPanel
        {...props}
        requiredFeatures={{ used: new Set(['summary', 'compare', 'refine']), onAllUsed }}
      />,
    );
    expect(onAllUsed).toHaveBeenCalledTimes(1);
  });

  it('정리한 초안을 화면에 보이면 applied:false로 DRAFT_REFINE을 남긴다', async () => {
    const onAssistantAction = vi.fn();
    render(
      <AssistantPanel {...baseProps(onAssistantAction, () => true)} draftText="초안 문장입니다." />,
    );
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-refine'));
    await screen.findByTestId('assistant-result-refine', {}, { timeout: 2000 });
    expect(onAssistantAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAFT_REFINE', applied: false }),
    );
  });

  it('기능이 실패해도 같은 유형을 failed:true로 남겨 사용으로 센다', async () => {
    const failing: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      summarizeOpinions: () => Promise.reject(new Error('연결 실패')),
      compareConditions: () => Promise.reject(new Error('연결 실패')),
      refineDraft: () => Promise.reject(new Error('연결 실패')),
    };
    const onAssistantAction = vi.fn();
    render(<AssistantPanel {...baseProps(onAssistantAction, () => true)} adapter={failing} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    for (const [feature, type] of [
      ['summary', 'OPINION_SUMMARY'],
      ['compare', 'CONDITION_RECOMMEND_VIEW'],
      ['refine', 'DRAFT_REFINE'],
    ] as const) {
      fireEvent.click(screen.getByTestId(`assistant-action-${feature}`));
      await screen.findByTestId('assistant-error');
      expect(onAssistantAction).toHaveBeenCalledWith(
        expect.objectContaining({ type, failed: true }),
      );
    }
  });
});

describe('AssistantPanel 로딩 중 닫기(Codex 32차 P2-2)', () => {
  it('로딩 중 팝업을 닫으면 늦게 도착한 응답은 기록되지 않고, 다시 열어 실행하면 정상 기록된다', async () => {
    const onAssistantAction = vi.fn();
    let releaseFirst: () => void = () => {};
    let calls = 0;
    const adapter: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      summarizeOpinions: async (req) => {
        calls += 1;
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return scriptedAssistantAdapter.summarizeOpinions(req);
      },
    };
    render(<AssistantPanel {...baseProps(onAssistantAction, () => true)} adapter={adapter} />);

    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-summary'));
    fireEvent.click(screen.getByTestId('assistant-close'));
    await act(async () => {
      releaseFirst();
    });
    expect(onAssistantAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-summary'));
    await waitFor(() => {
      expect(onAssistantAction.mock.calls.filter(([e]) => e.type === 'OPINION_SUMMARY')).toHaveLength(1);
    });
  });
});
