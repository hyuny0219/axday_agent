// live 모드에서 임원 4명의 한 라운드(OPINIONS/REACTIONS/FOLLOWUP) 상태를 보여준다
// (AGENT_BOARDROOM_SPEC.md 3장, docs/design/DESIGN_SPEC.md "v0.8 화면 추가 요구").
// 역할별로 세 상태만 그린다: 아직 응답 전(판단 중) → 실제 발언 카드(근거 자료명·인용한
// 발언) → 실패(응답 지연·확인 필요). 원문 이외의 새 문구를 만들지 않고 서버가 돌려준
// message·evidenceIds·referencedStatementIds만 그대로 보여준다. 화면에는 evidenceIds의
// E1~E4 표기 대신 자료명만 쓴다(T52).
// T65: 실패한 역할이 있으면 보조 버튼 "응답 없는 임원 다시 요청"을 보여준다. 호출부
// (OpinionsScreen·ReactionsScreen)가 실패한 roleId 목록을 계산해 onRetryFailedRoles로
// 넘긴다 — 이 컴포넌트는 자동 재시도를 하지 않고, 눌렀을 때만 한 번 부른다(라운드당 1회
// 제한은 호출부의 상태다).
// T72(S2_Opinions 시안 그대로): variant='grid'(OPINIONS)는 OpinionsScreen의
// .opinion-card(scripted)와 같은 시안 카드 모양(타자기 역할 코드·역할색 왼쪽 띠·
// "근거 · <자료명>" pill 하나)을 쓴다. 옛 variant='reply'는 S4_Reactions 이전의
// 답글형(아바타·들여쓰기·연결선)이었으나 T74에서 걷어냈다(더 쓰는 화면이 없다).
// T74(S4_Reactions 시안 그대로): variant='reaction'(REACTIONS)은 'grid'와 같은 틀
// (종이-2 배경·1px 테두리·역할색 왼쪽 4px 띠)을 쓰지만 머리줄은 더 작고 코드 칩·
// 아바타가 없다(시안에 없다). 상태 칩은 판단 중/응답 없음 대신 유지/바뀜/응답 없음을
// 보여준다 — "바뀜" 여부는 서버가 따로 내려주지 않으므로 같은 역할의 OPINIONS 발언과
// 이번 REACTIONS 발언 텍스트가 같은지(trim 비교)로 가른다. 실패 카드는 "응답 없는
// 임원 다시 요청" 버튼을 (그리드 아래 공용 버튼이 아니라) 카드 안에 그대로 그린다
// (시안 그대로 — 실패가 한 명뿐인 보통 경로에서만 검증했다).

import type { ExecMemberId, Scenario } from '../../content/types';
import type { RoleStatus, Stance, Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { STANCE_LABEL } from '../moodLabel';
import '../../styles/screens/live.css';

/** 카드 역할색 띠·상태 칩 색에 쓰는 소문자 modifier(live.css가 읽는다). OpinionsScreen의
 * STANCE_MODIFIER와 같은 값이다. */
const STANCE_MODIFIER: Record<Stance, 'for' | 'against' | 'undecided'> = {
  FOR: 'for',
  AGAINST: 'against',
  UNDECIDED: 'undecided',
};

export interface LiveStatementCardsProps {
  scenario: Scenario;
  stage: StatementStage;
  roleStatus: Record<ExecMemberId, RoleStatus>;
  /** 회의 기록 전체(현재 단계가 아닌 발언도 포함) — referencedStatementIds가 가리키는
   * 다른 단계의 발언을 찾아 인용 미리보기를 만들 때 쓴다. */
  statements: Statement[];
  /** 무대 표정 배지의 접근 가능한 대응 텍스트(T63, "찬성 쪽/반대 쪽/미정"). */
  stances: Record<ExecMemberId, Stance>;
  /** 'grid'(기본, OPINIONS 4열) 또는 'reaction'(REACTIONS 2×2, T74). */
  variant?: 'grid' | 'reaction';
  /** 있으면 실패한 역할이 하나 이상일 때 "응답 없는 임원 다시 요청" 버튼을 보여준다(T65).
   * 없으면(scripted 등) 버튼을 그리지 않는다. */
  onRetryFailedRoles?: () => void;
  /** 라운드당 1회 제한(T65) — 호출부가 이미 한 번 눌렀으면 true로 넘겨 버튼을 잠근다. */
  retryDisabled?: boolean;
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

// DiscussScreen도 live 모드 임원 카드에 같은 문구를 그대로 써야 하므로(Codex 18차 검토 P2)
// export한다 — 참가자가 아직 답이 없는 임원을 두 화면에서 다른 말로 보면 안 된다.
export const STATUS_TEXT: Record<Extract<RoleStatus, 'pending' | 'failed'>, string> = {
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
  stances,
  variant = 'grid',
  onRetryFailedRoles,
  retryDisabled = false,
}: LiveStatementCardsProps) {
  const isGrid = variant === 'grid';
  const isReaction = variant === 'reaction';
  const hasFailedRole = EXEC_MEMBER_ORDER.some((roleId) => roleStatus[roleId] === 'failed');
  // REACTIONS(변형 'reaction')는 실패 카드 안에 재요청 버튼을 그대로 그리므로(시안)
  // 그리드 아래 공용 버튼은 그리지 않는다 — 같은 testid가 두 곳에 생겨 strict 모드
  // 단언이 깨지는 것을 막는다.
  const retryButtonNode =
    onRetryFailedRoles && hasFailedRole && !isReaction ? (
      <button
        type="button"
        className="live-round__retry cta cta--secondary"
        data-testid="retry-failed-roles"
        disabled={retryDisabled}
        onClick={onRetryFailedRoles}
      >
        {retryDisabled ? '다시 요청함 · 응답 없는 임원은 회의록에 남습니다' : '응답 없는 임원 다시 요청'}
      </button>
    ) : null;

  return (
    <div className="live-round">
      <div className="live-round__cards" data-testid={`live-round-${stage}`}>
      {EXEC_MEMBER_ORDER.map((roleId) => {
        const status = roleStatus[roleId];
        const statement = statements.find((item) => item.roleId === roleId && item.stage === stage);
        const stance = stances[roleId];
        // REACTIONS만: 같은 역할의 OPINIONS 발언과 텍스트가 같으면(또는 OPINIONS 발언이
        // 없으면 — 비교 대상이 없으니 "유지"로 본다) "유지", 다르면 "바뀜"이다.
        const opinionStatement = isReaction
          ? statements.find((item) => item.roleId === roleId && item.stage === 'OPINIONS')
          : undefined;
        const isMaintained =
          isReaction &&
          status === 'answered' &&
          !!statement &&
          (!opinionStatement || opinionStatement.text.trim() === statement.text.trim());

        return (
          <article
            key={roleId}
            className={`live-statement live-statement--${status}${
              isGrid || isReaction ? ` live-statement--grid live-statement--stance-${STANCE_MODIFIER[stance]}` : ''
            }${isReaction ? ' live-statement--reaction' : ''}${isMaintained ? ' live-statement--maintained' : ''}`}
            data-testid={`live-role-${roleId}`}
          >
            <div className="live-statement__head">
              {/* OPINIONS(시안 S2_Opinions)는 아바타 대신 타자기 역할 코드를 쓰고,
                  REACTIONS(시안 S4_Reactions)는 코드·아바타 모두 없다. */}
              {isGrid && (
                <span className="live-statement__code" aria-hidden="true">
                  {roleId}
                </span>
              )}
              <h3 className="live-statement__member">{MEMBER_LABELS[roleId]}</h3>
              <span
                className={`live-statement__mood${
                  isGrid || isReaction ? ` live-statement__mood--${STANCE_MODIFIER[stance]}` : ''
                }`}
                data-testid={`exec-mood-label-${roleId}`}
              >
                {STANCE_LABEL[stance]}
              </span>
            </div>
            {status === 'answered' && statement ? (
              <div data-testid={`statement-card-${roleId}`}>
                <p className="live-statement__text">{statement.text}</p>
                {isGrid &&
                  // 시안은 "근거 · <자료명>" pill 하나만 둔다(evidenceIds가 여럿이면
                  // 마지막 것, OpinionsScreen.lastEvidenceLabel과 같은 규칙). REACTIONS
                  // 카드(시안)는 근거 pill·인용을 보여주지 않는다.
                  statement.evidenceIds.length > 0 && (
                    <span className="live-statement__evidence-pill">
                      근거 · {evidenceLabel(scenario, statement.evidenceIds[statement.evidenceIds.length - 1]!)}
                    </span>
                  )}
                {isGrid && statement.referencedStatementIds.length > 0 && (
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
            {isReaction && status === 'failed' && onRetryFailedRoles && (
              <button
                type="button"
                className="live-statement__retry cta cta--secondary"
                data-testid="retry-failed-roles"
                disabled={retryDisabled}
                onClick={onRetryFailedRoles}
              >
                {retryDisabled ? '다시 요청함 · 응답 없는 임원은 회의록에 남습니다' : '응답 없는 임원 다시 요청'}
              </button>
            )}
          </article>
        );
      })}
      </div>
      {retryButtonNode}
    </div>
  );
}
