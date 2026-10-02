// 근거 카드 2×2 그리드. BRIEFING·DISCUSS가 여는 EvidenceDialog 팝업이 공유한다. 화면에는
// 자료 ID(E1~E4)를 쓰지 않고 자료명만 보여준다(T52, 2026-09-23 사용자 — "자료 4장 앞에
// E1~E4 글자는 모두 빼줘"). `data-testid`의 evidence-card-{id}는 자동화용으로만 ID를 쓰고
// 화면 문구에는 쓰지 않는다. Scenario.evidence의 `id` 필드(E1~E4) 자체는 그대로 둔다 —
// 모델이 어떤 자료를 근거로 삼았는지 기록·검증하는 데 쓰인다(evidenceIds).
//
// T52에서 클릭 없이 네 장 모두 자료명·해석·원문을 항상 보여주는 형태로 바뀌었다
// ("읽어도 무슨 말인지 모르겠다"는 참가자 피드백 — 원문을 열어봐야만 보이는 구조를
// 없앴다). T69(2026-10-01, DISCUSS도 BRIEFING과 같은 "근거 자료 보기" 팝업으로 통일)
// 이후로는 이 펼침 형태 하나뿐이라 아코디언(variant='accordion', details/summary)은
// 없앴다 — EvidenceGrid는 항상 EvidenceDialog 안에서만 쓰인다. 원문은 줄 클램프를
// 걸지 않는다(펼칠 컨트롤이 없어 클램프가 뒷부분을 소리 없이 지운다 — PR #10 Codex
// 29차 검토). 화면 문구(원문·해석)에도 자료 ID를 쓰지 않는다 — "E1과 다르다"처럼
// 원문 안에서 다른 자료를 가리킬 때는 자료명으로 쓴다(같은 검토).

import type { EvidenceCard as EvidenceCardData } from '../../content/types';
import '../../styles/screens/evidence.css';

export interface EvidenceGridProps {
  evidence: EvidenceCardData[];
}

// 자료 카드 장식 태그(T64, Main.html "EXHIBIT A · 게시판 운영 기록"). 화면 문구에
// 자료 ID(E1~E4)를 쓰지 않는 규칙(위 주석)을 그대로 지키기 위해 ID 대신 카드 순서로
// A~D를 매긴다 — evidence-card-{id} 같은 자동화용 값이 아니라 순수 장식이다.
const EXHIBIT_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function EvidenceGrid({ evidence }: EvidenceGridProps) {
  return (
    <div className="evidence-grid">
      {evidence.map((card, index) => (
        <article key={card.id} className="evidence-card" data-testid={`evidence-card-${card.id}`}>
          {/* T73(S3b_Discuss_Evidence 시안): 태그+자료명을 한 줄짜리 타자기 라벨로
              합치고(시안은 둘을 같은 글꼴·색으로 이어 쓴다), 해석(insight)을 본문
              한 줄로, 원문(content)을 그 아래 흐린 메타 줄로 둔다. */}
          <h3 className="evidence-card__heading">
            <span className="evidence-card__tag" aria-hidden="true">
              EXHIBIT {EXHIBIT_LETTERS[index % EXHIBIT_LETTERS.length]}
            </span>
            {' · '}
            {card.title}
          </h3>
          <p className="evidence-card__insight">{card.insight}</p>
          <p className="evidence-card__meta">{card.content}</p>
        </article>
      ))}
    </div>
  );
}
