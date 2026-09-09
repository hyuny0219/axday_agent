// 직접 수정(dirty) 이후 체크를 바꾸면 뜨는 작은 확인 UI. 기존 입력을 조용히
// 덮어쓰지 않는다(CLAUDE_IMPLEMENTATION.md 4장 "편집 손실 방지"). 기본은 '유지'이므로
// 그 버튼을 주 CTA 스타일로 강조한다.

export interface RebuildConfirmProps {
  onKeep: () => void;
  onRebuild: () => void;
}

export function RebuildConfirm({ onKeep, onRebuild }: RebuildConfirmProps) {
  return (
    <div
      className="rebuild-confirm"
      role="alertdialog"
      aria-label="문구 선택 반영 방법 확인"
      data-testid="rebuild-confirm"
    >
      <p className="rebuild-confirm__message">
        직접 쓰신 내용이 있습니다. 문구 선택을 어떻게 반영할까요?
      </p>
      <div className="rebuild-confirm__actions">
        <button
          type="button"
          className="cta rebuild-confirm__keep"
          onClick={onKeep}
          data-testid="rebuild-confirm-keep"
        >
          직접 쓴 내용 유지
        </button>
        <button
          type="button"
          className="rebuild-confirm__rebuild"
          onClick={onRebuild}
          data-testid="rebuild-confirm-rebuild"
        >
          선택 문구로 다시 구성
        </button>
      </div>
    </div>
  );
}
