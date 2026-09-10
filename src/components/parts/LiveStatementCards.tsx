// live 모드에서 임원 4명의 한 라운드(OPINIONS/REACTIONS/FOLLOWUP) 상태를 보여준다
// (AGENT_BOARDROOM_SPEC.md 3장, docs/design/DESIGN_SPEC.md "v0.8 화면 추가 요구").
// 역할별로 세 상태만 그린다: 아직 응답 전(판단 중) → 실제 발언 카드(근거 ID·인용한
// 발언) → 실패(응답 지연·확인 필요). 원문 이외의 새 문구를 만들지 않고 서버가 돌려준
// message·evidenceIds·referencedStatementIds만 그대로 보여준다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type { RoleStatus, Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { Avatar } from './Avatar';
import '../../styles/screens/live.css';

export interface LiveStatementCardsProps {
  scenario: Scenario;
  stage: StatementStage;
  roleStatus: Record<ExecMemberId, RoleStatus>;
  /** 회의 기록 전체(현재 단계가 아닌 발언도 포함) — referencedStatementIds가 가리키는
   * 다른 단계의 발언을 찾아 인용 미리보기를 만들 때 쓴다. */
  statements: Statement[];
}

function evidenceLabel(scenario: Scenario, id: string): string {
  const card = scenario.evidence.find((item) => item.id === id);
  return card ? `${id} · ${card.title}` : id;
}

function referencedLabel(statements: Statement[], id: string): string {
  const referenced = statements.find((item) => item.id === id);
  return referenced ? `${MEMBER_LABELS[referenced.roleId]}의 발언` : id;
}

const STATUS_TEXT: Record<Extract<RoleStatus, 'pending' | 'failed'>, string> = {
  pending: '판단 중…',
  failed: '응답 지연·확인 필요',
};

/** 임원 4명을 고정 순서(CEO/CFO·CAIO/CIO/CISO)로 그린다. roleStatus가 'idle'이면
 * 아직 이 라운드를 시작하지 않은 것이므로 판단 중과 같은 모양으로 보여준다(호출
 * 시작 직전 잠깐의 idle 상태를 참가자에게 별도로 구분해 보여줄 필요는 없다). */
export function LiveStatementCards({ scenario, stage, roleStatus, statements }: LiveStatementCardsProps) {
  return (
    <div className="live-round__cards" data-testid={`live-round-${stage}`}>
      {EXEC_MEMBER_ORDER.map((roleId) => {
        const status = roleStatus[roleId];
        const statement = statements.find((item) => item.roleId === roleId && item.stage === stage);

        return (
          <article
            key={roleId}
            className={`live-statement live-statement--${status}`}
            data-testid={`live-role-${roleId}`}
          >
            <div className="live-statement__head">
              <Avatar memberId={roleId} size="sm" />
              <h3 className="live-statement__member">{MEMBER_LABELS[roleId]}</h3>
            </div>
            {status === 'answered' && statement ? (
              <div data-testid={`statement-card-${roleId}`}>
                <p className="live-statement__text">{statement.text}</p>
                {statement.evidenceIds.length > 0 && (
                  <ul className="live-statement__evidence">
                    {statement.evidenceIds.map((id) => (
                      <li key={id}>{evidenceLabel(scenario, id)}</li>
                    ))}
                  </ul>
                )}
                {statement.referencedStatementIds.length > 0 && (
                  <p className="live-statement__references">
                    인용:{' '}
                    {statement.referencedStatementIds
                      .map((id) => referencedLabel(statements, id))
                      .join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p
                className="live-statement__status-text"
                data-testid={status === 'failed' ? `statement-failed-${roleId}` : `statement-pending-${roleId}`}
              >
                {status === 'failed' ? STATUS_TEXT.failed : STATUS_TEXT.pending}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
