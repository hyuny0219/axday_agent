// 결과 화면 "처음 화면으로" 확인 단계(T84, Opus UX 검토 #5 — "'체험 종료'가 확인
// 없이 즉시 초기화"). RebuildConfirm(discuss.css)과 같은 인라인 alertdialog 모양을
// 쓰지만, 이 동작은 세션 전체를 초기화해 되돌릴 수 없으므로 Esc로도 취소할 수 있게
// 하고 열리면 안전한 선택("결과 계속 보기")에 포커스를 둔다 — 기본 포커스가 파괴적인
// 쪽이면 안 된다(RebuildConfirm이 기본 '유지'를 강조하는 것과 같은 원칙).

import { useEffect, useRef } from 'react';

export interface EndSessionConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function EndSessionConfirm({ onConfirm, onCancel }: EndSessionConfirmProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="end-session-confirm"
      role="alertdialog"
      aria-label="체험 종료 확인"
      data-testid="end-session-confirm"
    >
      <p className="end-session-confirm__message">결과 화면을 닫고 처음으로 돌아갈까요?</p>
      <div className="end-session-confirm__actions">
        <button
          type="button"
          ref={cancelButtonRef}
          className="cta end-session-confirm__cancel"
          onClick={onCancel}
          data-testid="end-session-confirm-cancel"
        >
          결과 계속 보기
        </button>
        <button
          type="button"
          className="cta cta--secondary"
          onClick={onConfirm}
          data-testid="end-session-confirm-ok"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
