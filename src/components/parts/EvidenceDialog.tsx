// 근거 자료 팝업(T68, 2026-09-30 사용자 요청). BRIEFING 오른쪽 열이 자료 4장(EvidenceGrid
// variant="expanded")을 상시 펼쳐 두면 세로를 많이 차지해 720에서 잘린다 — 그 자리를
// "근거 자료 보기" 버튼 하나로 줄이고(BriefingScreen), 이 팝업에서 4장을 전문으로 본다.
// 저장소에 기존 모달 컴포넌트가 없어(AssistantPanel은 오른쪽 열 위에 겹치는 인라인
// 드로어일 뿐 role="dialog"·포커스 트랩이 없다) 여기서 직접 만든다.
//
// T73(S3b_Discuss_Evidence 시안 그대로): 좌상단 CASE 칩 + CONFIDENTIAL 도장을 더하고,
// 본문을 EXHIBIT(근거 4장, 왼쪽)·STATEMENTS(임원이 한 말, 오른쪽) 두 열로 나눈다.
// STATEMENTS는 DISCUSS가 넘기는 02 임원 의견 발언(live면 transcript, scripted면
// initialOpinions)을 보여주고, BRIEFING은 아직 임원 의견이 없으므로 statements를 빈
// 배열로 넘겨 안내 한 줄만 보여준다 — 같은 컴포넌트를 두 화면이 그대로 공유한다.
// T74(REACTIONS): STATEMENTS 열에 02 임원 의견 + 04 반응 발언을 함께 보여줄 때는 각
// 항목에 stage를 실어 단계 태그(예: "02 임원 의견"/"04 반응")를 붙이고 testid도
// 단계별로 나눈다 — 비우면(DISCUSS·BRIEFING) 태그 없이 기존 모양·testid 그대로다.
// statementsColumnLabel도 REACTIONS만 다른 문구("임원이 한 말(02 의견 + 04 반응)")로
// 덮어쓸 수 있게 했다.
//
// 접근성: role="dialog" aria-modal="true" aria-labelledby로 제목을 가리키고, 열리면
// 닫기 버튼에 포커스를 준 뒤(자료·발언 카드에는 포커스 가능한 요소가 없다), Tab은 팝업
// 안에서만 순환한다. 닫히면(Esc·딤 클릭·닫기 버튼 세 경로 모두) 팝업을 열기 직전
// 포커스였던 요소로 되돌린다 — 트리거를 prop으로 받지 않고 마운트 시점의
// document.activeElement를 그대로 기억한다(어느 버튼에서 열든 같은 규칙으로 동작).
// T89(2026-10-07 사용자 — "AI 비서실장의 팝업창을 근거 자료 팝업과 동일한 디자인으로"):
// 위 껍데기(딤·포커스 트랩·Esc·스크롤 잠금·도장·제목·닫기·하단 안내)를 공용
// DialogShell(parts/DialogShell.tsx)로 떼어내 AssistantPanel과 함께 쓴다. 이 파일은
// 이제 EXHIBIT·STATEMENTS 2열 본문만 그린다 — 동작·testid는 전혀 바뀌지 않았다.
import type { EvidenceCard as EvidenceCardData, ExecMemberId } from '../../content/types';
import type { Stance, StatementStage } from '../../domain/types';
import { EvidenceGrid } from './EvidenceGrid';
import { DialogShell } from './DialogShell';
import { MEMBER_LABELS } from '../memberLabels';
import { STANCE_LABEL } from '../moodLabel';
import '../../styles/screens/evidenceDialog.css';

/** 단계 태그 문구(T74, REACTIONS만 쓴다). */
const STAGE_TAG_LABEL: Record<StatementStage, string> = {
  OPINIONS: '02 임원 의견',
  REACTIONS: '04 반응',
  FOLLOWUP: '04 반응',
};

/** STATEMENTS 열 한 줄. DiscussScreen·ReactionsScreen이 live/scripted에 맞춰 만들어
 * 넘긴다. */
export interface EvidenceDialogStatementView {
  memberId: ExecMemberId;
  stance: Stance;
  status: 'answered' | 'pending' | 'failed';
  /** status==='answered'일 때만 쓴다. */
  text: string;
  /** status==='answered'일 때만 쓴다(없으면 null). */
  evidenceLabel: string | null;
  /** live 응답만 statement-card-, statement-pending-, statement-failed- testid를 쓴다
   * (OpinionsScreen·옛 DiscussScreen과 같은 규칙 — e2e가 그 testid로 live 경로만
   * 가려 본다). scripted 각본 문장은 testid 없이 보여준다. */
  testable: boolean;
  /** 단계 표시(T74, REACTIONS만). 같은 임원의 여러 단계 발언을 함께 보여줄 때(02 의견 +
   * 04 반응) 각 항목 앞에 단계 태그를 붙이고 testid에도 단계를 더해 구분한다. 비우면
   * (DISCUSS·BRIEFING) 태그 없이 기존 모양 그대로다. */
  stage?: StatementStage;
}

export interface EvidenceDialogProps {
  evidence: EvidenceCardData[];
  /** 좌상단 CASE 칩(시안 "CASE 02"). */
  caseTag: string;
  /** STATEMENTS 열. 비어 있으면(BRIEFING) 빈 상태 한 줄을 보여준다. */
  statements: EvidenceDialogStatementView[];
  /** STATEMENTS 열 라벨(기본 DISCUSS 값 그대로). REACTIONS(T74)는 02 의견 + 04 반응을
   * 함께 보여주므로 다른 문구로 덮어쓴다. */
  statementsColumnLabel?: string;
  onClose: () => void;
}

/** 발언 카드 왼쪽 띠·stance 글자색에 쓰는 소문자 modifier(OpinionsScreen의
 * STANCE_MODIFIER와 같은 값, evidenceDialog.css가 읽는다). */
const STANCE_MODIFIER: Record<Stance, 'for' | 'against' | 'undecided'> = {
  FOR: 'for',
  AGAINST: 'against',
  UNDECIDED: 'undecided',
};

/** live pending/failed 문구(LiveStatementCards.STATUS_TEXT와 같은 값 — 두 화면이
 * 같은 말로 "아직 응답 없음"을 보여줘야 한다). */
const STATUS_TEXT: Record<'pending' | 'failed', string> = {
  pending: '생각을 정리하고 있습니다…',
  failed: '이번에는 답을 받지 못했습니다',
};

export function EvidenceDialog({
  evidence,
  caseTag,
  statements,
  statementsColumnLabel = '임원이 한 말(02 임원 의견)',
  onClose,
}: EvidenceDialogProps) {
  return (
    <DialogShell
      testId="evidence-dialog"
      titleId="evidence-dialog-title"
      title="근거 자료 · 임원 발언"
      stamp="CONFIDENTIAL"
      eyebrow={caseTag}
      onClose={onClose}
      closeTestId="evidence-dialog-close"
    >
      <div className="evidence-dialog__body">
        <div className="evidence-dialog__column evidence-dialog__column--exhibits">
          <span className="evidence-dialog__column-label">자료 ①~④ · 판단에 참고할 자료</span>
          <EvidenceGrid evidence={evidence} />
        </div>
        <div className="evidence-dialog__column evidence-dialog__column--statements">
          <span className="evidence-dialog__column-label">{statementsColumnLabel}</span>
          {statements.length === 0 ? (
            <p className="evidence-dialog__statements-empty" data-testid="evidence-dialog-statements-empty">
              02 단계에서 임원이 말하면 여기에 쌓입니다
            </p>
          ) : (
            <div className="evidence-dialog__statements">
              {statements.map((item) => {
                const stageSuffix = item.stage ? `-${item.stage.toLowerCase()}` : '';
                return (
                <article
                  key={`${item.memberId}${stageSuffix}`}
                  className={`evidence-dialog__statement evidence-dialog__statement--${STANCE_MODIFIER[item.stance]}`}
                >
                  <div className="evidence-dialog__statement-head">
                    {item.stage && (
                      <span className="evidence-dialog__statement-stage">{STAGE_TAG_LABEL[item.stage]}</span>
                    )}
                    <h3 className="evidence-dialog__statement-member">{MEMBER_LABELS[item.memberId]}</h3>
                    <span className="evidence-dialog__statement-mood">{STANCE_LABEL[item.stance]}</span>
                    {item.status === 'answered' && item.evidenceLabel && (
                      <span className="evidence-dialog__statement-evidence">근거 · {item.evidenceLabel}</span>
                    )}
                  </div>
                  {item.status === 'answered' ? (
                    <p
                      className="evidence-dialog__statement-text"
                      data-testid={item.testable ? `statement-card-${item.memberId}${stageSuffix}` : undefined}
                    >
                      {item.text}
                    </p>
                  ) : (
                    <p
                      className="evidence-dialog__statement-text"
                      data-testid={`statement-${item.status}-${item.memberId}${stageSuffix}`}
                    >
                      {STATUS_TEXT[item.status]}
                    </p>
                  )}
                </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
