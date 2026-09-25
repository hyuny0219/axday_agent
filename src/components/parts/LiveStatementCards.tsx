// live 모드에서 임원 4명의 한 라운드(OPINIONS/REACTIONS/FOLLOWUP) 상태를 보여준다
// (AGENT_BOARDROOM_SPEC.md 3장, docs/design/DESIGN_SPEC.md "v0.8 화면 추가 요구").
// 역할별로 세 상태만 그린다: 아직 응답 전(판단 중) → 실제 발언 카드(근거 자료명·인용한
// 발언) → 실패(응답 지연·확인 필요). 원문 이외의 새 문구를 만들지 않고 서버가 돌려준
// message·evidenceIds·referencedStatementIds만 그대로 보여준다. 화면에는 evidenceIds의
// E1~E4 표기 대신 자료명만 쓴다(T52).
// variant='reply'(REACTIONS, T40)는 같은 카드를 4열 그리드 대신 내 발언 인용 카드 아래
// 답글형(들여쓰기·연결선)으로 세로로 늘어놓는다. 발언이 온 임원은 시안 테두리로 강조하고
// 아직 판단 중인 임원은 흐리게 둔다(scripted의 "기존 의견 유지"와 같은 위계). 상태 표시
// (판단 중/발언/응답 실패)는 그대로다(PR #4 Codex 검토).

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
  /** 'grid'(기본, OPINIONS 4열) 또는 'reply'(REACTIONS 답글형). */
  variant?: 'grid' | 'reply';
}

// 화면에는 자료 ID(E1~E4)를 쓰지 않고 자료명만 보여준다(T52). 일치하는 자료가 없으면
// (서버가 미지의 ID를 보낸 경우) ID를 그대로 보여줘 디버깅 단서를 남긴다.
function evidenceLabel(scenario: Scenario, id: string): string {
  const card = scenario.evidence.find((item) => item.id === id);
  return card ? card.title : id;
}

function referencedLabel(statements: Statement[], id: string): string {
  const referenced = statements.find((item) => item.id === id);
  return referenced ? `${MEMBER_LABELS[referenced.roleId]}의 발언` : id;
}

const STATUS_TEXT: Record<Extract<RoleStatus, 'pending' | 'failed'>, string> = {
  pending: '판단 중…',
  failed: '응답 지연·확인 필요',
};

/** 임원 4명을 고정 순서(CEO/CFO/CAIO/CISO)로 그린다. roleStatus가 'idle'이면
 * 아직 이 라운드를 시작하지 않은 것이므로 판단 중과 같은 모양으로 보여준다(호출
 * 시작 직전 잠깐의 idle 상태를 참가자에게 별도로 구분해 보여줄 필요는 없다). */
export function LiveStatementCards({
  scenario,
  stage,
  roleStatus,
  statements,
  variant = 'grid',
}: LiveStatementCardsProps) {
  const containerClass = `live-round__cards${variant === 'reply' ? ' live-round__cards--reply' : ''}`;
  return (
    <div className={containerClass} data-testid={`live-round-${stage}`}>
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
