// '발언 정리' 버튼(T149): 누르면 기능 고르기·결과 팝업 없이 바로 정리해 내 발언에 넣는다.
// 사용 기록은 DRAFT_REFINE 하나다.

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
  it('버튼은 "발언 정리" 하나이고 기능 고르기·팝업은 없다', () => {
    render(<AssistantPanel {...baseProps()} />);
    expect(screen.getByTestId('assistant-toggle')).toHaveTextContent('발언 정리');
    expect(screen.queryByText(/조건 추천/)).toBeNull();
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    expect(screen.queryByTestId('assistant-panel')).toBeNull();
    expect(screen.queryByTestId('assistant-keep-original')).toBeNull();
  });

  it('누르면 바로 정리해 내 발언에 넣고 applied:true로 기록한다', async () => {
    const onAssistantAction = vi.fn();
    const onApplyDraft = vi.fn();
    render(<AssistantPanel {...baseProps(onAssistantAction)} onApplyDraft={onApplyDraft} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    expect(screen.getByTestId('assistant-toggle')).toHaveTextContent('정리하는 중');
    await waitFor(() => expect(onApplyDraft).toHaveBeenCalledWith(expect.stringContaining('작은 범위로 먼저 시작합시다.')), { timeout: 2000 });
    expect(onAssistantAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'DRAFT_REFINE', applied: true }));
    expect(screen.getByTestId('assistant-toggle')).toHaveTextContent('발언 정리');
  });

  it('응답 전에 원문이 바뀌면 낡은 결과로 덮어쓰지 않는다', async () => {
    let release: () => void = () => {};
    const adapter: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      refineDraft: async (req) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return scriptedAssistantAdapter.refineDraft(req);
      },
    };
    const onApplyDraft = vi.fn();
    const { rerender } = render(<AssistantPanel {...baseProps()} adapter={adapter} onApplyDraft={onApplyDraft} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    rerender(<AssistantPanel {...baseProps()} adapter={adapter} onApplyDraft={onApplyDraft} draftRevision={1} />);
    await act(async () => {
      release();
    });
    expect(onApplyDraft).not.toHaveBeenCalled();
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
