// 공용 모달 팝업 껍데기(T89, 사용자 지시 "AI 비서실장의 팝업창을 근거 자료 팝업과
// 동일한 디자인으로"). EvidenceDialog(T68)가 처음 만든 종이 패널 + 우상단 도장 +
// CASE 칩(선택) + 제목 + 닫기 버튼 + 본문 + 하단 안내 구조와 포커스 트랩·Esc·바깥
// 클릭·배경 스크롤 잠금 동작을 그대로 떼어내 AssistantPanel과 함께 쓴다. 본문
// (children)만 호출부가 다르게 채운다.

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import '../../styles/screens/dialogShell.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogShellProps {
  /** 바깥 딤(backdrop)·팝업 자체 testid의 기준값(`${testId}-backdrop`·`${testId}`). */
  testId: string;
  /** aria-labelledby가 가리키는 제목 요소의 id. */
  titleId: string;
  title: string;
  /** 우상단 붉은 사각 도장(T87 "붉은 상자 안의 글씨는 영어로" — CONFIDENTIAL 등). 없으면 안 그린다. */
  stamp?: string;
  /** 좌상단 CASE 칩류 보조 라벨. 없으면 안 그린다. */
  eyebrow?: string;
  onClose: () => void;
  closeTestId: string;
  /** 하단 안내 두 줄. 기본값은 EvidenceDialog와 같다. */
  footerHint?: readonly [string, string];
  children: ReactNode;
}

export function DialogShell({
  testId,
  titleId,
  title,
  stamp,
  eyebrow,
  onClose,
  closeTestId,
  footerHint = ['바깥을 누르거나 닫기를 누르면 닫힙니다', '열린 동안 뒤 화면은 멈춤'],
  children,
}: DialogShellProps) {
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

  // 팝업이 열린 동안 배경 문서 스크롤을 잠근다(EvidenceDialog와 같은 이유, PR #11 Codex 29차).
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
    <div className="dialog-shell__backdrop" data-testid={`${testId}-backdrop`} onClick={handleBackdropClick}>
      <div
        className="dialog-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        data-testid={testId}
      >
        {stamp && (
          <span className="dialog-shell__stamp" aria-hidden="true">
            {stamp}
          </span>
        )}
        <div className="dialog-shell__header">
          {eyebrow && <span className="dialog-shell__eyebrow">{eyebrow}</span>}
          <h2 id={titleId} className="dialog-shell__title">
            {title}
          </h2>
          <button
            type="button"
            className="cta cta--secondary dialog-shell__close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="닫기"
            data-testid={closeTestId}
          >
            닫기
          </button>
        </div>
        <div className="dialog-shell__body">{children}</div>
        <div className="dialog-shell__footer">
          <span>{footerHint[0]}</span>
          <span>{footerHint[1]}</span>
        </div>
      </div>
    </div>
  );
}
