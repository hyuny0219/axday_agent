// 무대 표정 배지(StageBand, aria-hidden)의 접근 가능한 대응 텍스트를 임원 카드가 없는 화면
// (MOTION·VOTE)에도 둔다(PR #11 Codex 13차 P2). 시각적으로는 감추고 스크린리더에만 남긴다 —
// 두 화면은 세로 예산이 빠듯하고 표정은 무대에서 이미 보이기 때문이다. testid는 임원 카드의
// exec-mood-label-<id>와 같아 e2e가 같은 방식으로 읽는다.

import type { ExecMemberId } from '../../content/types';
import type { Stance } from '../../domain/types';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { STANCE_LABEL } from '../moodLabel';

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export interface ExecStanceListProps {
  stances: Record<ExecMemberId, Stance>;
}

export function ExecStanceList({ stances }: ExecStanceListProps) {
  return (
    <ul style={SR_ONLY} aria-label="임원 입장" data-testid="exec-stance-list">
      {EXEC_MEMBER_ORDER.map((memberId) => (
        <li key={memberId} data-testid={`exec-mood-label-${memberId}`}>
          {MEMBER_LABELS[memberId]} {STANCE_LABEL[stances[memberId]]}
        </li>
      ))}
    </ul>
  );
}
