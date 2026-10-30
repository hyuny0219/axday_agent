// '발언 정리' 버튼과 결과 팝업(DISCUSS·REACTIONS). 누르면 팝업을 열고 바로 내 발언(원문)을
// 다듬어 보여 준다. adapter는 App.tsx가 session.mode에 따라 scripted/live 중 하나를 골라
// 넘긴다(기본값은 scripted). '내 발언에 적용'을 실제로 눌렀을 때만 draft를 교체한다 —
// 결과를 보여주는 것만으로는 절대 textarea를 덮어쓰지 않는다.
//
// T31: draftRevision이 바뀌면(참가자가 그사이 원문을 더 고치면) 화면에 남아 있던 이전
// 초안을 폐기한다. T149: AI 비서실장의 '조건 추천'과 기능 고르기를 없애고 '발언 정리'
// 하나로 줄였다.

import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { SessionMode } from '../../domain/types';
import type { AssistantAdapter, RefineDraftResult } from '../../services/assistant/types';
import { scriptedAssistantAdapter, withTimeout } from '../../services/assistant/scripted';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import { DialogShell } from './DialogShell';
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
  /** '내 발언에 적용'을 눌렀을 때만 호출된다. */
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
  closeRequest = 0,
  draftText,
  draftRevision,
  onApplyDraft,
  onAssistantAction,
  onOpenChange,
  adapter = scriptedAssistantAdapter,
}: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const dialogOpen = useDialogOpen();
  const closePopupRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (closeRequest > 0) {
      closePopupRef.current();
    }
  }, [closeRequest]);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const [status, setStatus] = useState<Status>('idle');
  const [refineResult, setRefineResult] = useState<RefineDraftResult | null>(null);
  const [refineResultRevision, setRefineResultRevision] = useState<number | null>(null);

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
    // 세션이 바뀌면(리셋) 진행 중이던 요청은 폐기하고 결과도 비운다.
    currentRequestRef.current?.controller.abort();
    currentRequestRef.current = null;
    setStatus('idle');
    setRefineResult(null);
    setRefineResultRevision(null);
    setOpen(false);
  }, [sessionId]);

  // draftRevision이 바뀌었다는 건 참가자가 그사이 원문을 더 고쳤다는 뜻이다. 화면에 남은
  // 이전 초안은 이제 최신 원문을 반영하지 못하므로 폐기한다.
  useEffect(() => {
    if (refineResultRevision !== null && refineResultRevision !== draftRevision) {
      setRefineResult(null);
      setRefineResultRevision(null);
      setStatus('idle');
    }
  }, [draftRevision, refineResultRevision]);

  // 로딩 중에 팝업을 닫으면 진행 중 요청을 무효화하고 idle로 되돌린다 — 닫힌 뒤 도착한
  // 응답·오류가 화면에 보인 적 없이 사용으로 집계되지 않게 한다(isStillCurrent가 false).
  const statusRef = useRef(status);
  statusRef.current = status;
  function closePopup() {
    if (statusRef.current === 'loading') {
      currentRequestRef.current?.controller.abort();
      currentRequestRef.current = null;
      setStatus('idle');
    }
    setOpen(false);
  }
  closePopupRef.current = closePopup;

  // 자동 진행(T149): 참가자가 '발언 정리'를 누르고, 결과의 '내 발언에 적용'을 누른다.
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

    setRefineResult(null);
    setRefineResultRevision(null);
    setStatus('loading');
    setOpen(true);

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
      setRefineResult(result);
      setRefineResultRevision(requestDraftRevision);
      setStatus('done');
      autoReport.assistant('REFINE');
      // 정리한 초안을 화면에 보여준 것도 "써 본 것"이다(applied:false — 결과 화면
      // 'AI가 도운 일'에는 '내 발언에 적용'을 눌렀을 때만 나온다).
      onAssistantAction({
        type: 'DRAFT_REFINE',
        mode: result.mode,
        evidenceIds: result.evidenceIds,
        applied: false,
      });
    } catch {
      if (!isStillCurrent(requestId)) return;
      setStatus('error');
      // 실패·연결 지연 안내를 본 것도 "써 본 것"으로 센다(failed:true — 결과 화면
      // 'AI가 도운 일'에는 나오지 않는다). 막히는 참가자가 없게 하기 위함이다.
      onAssistantAction({ type: 'DRAFT_REFINE', mode, evidenceIds: [], applied: false, failed: true });
    }
  }

  function handleApplyRefine() {
    if (!refineResult) {
      return;
    }
    onApplyDraft(refineResult.draftText);
    onAssistantAction({
      type: 'DRAFT_REFINE',
      mode: refineResult.mode,
      evidenceIds: refineResult.evidenceIds,
      applied: true,
    });
    autoReport.assistant('APPLIED');
    setRefineResult(null);
    setRefineResultRevision(null);
    setStatus('idle');
    setOpen(false);
  }

  // '원문 유지' — 제안을 닫기만 한다. 편집창은 절대 건드리지 않는다.
  function handleKeepOriginal() {
    setRefineResult(null);
    setRefineResultRevision(null);
    setStatus('idle');
    setOpen(false);
  }

  return (
    <div className="assistant-panel">
      <button
        type="button"
        className="cta cta--secondary assistant-panel__toggle"
        onClick={runRefine}
        disabled={toggleLocked}
        aria-describedby={toggleLocked ? 'assistant-toggle-why' : undefined}
        data-testid="assistant-toggle"
        data-auto-click="assistant-refine"
        {...nextStepAttr(focusNext && !dialogOpen && !toggleLocked)}
      >
        발언 정리
      </button>
      {toggleLocked && (
        <span id="assistant-toggle-why" className="sr-only" data-testid="assistant-toggle-hint">
          {toggleLockedHint ?? '먼저 추천 문구를 골라 주세요'}
        </span>
      )}
      {open && (
        <DialogShell
          testId="assistant-panel"
          titleId="assistant-panel-title"
          title="발언 정리"
          onClose={closePopup}
          closeTestId="assistant-close"
        >
          <div className="assistant-panel__content">
            <div className="assistant-panel__results" data-testid="assistant-results">
              {status === 'loading' && <p data-testid="assistant-loading">정리하는 중입니다…</p>}
              {status === 'error' && (
                <div role="alert" data-testid="assistant-error">
                  <p>{REFINE_FALLBACK_MESSAGE}</p>
                </div>
              )}
              {status === 'done' && refineResult && (
                <div data-testid="assistant-result-refine">
                  <div className="assistant-panel__refine-compare">
                    <div className="assistant-panel__refine-original">
                      <h4>원문</h4>
                      <p data-testid="assistant-refine-original">{draftText}</p>
                    </div>
                    <div className="assistant-panel__refine-draft-wrap">
                      <h4>정리한 초안</h4>
                      <p
                        className="assistant-panel__refine-draft"
                        data-testid="assistant-refine-draft"
                      >
                        {refineResult.draftText}
                      </p>
                    </div>
                  </div>
                  <div className="assistant-panel__refine-choices">
                    <button
                      type="button"
                      className="cta cta--secondary"
                      onClick={handleApplyRefine}
                      data-testid="assistant-apply-refine"
                    >
                      내 발언에 적용
                    </button>
                    <button
                      type="button"
                      className="cta cta--secondary"
                      onClick={handleKeepOriginal}
                      data-testid="assistant-keep-original"
                    >
                      원문 유지
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
}
