// '발언 정리' 버튼과 결과 팝업(T149): 누르면 기능 고르기 없이 바로 정리하고, 결과에서
// '내 발언에 적용' / '원문 유지'를 고른다. 사용 기록은 DRAFT_REFINE 하나다.

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantPanel } from '../../src/components/parts/AssistantPanel';
import { aiApprovalScenario } from '../../src/content/scenarios';
import type { AssistantActionEvent } from '../../src/domain/assistantLog';
import { scriptedAssistantAdapter } from '../../src/services/assistant/scripted';
import type { AssistantAdapter } from '../../src/services/assistant/types';

afterEach(() => {
  cleanup();
});

function baseProps(onAssistantAction: (event: AssistantActionEvent) => void = () => {}) {
  return {
    scenario: aiApprovalScenario,
    sessionId: 's1',
    mode: 'scripted' as const,
    draftText: '  작은   범위로 먼저 시작합시다.  ',
    draftRevision: 0,
    onApplyDraft: () => {},
    onAssistantAction,
  };
}

describe('AssistantPanel 발언 정리(T149)', () => {
  it('버튼은 "발언 정리" 하나이고 기능 고르기·번호·추천 순서는 없다', () => {
    render(<AssistantPanel {...baseProps()} />);
    expect(screen.getByTestId('assistant-toggle')).toHaveTextContent('발언 정리');
    expect(screen.queryByText(/조건 추천/)).toBeNull();
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    expect(screen.queryByTestId('assistant-action-compare')).toBeNull();
    expect(screen.queryByTestId('assistant-action-refine')).toBeNull();
    expect(screen.queryByTestId('assistant-intro')).toBeNull();
  });

  it('누르면 바로 정리해 원문·정리한 초안과 적용/원문 유지를 보인다', async () => {
    const onAssistantAction = vi.fn();
    render(<AssistantPanel {...baseProps(onAssistantAction)} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await screen.findByTestId('assistant-result-refine', {}, { timeout: 2000 });
    expect(screen.getByTestId('assistant-refine-draft')).toHaveTextContent('작은 범위로 먼저 시작합시다.');
    expect(screen.getByTestId('assistant-apply-refine')).toBeEnabled();
    expect(screen.getByTestId('assistant-keep-original')).toBeEnabled();
    expect(onAssistantAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAFT_REFINE', applied: false }),
    );
  });

  it('"내 발언에 적용"을 눌러야만 draft를 바꾸고(applied:true 기록) 팝업이 닫힌다', async () => {
    const onAssistantAction = vi.fn();
    const onApplyDraft = vi.fn();
    render(<AssistantPanel {...baseProps(onAssistantAction)} onApplyDraft={onApplyDraft} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await screen.findByTestId('assistant-result-refine', {}, { timeout: 2000 });
    expect(onApplyDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('assistant-apply-refine'));
    expect(onApplyDraft).toHaveBeenCalledWith('작은 범위로 먼저 시작합시다.');
    expect(onAssistantAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAFT_REFINE', applied: true }),
    );
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
  });

  it('"원문 유지"는 draft를 건드리지 않고 팝업만 닫는다', async () => {
    const onApplyDraft = vi.fn();
    render(<AssistantPanel {...baseProps()} onApplyDraft={onApplyDraft} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await screen.findByTestId('assistant-result-refine', {}, { timeout: 2000 });
    fireEvent.click(screen.getByTestId('assistant-keep-original'));
    expect(onApplyDraft).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
  });

  it('잠겨 있으면 버튼이 막히고 안내 문구가 있다', () => {
    render(<AssistantPanel {...baseProps()} toggleLocked toggleLockedHint="먼저 입장을 골라 주세요" />);
    expect(screen.getByTestId('assistant-toggle')).toBeDisabled();
    expect(screen.getByTestId('assistant-toggle-hint')).toHaveTextContent('먼저 입장을 골라 주세요');
  });

  it('실패해도 failed:true로 남겨 사용으로 센다', async () => {
    const failing: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      refineDraft: () => Promise.reject(new Error('연결 실패')),
    };
    const onAssistantAction = vi.fn();
    render(<AssistantPanel {...baseProps(onAssistantAction)} adapter={failing} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await screen.findByTestId('assistant-error');
    expect(onAssistantAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAFT_REFINE', failed: true }),
    );
  });
});

describe('AssistantPanel 로딩 중 닫기(Codex 32차 P2-2)', () => {
  it('로딩 중 팝업을 닫으면 늦게 도착한 응답은 기록되지 않고, 다시 눌러 실행하면 정상 기록된다', async () => {
    const onAssistantAction = vi.fn();
    let releaseFirst: () => void = () => {};
    let calls = 0;
    const adapter: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      refineDraft: async (req) => {
        calls += 1;
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return scriptedAssistantAdapter.refineDraft(req);
      },
    };
    render(<AssistantPanel {...baseProps(onAssistantAction)} adapter={adapter} />);

    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-close'));
    await act(async () => {
      releaseFirst();
    });
    expect(onAssistantAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('assistant-toggle'));
    await waitFor(() => {
      expect(onAssistantAction.mock.calls.filter(([e]) => e.type === 'DRAFT_REFINE')).toHaveLength(1);
    });
  });
});
