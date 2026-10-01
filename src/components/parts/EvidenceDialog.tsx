// 근거 자료 팝업(T68, 2026-09-30 사용자 요청). BRIEFING 오른쪽 열이 자료 4장(EvidenceGrid
// variant="expanded")을 상시 펼쳐 두면 세로를 많이 차지해 720에서 잘린다 — 그 자리를
// "근거 자료 보기" 버튼 하나로 줄이고(BriefingScreen), 이 팝업에서 4장을 전문으로 본다.
// 저장소에 기존 모달 컴포넌트가 없어(AssistantPanel은 오른쪽 열 위에 겹치는 인라인
// 드로어일 뿐 role="dialog"·포커스 트랩이 없다) 여기서 직접 만든다.
//
// 접근성: role="dialog" aria-modal="true" aria-labelledby로 제목을 가리키고, 열리면
// 닫기 버튼에 포커스를 준 뒤(자료 카드에는 포커스 가능한 요소가 없다 — evidence-grid
// expanded 변형은 article/h3/p로만 구성된다), Tab은 팝업 안에서만 순환한다. 닫히면(Esc·
// 딤 클릭·닫기 버튼 세 경로 모두) 팝업을 열기 직전 포커스였던 요소로 되돌린다 — 트리거를
// prop으로 받지 않고 마운트 시점의 document.activeElement를 그대로 기억한다(어느
// 버튼에서 열든 같은 규칙으로 동작).
import { useEffect, useRef } from 'react';
import type { EvidenceCard as EvidenceCardData } from '../../content/types';
import { EvidenceGrid } from './EvidenceGrid';
import '../../styles/screens/evidenceDialog.css';

export interface EvidenceDialogProps {
  evidence: EvidenceCardData[];
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EvidenceDialog({ evidence, onClose }: EvidenceDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // 마운트 시점(열릴 때)의 포커스 요소를 기억해 뒀다가 언마운트(닫힐 때) 되돌린다.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  // 팝업이 열린 동안 배경 문서 스크롤을 잠근다. 1200px 미만·700px 미만 reflow 경로에서는
  // shell.css가 문서 스크롤을 허용하므로, 딤 위 휠·터치나 팝업 본문 끝에서의 스크롤이 뒤의
  // 회의 화면을 움직였다(PR #11 Codex 29차). 언마운트 시 원래 값을 되돌린다.
  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const container = dialogRef.current;
      if (!container) {
        return;
      }
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="evidence-dialog__backdrop"
      data-testid="evidence-dialog-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        className="evidence-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-dialog-title"
        ref={dialogRef}
        data-testid="evidence-dialog"
      >
        <div className="evidence-dialog__header">
          <h2 id="evidence-dialog-title" className="evidence-dialog__title">
            근거 자료 · EXHIBIT A–D
          </h2>
          <button
            type="button"
            className="evidence-dialog__close"
            onClick={onClose}
            ref={closeButtonRef}
            data-testid="evidence-dialog-close"
          >
            닫기
          </button>
        </div>
        <div className="evidence-dialog__body">
          <EvidenceGrid evidence={evidence} />
        </div>
      </div>
    </div>
  );
}
