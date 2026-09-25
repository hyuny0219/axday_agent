// 임원 의견 화면: 임원 4명의 한 줄 의견을 보여주고, 펼치면 근거 자료를 보여준다
// (CLAUDE_IMPLEMENTATION.md 3장 OPINIONS 행). live 모드에서는 사전 구성된
// scenario.initialOpinions 대신 실제 OPINIONS 라운드 결과(roleStatus·statements)를
// 보여준다(T30, AGENT_BOARDROOM_SPEC.md 3장). 라운드는 App.tsx가 이 단계에 들어올 때
// 자동으로 시작하므로 이 화면은 상태만 그린다.
// T45(조종석 배치): 왼쪽 열은 "내 의견 말하기" CTA만, 오른쪽 열은 임원 4장 카드를
// 담는다(DESIGN_SPEC.md v1.0 6절 표).

import { useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { RoleStatus, Statement } from '../../domain/types';
import { MEMBER_LABELS } from '../memberLabels';
import { Avatar } from '../parts/Avatar';
import { LiveStatementCards } from '../parts/LiveStatementCards';
import '../../styles/screens/opinions.css';

export interface OpinionsScreenProps {
  scenario: Scenario;
  mode: 'live' | 'scripted';
  roleStatus: Record<ExecMemberId, RoleStatus>;
  statements: Statement[];
  onNext: () => void;
}

export function OpinionsScreen({ scenario, mode, roleStatus, statements, onNext }: OpinionsScreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = (
    <div className="app-body__actions screen opinions-screen">
      <button type="button" className="cta" onClick={onNext}>
        내 의견 말하기
      </button>
    </div>
  );

  if (mode === 'live') {
    return (
      <>
        {actions}
        <div className="app-body__content screen opinions-screen__info">
          <h2 className="opinions-screen__title">임원들의 첫 의견</h2>
          <LiveStatementCards scenario={scenario} stage="OPINIONS" roleStatus={roleStatus} statements={statements} />
        </div>
      </>
    );
  }

  return (
    <>
      {actions}
      <div className="app-body__content screen opinions-screen__info">
        <h2 className="opinions-screen__title">임원들의 첫 의견</h2>
        <div className="opinions-screen__cards">
          {scenario.initialOpinions.map((opinion) => {
            const expanded = expandedId === opinion.memberId;
            return (
              <article key={opinion.memberId} className="opinion-card">
                <div className="opinion-card__head">
                  <Avatar memberId={opinion.memberId} size="sm" />
                  <h3 className="opinion-card__member">{MEMBER_LABELS[opinion.memberId]}</h3>
                </div>
                <p className="opinion-card__text">{opinion.text}</p>
                <button
                  type="button"
                  className="opinion-card__toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : opinion.memberId)}
                >
                  {expanded ? '근거 접기' : '근거 보기'}
                </button>
                {expanded && (
                  <ul className="opinion-card__evidence">
                    {opinion.evidenceIds.map((id) => {
                      const card = scenario.evidence.find((item) => item.id === id);
                      // 화면에는 자료 ID(E1~E4)를 쓰지 않고 자료명만 보여준다(T52).
                      return <li key={id}>{card ? `${card.title}: ${card.content}` : ''}</li>;
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
