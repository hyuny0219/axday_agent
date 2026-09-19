// 근거 카드 2×2 그리드(DESIGN_SPEC.md v1.0 6절 표: "근거 2×2(제목+해석 한 줄, 720은
// 해석만)"). BRIEFING·DISCUSS 오른쪽(회의 정보) 열이 공유한다. 두 해상도 모두 기본
// 접힘이고, 카드를 클릭하면 같은 자리에서 원문·관련 임원 아바타가 펼쳐진다(details
// open을 컴포넌트 상태로 직접 관리 — 닫힌 <details> 본문은 브라우저가 렌더를 건너뛰어
// 자식 CSS만으로는 강제로 펼칠 수 없다). 720에서는 CSS(evidence.css)가 제목을 숨기고
// 해석 한 줄만 남긴다.

import { useState } from 'react';
import type { EvidenceCard as EvidenceCardData } from '../../content/types';
import { Avatar } from './Avatar';
import '../../styles/screens/evidence.css';

export interface EvidenceGridProps {
  evidence: EvidenceCardData[];
}

export function EvidenceGrid({ evidence }: EvidenceGridProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  function handleToggle(id: string, open: boolean) {
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  return (
    <div className="evidence-grid">
      {evidence.map((card) => {
        const open = openIds.has(card.id);
        return (
          <details
            key={card.id}
            className="evidence-card"
            data-testid={`evidence-card-${card.id}`}
            open={open}
            onToggle={(event) => handleToggle(card.id, event.currentTarget.open)}
          >
            <summary className="evidence-card__summary">
              <h3 className="evidence-card__title">
                {card.id} · {card.title}
              </h3>
              <p className="evidence-card__insight-label">이 자료가 말하는 것</p>
              <p className="evidence-card__insight">{card.insight}</p>
            </summary>
            <p className="evidence-card__content">{card.content}</p>
            <div className="evidence-card__avatars">
              {card.relatedMemberIds.map((memberId) => (
                <Avatar key={memberId} memberId={memberId} size="sm" />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
