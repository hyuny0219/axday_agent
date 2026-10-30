// '발언 정리' 버튼(DISCUSS·REACTIONS). 누르면 내 발언(원문)을 바로 다듬어 그대로 내 발언에 넣는다.
// adapter는 App.tsx가 session.mode에 따라 scripted/live 중 하나를 골라 넘긴다(기본값은 scripted).
//
// T149: AI 비서실장의 '조건 추천'과 기능 고르기를 없애고 '발언 정리' 하나로 줄였다. 2026-10-30 사용자
// 지시("원문 유지도 필요없어. 발언정리만 있으면 되고 발언정리 후에 의견전달만 하면 돼"): 결과 팝업과
// '내 발언에 적용'/'원문 유지' 선택을 없애고, 정리 결과를 바로 적용한다. 응답 전에 원문이 바뀌면
// (draftRevision이 달라지면) 결과를 버린다.

import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { SessionMode } from '../../domain/types';
import type { AssistantAdapter } from '../../services/assistant/types';
import { scriptedAssistantAdapter, withTimeout } from '../../services/assistant/scripted';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import { nextStepAttr } from './focusRing';
import { useDialogOpen } from './useDialogOpen';
import { useAutoReport } from './autoRunContext';
import '../../styles/screens/assistant.css';

type Status = 'idle' | 'loading' | 'done' | 'error';

// 정리 실패 시 문구는 AGENT_BOARDROOM_SPEC.md 4장 원문 그대로 쓴다.
const REFINE_FALLBACK_MESSAGE = '정리하지 못했습니다. 원문으로 계속할 수 있습니다';

export interface AssistantPanelProps {
  /** T113: 발언 정리가 지금 해야 할 다음 할 일이면 true(점선). */
  focusNext?: boolean;
  /** true면 버튼을 잠그고 안내(기본 "먼저 추천 문구를 골라 주세요")를 보인다. */
  toggleLocked?: boolean;
  /** 잠겨 있을 때 보일 안내. */
  toggleLockedHint?: string;
  scenario: Scenario;
  sessionId: string;
  /** 실패 기록에 남길 모드. */
  mode: SessionMode;
  /** 값이 바뀌면(0 제외) 열려 있는 팝업을 닫는다(PR #20 Codex 31차 P2-1). 화면이 확인 창을
   * 띄울 때 팝업의 포커스 트랩이 확인 창을 가리지 않게 한다. 자동으로 다시 열지는 않는다. */
  closeRequest?: number;
  /** 현재 참가자가 쓰고 있는 원문. */
  draftText: string;
  /** draftText가 바뀔 때마다 호출부(화면)가 늘리는 값. 요청 시점의 값을 그대로 보내고,
   * 응답이 왔을 때 이 값이 달라졌으면(입력이 바뀌었으면) 결과를 폐기한다. */
  draftRevision: number;
  /** 정리한 초안을 내 발언에 넣는다. */
  onApplyDraft: (text: string) => void;
  /** 결과가 실제로 화면에 표시되거나 적용되었을 때만 호출해 세션에 남긴다. */
  onAssistantAction: (event: AssistantActionEvent) => void;
  /** 팝업 열림/닫힘을 화면에 알린다. 화면은 팝업이 열린 동안 오른쪽 열을 inert로 만든다. */
  onOpenChange?: (open: boolean) => void;
  /** 테스트·live 어댑터 교체용. 기본은 사전 구성(scripted) 어댑터. */
  adapter?: AssistantAdapter;
}

export function AssistantPanel({
  focusNext = false,
  toggleLocked = false,
  toggleLockedHint,
  scenario,
  sessionId,
  mode,
  draftText,
  draftRevision,
  onApplyDraft,
  onAssistantAction,
  adapter = scriptedAssistantAdapter,
}: AssistantPanelProps) {
  const dialogOpen = useDialogOpen();
  const [status, setStatus] = useState<Status>('idle');

  // 리셋·재요청 뒤 도착한 응답을 무시하기 위해 "지금 유효한 요청"만 기록한다.
  const currentRequestRef = useRef<{
    sessionId: string;
    requestId: string;
    controller: AbortController;
  } | null>(null);

  useEffect(() => {
    return () => {
      currentRequestRef.current?.controller.abort();
    };
  }, []);

  useEffect(() => {
    // 세션이 바뀌면(리셋) 진행 중이던 요청은 폐기한다.
    currentRequestRef.current?.controller.abort();
    currentRequestRef.current = null;
    setStatus('idle');
  }, [sessionId]);

  // 요청 시점 이후 원문이 바뀌었는지 응답 때 확인한다.
  const draftRevisionRef = useRef(draftRevision);
  draftRevisionRef.current = draftRevision;

  // 자동 진행(T149): 참가자가 '발언 정리'를 누르면 정리·적용이 한 번에 끝난다.
  const autoReport = useAutoReport();

  function isStillCurrent(requestId: string): boolean {
    return currentRequestRef.current?.requestId === requestId;
  }

  async function runRefine() {
    currentRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    currentRequestRef.current = { sessionId, requestId, controller };
    const requestDraftRevision = draftRevision;
    setStatus('loading');

    try {
      const result = await withTimeout(
        adapter.refineDraft({
          sessionId,
          requestId,
          signal: controller.signal,
          scenario,
          draftText,
          draftRevision: requestDraftRevision,
        }),
      );
      if (!isStillCurrent(requestId)) return;
      currentRequestRef.current = null;
      if (draftRevisionRef.current !== requestDraftRevision) {
        // 그사이 참가자가 원문을 더 고쳤으면 낡은 결과로 덮어쓰지 않는다.
        setStatus('idle');
        return;
      }
      onApplyDraft(result.draftText);
      setStatus('idle');
      onAssistantAction({
        type: 'DRAFT_REFINE',
        mode: result.mode,
        evidenceIds: result.evidenceIds,
        applied: true,
      });
      autoReport.assistant('REFINE');
      autoReport.assistant('APPLIED');
    } catch {
      if (!isStillCurrent(requestId)) return;
      currentRequestRef.current = null;
      setStatus('error');
      // 실패 안내를 본 것도 "써 본 것"으로 센다(failed:true — 결과 화면 'AI가 도운 일'에는 나오지
      // 않는다). 막히는 참가자가 없게 하기 위함이다.
      onAssistantAction({ type: 'DRAFT_REFINE', mode, evidenceIds: [], applied: false, failed: true });
      autoReport.assistant('REFINE');
      autoReport.assistant('APPLIED');
    }
  }

  const busy = status === 'loading';
  return (
    <div className="assistant-panel">
      <button
        type="button"
        className="cta cta--secondary assistant-panel__toggle"
        onClick={runRefine}
        disabled={toggleLocked || busy}
        aria-describedby={toggleLocked ? 'assistant-toggle-why' : undefined}
        data-testid="assistant-toggle"
        data-auto-click="assistant-refine"
        {...nextStepAttr(focusNext && !dialogOpen && !toggleLocked && !busy)}
      >
        {busy ? '정리하는 중…' : '발언 정리'}
      </button>
      {toggleLocked && (
        <span id="assistant-toggle-why" className="sr-only" data-testid="assistant-toggle-hint">
          {toggleLockedHint ?? '먼저 추천 문구를 골라 주세요'}
        </span>
      )}
      {status === 'error' && (
        <p role="alert" className="assistant-panel__error" data-testid="assistant-error">
          {REFINE_FALLBACK_MESSAGE}
        </p>
      )}
    </div>
  );
}
