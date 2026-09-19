// 브리핑 화면: 안건·의장 브리핑 3문장·자료 4장(해석 한 줄 + 관련 임원)·핵심 쟁점
// 3개·조건 미리보기 4칩(읽기 전용)을 보여준다(v0.9, REVISION_DECISIONS_v0.9.md 1-1~1-4).
// 핵심 쟁점 카드는 버튼 조작 없이 상시 표시하고 '체험용 사전 구성'을 함께 보여준다
// (CLAUDE_IMPLEMENTATION.md 5장 첫 문단). 카드가 화면에 렌더되면 세션당 한 번만
// MARK_SUMMARY_SHOWN을 기록한다(briefingSummary는 그 기록용으로만 남아 있다).

import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../../content/types';
import { Avatar } from '../parts/Avatar';
import { useMatchMedia } from '../useMatchMedia';
import '../../styles/screens/briefing.css';

export interface BriefingScreenProps {
  scenario: Scenario;
  onSummaryShown: () => void;
  onNext: () => void;
}

/** stage.css·shell.css와 같은 1280px 경계(무대 열이 40%를 차지해 본문이 더
 * 좁아지는 지점, DESIGN_SPEC.md v1.0 5절). */
const EVIDENCE_COLLAPSE_QUERY = '(max-width: 1280px)';

export function BriefingScreen({ scenario, onSummaryShown, onNext }: BriefingScreenProps) {
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) {
      return;
    }
    hasShownRef.current = true;
    onSummaryShown();
  }, [onSummaryShown]);

  // 1280에서만 details를 실제로 접는다(기본 접힘, 카드별로 펼쳐 둘 수 있다). 1920+
  // 에서는 이 목록과 무관하게 항상 펼친 것으로 취급한다(아래 open 계산) — 네이티브
  // <details>의 열림 상태는 자식 CSS로 덮어쓸 수 없어 open 속성 자체를 제어해야
  // 한다(useMatchMedia.ts 참고).
  const collapseEvidence = useMatchMedia(EVIDENCE_COLLAPSE_QUERY);
  const [openEvidenceIds, setOpenEvidenceIds] = useState<ReadonlySet<string>>(() => new Set());

  function handleToggleEvidence(id: string, open: boolean) {
    setOpenEvidenceIds((previous) => {
      const next = new Set(previous);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  const previewConditions = scenario.previewConditionIds
    .map((id) => scenario.conditions.find((condition) => condition.id === id))
    .filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  return (
    <section className="screen briefing-screen">
      <h2 className="briefing-screen__motion">{scenario.originalMotion.text}</h2>
      <div className="chair-briefing" data-testid="chair-briefing">
        <p className="chair-briefing__situation">{scenario.chairBriefing.situation}</p>
        <p className="chair-briefing__question">{scenario.chairBriefing.question}</p>
        <p className="chair-briefing__role">{scenario.chairBriefing.role}</p>
      </div>
      <div className="briefing-screen__body">
        <div className="briefing-screen__evidence-grid">
          {/* 1280(무대 열 40%)에서는 details로 접혀 제목+한 줄 해석만 보이고, 원자료·
              관련 임원 아바타는 펼쳐야 보인다(DESIGN_SPEC.md v1.0 5절 "1280에서 자료
              카드는 제목+한 줄 해석만 보이고 details로 펼친다"). 1920+에서는 open을
              항상 true로 강제해 늘 펼친 상태로 보여준다 — 문구는 그대로 두고
              summary/본문으로만 나눈다. */}
          {scenario.evidence.map((card) => {
            const open = !collapseEvidence || openEvidenceIds.has(card.id);
            return (
              <details
                key={card.id}
                className="evidence-card"
                data-testid={`evidence-card-${card.id}`}
                open={open}
                onToggle={(event) => handleToggleEvidence(card.id, event.currentTarget.open)}
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
        <aside className="briefing-issues" data-testid="briefing-issues">
          <p className="briefing-issues__badge">체험용 사전 구성</p>
          <h3 className="briefing-issues__heading">핵심 쟁점</h3>
          <ul className="briefing-issues__list">
            {scenario.briefingIssues.map((issue) => (
              <li key={issue.text} className="briefing-issues__item">
                <p className="briefing-issues__text">{issue.text}</p>
                <ul className="briefing-issues__evidence-ids">
                  {issue.evidenceIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="condition-preview" data-testid="condition-preview">
        <p className="condition-preview__heading">
          아래 네 가지를 조건으로 붙이면 임원들의 판단이 달라집니다.
        </p>
        <div className="condition-preview__chips">
          {previewConditions.map((condition) => (
            <span
              key={condition.id}
              className="condition-preview__chip"
              data-testid={`condition-preview-chip-${condition.id}`}
              aria-disabled="true"
            >
              {condition.label}
            </span>
          ))}
        </div>
      </div>
      <p className="briefing-screen__time-note">남은 시간은 충분합니다.</p>
      <button type="button" className="cta" onClick={onNext}>
        의견 듣기
      </button>
    </section>
  );
}
