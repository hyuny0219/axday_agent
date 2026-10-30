// 임원 카드 자리에 먼저 보이는 "…" 생각 중 표시(T148). 점 세 개가 차례로 깜빡인다.

import '../../styles/screens/thinking.css';

export function ThinkingCard({ label, testId, className = '' }: { label: string; testId: string; className?: string }) {
  return (
    <article className={`thinking-card ${className}`.trim()} data-testid={testId} role="status" aria-label={`${label} 생각 중`}>
      <h3 className="thinking-card__member">{label}</h3>
      <span className="thinking-card__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </article>
  );
}
