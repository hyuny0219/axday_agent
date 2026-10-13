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
//
// T80(2026-10-02, Main.html EXHIBIT 2×2): BRIEFING 오른쪽 열이 팝업 없이도 자료 요약을
// 상시 보여줘야 해서(사용자 결정) `variant='compact'`를 더했다 — 마크업은
// `variant='dialog'`(기본, EvidenceDialog 전용)와 완전히 같고 evidence.css가 치수만
// 덮어쓴다(해석·원문 각 1~2줄 클램프, 글자 작게). testid만 `evidence-summary-<id>`로
// 바꿔 팝업 쪽 `evidence-card-<id>`와 겹치지 않게 한다 — 팝업이 열리면 배경의 압축
// 카드와 팝업 안 전문 카드가 동시에 DOM에 있어야 하기 때문이다.

import type { EvidenceCard as EvidenceCardData, Scenario } from '../../content/types';
import { evidenceTextHighlightTerms } from '../highlightTerms';
import { HighlightText } from './HighlightText';
import '../../styles/screens/evidence.css';

export interface EvidenceGridProps {
  evidence: EvidenceCardData[];
  /** 'dialog'(기본, EvidenceDialog 팝업 전문 — 원문 클램프 없음) | 'compact'(BRIEFING
   * 오른쪽 열 상시 요약 카드, Main.html EXHIBIT 2×2 — 해석·원문 각 1~2줄 클램프). */
  variant?: 'dialog' | 'compact';
  /** 있으면 해석(insight) 속 핵심 수치·사실을 굵게 표시한다(T105). 제목은 제외. */
  scenario?: Scenario;
}

// 자료 카드 장식 태그(T64, Main.html "EXHIBIT A · 게시판 운영 기록", T83에서
// "자료 ①" 형식으로 한국어화). 화면 문구에 자료 ID(E1~E4)를 쓰지 않는 규칙(위 주석)을
// 그대로 지키기 위해 ID 대신 카드 순서로 ①~④를 매긴다 — evidence-card-{id} 같은
// 자동화용 값이 아니라 순수 장식이다.
const EXHIBIT_MARKS = ['①', '②', '③', '④'] as const;

export function EvidenceGrid({ evidence, variant = 'dialog', scenario }: EvidenceGridProps) {
  const isCompact = variant === 'compact';
  return (
    <div className={isCompact ? 'evidence-grid evidence-grid--compact' : 'evidence-grid'}>
      {evidence.map((card, index) => (
        <article
          key={card.id}
          className={isCompact ? 'evidence-card evidence-card--compact' : 'evidence-card'}
          data-testid={isCompact ? `evidence-summary-${card.id}` : `evidence-card-${card.id}`}
        >
          {/* T73(S3b_Discuss_Evidence 시안): 태그+자료명을 한 줄짜리 타자기 라벨로
              합치고(시안은 둘을 같은 글꼴·색으로 이어 쓴다), 해석(insight)을 본문
              한 줄로, 원문(content)을 그 아래 흐린 메타 줄로 둔다. */}
          <h3 className="evidence-card__heading">
            <span className="evidence-card__tag" aria-hidden="true">
              자료 {EXHIBIT_MARKS[index % EXHIBIT_MARKS.length]}
            </span>
            {' · '}
            {card.title}
          </h3>
          <p className="evidence-card__insight">
            <HighlightText text={card.insight} terms={scenario ? evidenceTextHighlightTerms(scenario, card.insight) : []} />
          </p>
          {/* T99(2026-10-08 사용자 — "글씨가 너무 많다"): 원문(content)은 카드에서 뺐다. 해석
              한 문장(insight)과 관련 임원만 보인다. content는 데이터·서버 프롬프트용으로 남는다. */}
          {card.relatedMemberIds.length > 0 && (
            <p className="evidence-card__meta">관련 임원 · {card.relatedMemberIds.join(' · ')}</p>
          )}
        </article>
      ))}
    </div>
  );
}
