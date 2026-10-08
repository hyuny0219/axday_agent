// AI 비서실장 "조건 추천" 적용 기록(T96, Codex 27차 검토 P2-3): onRecommendCondition이
// 실제로 반영했는지(true/false)를 돌려줄 때만 CONDITION_RECOMMEND_APPLY를 기록해, 결과
// 화면 "추천 조건 N개 반영"이 실제 반영 수와 일치하는지 확인한다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AssistantPanel } from '../../src/components/parts/AssistantPanel';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { scriptedStances } from '../../src/domain/stance';
import type { AssistantActionEvent } from '../../src/domain/assistantLog';

afterEach(() => {
  cleanup();
});

const scenario = aiApprovalScenario;

function baseProps(onAssistantAction: (event: AssistantActionEvent) => void, onRecommendCondition: (id: string) => boolean) {
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
