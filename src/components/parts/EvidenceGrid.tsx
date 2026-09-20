// 근거 카드 2×2 그리드(DESIGN_SPEC.md v1.0 6절 표: "근거 2×2(제목+해석 한 줄, 720은
// 해석만)"). BRIEFING·DISCUSS 오른쪽(회의 정보) 열이 공유한다. 두 해상도 모두 기본
// 접힘이고, 카드를 클릭하면 같은 자리에서 원문·관련 임원 아바타가 펼쳐진다(details
// open을 컴포넌트 상태로 직접 관리 — 닫힌 <details> 본문은 브라우저가 렌더를 건너뛰어
// 자식 CSS만으로는 강제로 펼칠 수 없다). 720에서는 CSS(evidence.css)가 제목을 숨기고
// 해석 한 줄만 남긴다. 한 번에 한 장만 펼친다(아코디언) — 여러 장을 동시에 펼치면
// 고정 높이의 오른쪽 열이 넘쳐 아래 내용이 잘린다(PR #6 Codex 3차 검토). 펼친 원문은
// evidence.css가 2줄로 클램프해 한 장 펼침의 세로 예산을 고정한다.

import { useState } from 'react';
import type { EvidenceCard as EvidenceCardData } from '../../content/types';
import { Avatar } from './Avatar';
import '../../styles/screens/evidence.css';

export interface EvidenceGridProps {
  evidence: EvidenceCardData[];
}

export function EvidenceGrid({ evidence }: EvidenceGridProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  function handleToggle(id: string, open: boolean) {
    setOpenId((previous) => {
      if (open) {
        return id;
      }
      return previous === id ? null : previous;
    });
  }

  return (
    <div className="evidence-grid">
      {evidence.map((card) => {
        const open = openId === card.id;
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
