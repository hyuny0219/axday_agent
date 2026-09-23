// 근거 카드 2×2 그리드. BRIEFING·DISCUSS 오른쪽(회의 정보) 열이 공유한다. 화면에는 자료
// ID(E1~E4)를 쓰지 않고 자료명만 보여준다(T52, 2026-09-23 사용자 — "자료 4장 앞에 E1~E4
// 글자는 모두 빼줘"). `data-testid`의 evidence-card-{id}는 자동화용으로만 ID를 쓰고
// 화면 문구에는 쓰지 않는다. Scenario.evidence의 `id` 필드(E1~E4) 자체는 그대로 둔다 —
// 모델이 어떤 자료를 근거로 삼았는지 기록·검증하는 데 쓰인다(evidenceIds).
//
// variant='accordion'(기본, DiscussScreen): 두 해상도 모두 기본 접힘이고, 카드를 클릭하면
// 같은 자리에서 원문·관련 임원 아바타가 펼쳐진다(details open을 컴포넌트 상태로 직접
// 관리 — 닫힌 <details> 본문은 브라우저가 렌더를 건너뛰어 자식 CSS만으로는 강제로 펼칠 수
// 없다). 한 번에 한 장만 펼친다(아코디언) — 여러 장을 동시에 펼치면 고정 높이의 오른쪽
// 열이 넘쳐 아래 내용이 잘린다(PR #6 Codex 3차 검토). 펼친 원문은 evidence.css가 2줄로
// 클램프해 한 장 펼침의 세로 예산을 고정한다.
// variant='expanded'(BriefingScreen, T52): 클릭 없이 네 장 모두 자료명·해석·원문을 항상
// 보여준다("읽어도 무슨 말인지 모르겠다"는 참가자 피드백 — 원문을 열어봐야만 보이는
// 구조를 없앴다). 세로 예산을 지키려고 관련 임원 아바타는 뺀다.

import { useState } from 'react';
import type { EvidenceCard as EvidenceCardData } from '../../content/types';
import { Avatar } from './Avatar';
import '../../styles/screens/evidence.css';

export interface EvidenceGridProps {
  evidence: EvidenceCardData[];
  variant?: 'accordion' | 'expanded';
}

export function EvidenceGrid({ evidence, variant = 'accordion' }: EvidenceGridProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  function handleToggle(id: string, open: boolean) {
    setOpenId((previous) => {
      if (open) {
        return id;
      }
      return previous === id ? null : previous;
    });
  }

  if (variant === 'expanded') {
    return (
      <div className="evidence-grid evidence-grid--expanded">
        {evidence.map((card) => (
          <article
            key={card.id}
            className="evidence-card evidence-card--expanded"
            data-testid={`evidence-card-${card.id}`}
          >
            <h3 className="evidence-card__title">{card.title}</h3>
            <p className="evidence-card__insight">{card.insight}</p>
            <p className="evidence-card__content evidence-card__content--expanded">{card.content}</p>
          </article>
        ))}
      </div>
    );
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
              <h3 className="evidence-card__title">{card.title}</h3>
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
