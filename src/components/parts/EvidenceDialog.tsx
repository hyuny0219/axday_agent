// 근거 자료 팝업(T68, 2026-09-30 사용자 요청). BRIEFING 오른쪽 열이 자료 4장(EvidenceGrid
// variant="expanded")을 상시 펼쳐 두면 세로를 많이 차지해 720에서 잘린다 — 그 자리를
// "근거 자료 보기" 버튼 하나로 줄이고(BriefingScreen), 이 팝업에서 4장을 전문으로 본다.
// 저장소에 기존 모달 컴포넌트가 없어(AssistantPanel은 오른쪽 열 위에 겹치는 인라인
// 드로어일 뿐 role="dialog"·포커스 트랩이 없다) 여기서 직접 만든다.
//
// T73(S3b_Discuss_Evidence 시안 그대로): 좌상단 CASE 칩 + CONFIDENTIAL 도장을 더했다.
// 본문은 EXHIBIT(근거 4장)과 STATEMENTS(임원이 한 말) 두 열이었으나, T105(2026-10-09
// 사용자 — "근거 자료 및 임원 발언에서 임원 발언은 아예 제거해 주고 근거 자료만 보여
// 주게끔 해")에서 임원 발언 열을 없애고 자료 4장이 팝업 폭을 모두 쓴다. BRIEFING·DISCUSS·
// REACTIONS가 같은 컴포넌트를 그대로 공유한다.
//
// 접근성: role="dialog" aria-modal="true" aria-labelledby로 제목을 가리키고, 열리면
// 닫기 버튼에 포커스를 준 뒤(자료 카드에는 포커스 가능한 요소가 없다), Tab은 팝업
// 안에서만 순환한다. 닫히면(Esc·딤 클릭·닫기 버튼 세 경로 모두) 팝업을 열기 직전
// 포커스였던 요소로 되돌린다 — 트리거를 prop으로 받지 않고 마운트 시점의
// document.activeElement를 그대로 기억한다(어느 버튼에서 열든 같은 규칙으로 동작).
// T89(2026-10-07 사용자 — "AI 비서실장의 팝업창을 근거 자료 팝업과 동일한 디자인으로"):
// 위 껍데기(딤·포커스 트랩·Esc·스크롤 잠금·도장·제목·닫기·하단 안내)를 공용
// DialogShell(parts/DialogShell.tsx)로 떼어내 AssistantPanel과 함께 쓴다. 이 파일은
// 자료 본문만 그린다.
import type { EvidenceCard as EvidenceCardData, Scenario } from '../../content/types';
import { EvidenceGrid } from './EvidenceGrid';
import { DialogShell } from './DialogShell';
import '../../styles/screens/evidenceDialog.css';

export interface EvidenceDialogProps {
  evidence: EvidenceCardData[];
  /** 있으면 자료 카드 해석의 핵심 말을 굵게 표시한다(T105). */
  scenario?: Scenario;
  /** 좌상단 CASE 칩(시안 "CASE 02"). */
  caseTag: string;
  onClose: () => void;
}

export function EvidenceDialog({ evidence, scenario, caseTag, onClose }: EvidenceDialogProps) {
  return (
    <DialogShell
      testId="evidence-dialog"
      titleId="evidence-dialog-title"
      title="근거 자료"
      stamp="CONFIDENTIAL"
      eyebrow={caseTag}
      onClose={onClose}
      closeTestId="evidence-dialog-close"
    >
      <div className="evidence-dialog__body">
        <span className="evidence-dialog__column-label">자료 ①~④ · 판단에 참고할 자료</span>
        <EvidenceGrid evidence={evidence} scenario={scenario} />
      </div>
    </DialogShell>
  );
}
