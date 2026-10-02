// PR #12 Codex 2차 검토 수정 확인(ReactionsScreen.tsx):
// 1) RebuildConfirm이 뜬 동안(pendingOptionIndex !== null)은 "답변 전달" 버튼이
//    비활성화돼, 참가자가 요청한 체크 변경을 건너뛰고 조용히 전달되지 않는다.
// 2) 근거 자료 팝업 STATEMENTS의 02(OPINIONS)·04(REACTIONS) 행은 각 발언 자체의
//    Statement.stance를 쓴다 — 둘 다 같은 "현재" stances를 쓰면 REACTIONS에서 입장이
//    바뀐 임원의 02 행까지 덩달아 다시 라벨된다.
// 3) 02 발언이 아직 없을 때(아직 응답 전) roundLog에 그 역할의 OPINIONS 실패 기록이
//    없으면 "판단 중"으로, 있으면 "응답 지연·확인 필요"로 보여준다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactionsScreen } from '../../src/components/screens/ReactionsScreen';
import { anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Opinion, RoleStatus, Stance, Statement } from '../../src/domain/types';
import type { RoundLogEntry } from '../../src/components/minutes';

afterEach(() => {
  cleanup();
});

const scenario = anonBoardScenario;
const noop = () => {};

const idleRoleStatus: Record<ExecMemberId, RoleStatus> = {
  CEO: 'idle',
  CFO: 'idle',
  CAIO: 'idle',
  CISO: 'idle',
};

const stances: Record<ExecMemberId, Stance> = {
  CEO: 'FOR',
  CFO: 'FOR',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

function baseProps() {
  return {
    scenario,
    sessionId: 's1',
    opinions: [] as Opinion[],
    transcriptRevision: 0,
    onSubmitFollowup: noop,
    onKeepPrevious: noop,
    onAssistantAction: noop,
  };
}

describe('ReactionsScreen', () => {
  it('RebuildConfirm이 뜬 동안 "답변 전달" 버튼이 비활성화된다(PR #12 Codex 2차 검토 1)', () => {
    render(
      <ReactionsScreen
        {...baseProps()}
        mode="scripted"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={stances}
      />,
    );

    // 직접 입력으로 dirty를 만든 뒤 추천 답변을 체크하면 RebuildConfirm이 뜬다.
    fireEvent.change(screen.getByTestId('followup-textarea'), {
      target: { value: '제 나름대로 정리한 답변입니다.' },
    });
    fireEvent.click(screen.getByTestId('followup-option-0'));
    expect(screen.getByTestId('rebuild-confirm')).toBeInTheDocument();

    // 확인 UI가 뜬 동안에는 전달 버튼이 막혀 있어야 한다 — 비어 있지 않고 글자 수도
    // 넘지 않았지만(canSubmit의 다른 조건은 모두 통과) 그것만으로 활성화되면 안 된다.
    expect(screen.getByTestId('submit-followup')).toBeDisabled();

    fireEvent.click(screen.getByTestId('rebuild-confirm-keep'));
    expect(screen.queryByTestId('rebuild-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-followup')).toBeEnabled();
  });

  it('STATEMENTS 02·04 행이 각 발언 자체의 stance를 쓴다(PR #12 Codex 2차 검토 2)', () => {
    const statements: Statement[] = [
      {
        id: 's-opinion',
        roleId: 'CEO',
        stage: 'OPINIONS',
        text: '원안에는 반대합니다.',
        evidenceIds: [],
        referencedStatementIds: [],
        concerns: [],
        suggestedConditionIds: [],
        stance: 'AGAINST',
        source: 'live',
        createdAt: 0,
      },
      {
        id: 's-reaction',
        roleId: 'CEO',
        stage: 'REACTIONS',
        text: '조건을 보니 찬성으로 바꾸겠습니다.',
        evidenceIds: [],
        referencedStatementIds: [],
        concerns: [],
        suggestedConditionIds: [],
        stance: 'FOR',
        source: 'live',
        createdAt: 1,
      },
    ];
    const roleStatus: Record<ExecMemberId, RoleStatus> = { ...idleRoleStatus, CEO: 'answered' };
    // "현재" stances는 REACTIONS 이후 값(찬성)이다 — 02 행이 이 값을 그대로 쓰면
    // 과거 반대 의견이 찬성으로 잘못 보인다.
    const currentStances: Record<ExecMemberId, Stance> = { ...stances, CEO: 'FOR' };

    render(
      <ReactionsScreen
        {...baseProps()}
        mode="live"
        roleStatus={roleStatus}
        statements={statements}
        roundLog={[{ stage: 'OPINIONS', roleId: 'CEO', status: 'answered' }]}
        stances={currentStances}
      />,
    );

    fireEvent.click(screen.getByTestId('open-evidence'));

    const opinionArticle = screen.getByTestId('statement-card-CEO-opinions').closest('.evidence-dialog__statement');
    const reactionArticle = screen.getByTestId('statement-card-CEO-reactions').closest('.evidence-dialog__statement');
    expect(opinionArticle).toHaveTextContent('반대 쪽');
    expect(reactionArticle).toHaveTextContent('찬성 쪽');
  });

  it('02 발언이 아직 없고 OPINIONS 라운드 실패 기록도 없으면 "판단 중"으로 보여준다(PR #12 Codex 2차 검토 3)', () => {
    render(
      <ReactionsScreen
        {...baseProps()}
        mode="live"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={stances}
      />,
    );

    fireEvent.click(screen.getByTestId('open-evidence'));

    expect(screen.getByTestId('statement-pending-CAIO-opinions')).toHaveTextContent('판단 중');
    expect(screen.queryByTestId('statement-failed-CAIO-opinions')).not.toBeInTheDocument();
  });

  it('02 발언이 없고 roundLog에 그 역할의 OPINIONS 실패 기록이 있으면 "응답 지연·확인 필요"로 보여준다', () => {
    render(
      <ReactionsScreen
        {...baseProps()}
        mode="live"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[{ stage: 'OPINIONS', roleId: 'CAIO', status: 'failed' } satisfies RoundLogEntry]}
        stances={stances}
      />,
    );

    fireEvent.click(screen.getByTestId('open-evidence'));

    expect(screen.getByTestId('statement-failed-CAIO-opinions')).toHaveTextContent('응답 지연·확인 필요');
    expect(screen.queryByTestId('statement-pending-CAIO-opinions')).not.toBeInTheDocument();
  });
});
