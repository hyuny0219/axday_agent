// 이전·다음 버튼과 '지난 화면' 띠(T126, 2026-10-12 사용자 지시). 세션은 건드리지 않고 화면만 오간다.
// 버튼은 헤더 진행 스트립 양옆에 놓고, 전체화면에서도 보인다(운영 버튼과 별개).

import '../../styles/screens/shell.css';

export interface ViewNavProps {
  /** 이전·다음을 쓸 수 있는 단계인가(BRIEFING~VOTE). 아니면 아무것도 그리지 않는다. */
  visible: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ViewNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="view-nav__btn"
      disabled={disabled}
      onClick={onClick}
      data-testid={direction === 'prev' ? 'view-prev' : 'view-next'}
    >
      {direction === 'prev' ? '◀ 이전' : '다음 ▶'}
    </button>
  );
}

/** 지난 화면을 보는 동안만 나오는 안내 띠. '지금 화면으로'는 '다음 ▶'을 끝까지 누른 것과 같다. */
export function ViewBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="view-banner" role="status" data-testid="view-banner">
      <span className="view-banner__text">
        지난 화면을 보고 있습니다 · 다음 ▶ 또는 &lsquo;지금 화면으로&rsquo;를 누르면 돌아갑니다
      </span>
      <button type="button" className="view-banner__exit" onClick={onExit} data-testid="view-exit">
        지금 화면으로
      </button>
    </div>
  );
}
