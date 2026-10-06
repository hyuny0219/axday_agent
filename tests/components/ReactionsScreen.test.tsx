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
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactionsScreen } from '../../src/components/screens/ReactionsScreen';
import { anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Opinion, RoleStatus, Stance, Statement } from '../../src/domain/types';
import type { RoundLogEntry } from '../../src/components/minutes';
import { scriptedStances } from '../../src/domain/stance';

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

  it('scripted에서도 02(최초 의견) 행은 조건 확정 전 입장을, 04(반응) 행은 현재 입장을 보여준다(PR #12 Codex 3차 검토 2)', () => {
    // anonBoard의 CFO 표결 규칙: 조건 없음(기본) → 반대, PILOT+MEASURE 확정 → 찬성.
    const opinions: Opinion[] = [
      {
        id: 'op1',
        originalText: '한 게시판에서 시범 운영하고 효과를 측정합시다.',
        selectedPhraseIds: ['P1', 'P4'],
        confirmedConditionIds: ['PILOT', 'MEASURE'],
        createdAt: 0,
      },
    ];
    // App.tsx가 stancesFor로 계산해 넘기는 "현재" stances — PILOT+MEASURE가 확정된
    // 뒤라 CFO는 찬성이다.
    const currentStances: Record<ExecMemberId, Stance> = { ...stances, CFO: 'FOR' };

    render(
      <ReactionsScreen
        {...baseProps()}
        opinions={opinions}
        mode="scripted"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={currentStances}
      />,
    );

    fireEvent.click(screen.getByTestId('open-evidence'));
    const dialog = screen.getByTestId('evidence-dialog');

    // 오른쪽 종이의 .reaction-card도 같은 직함 문구를 쓰므로, 팝업 안으로 범위를
    // 좁혀 찾는다.
    const cfoArticles = within(dialog)
      .getAllByText('재무책임임원(CFO)')
      .map((el) => el.closest('.evidence-dialog__statement') as HTMLElement);
    const opinionArticle = cfoArticles.find((el) => el.textContent?.includes('02 임원 의견'));
    const reactionArticle = cfoArticles.find((el) => el.textContent?.includes('04 반응'));
    expect(opinionArticle).toHaveTextContent('반대 쪽');
    expect(reactionArticle).toHaveTextContent('찬성 쪽');
  });

  it('scripted 반응 카드: PILOT만 확정돼 CFO 표는 그대로 반대여도 반응 문구가 있으면 배지는 "유지"다(PR #12 Codex 5차 검토 P2-a)', () => {
    // CFO 표결 규칙: ANON_FULL이면 반대, PILOT+MEASURE 둘 다면 찬성, 그 외(PILOT만
    // 포함)는 기본값인 반대 — 즉 PILOT만으로는 표가 바뀌지 않는다. 다만 CFO는
    // PILOT 조건에 묶인 반응 문구를 갖고 있어, 옛 "반응 문구가 있으면 바뀜" 규칙은
    // 여기서 잘못 "바뀜"을 보여줬다.
    const opinions: Opinion[] = [
      {
        id: 'op1',
        originalText: '한 게시판에서 시범 운영합시다.',
        selectedPhraseIds: ['P1'],
        confirmedConditionIds: ['PILOT'],
        createdAt: 0,
      },
    ];
    // App.tsx가 넘기는 "현재" stances는 실제 표결 규칙표(scriptedStances)로 계산한
    // 값이다 — 지어내지 않고 PILOT 하나만 확정된 실제 결과(CFO는 그대로 반대)를
    // 그대로 쓴다.
    const currentStances = scriptedStances(scenario, { stage: 'OPINIONS', opinions });
    render(
      <ReactionsScreen
        {...baseProps()}
        opinions={opinions}
        mode="scripted"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={currentStances}
      />,
    );

    const card = screen.getByTestId('reaction-card-CFO');
    expect(card.querySelector('.reaction-card__badge')).toHaveTextContent('유지');
    // 본문은 reactionsFor가 찾은 실제 반응 문구를 그대로 보여준다(배지와는 별개).
    expect(card).toHaveTextContent('한 게시판에서 시작하면 처리 공수를 가늠할 수 있겠습니다');
  });

  it('scripted 반응 카드: ANON_FULL이 CEO 표를 찬성→반대로 돌려도 연결된 반응 문구가 없으면 배지는 "바뀜"이다(PR #12 Codex 5차 검토 P2-a)', () => {
    // CEO 표결 규칙: ANON_FULL이면 반대, 그 외는 찬성 — ANON_FULL만으로 표가
    // 바뀐다. 하지만 CEO는 ANON_FULL에 묶인 반응 문구가 없어(반응 데이터는 CEO의
    // conditionId 'none' 기본값 하나뿐), 옛 "반응 문구가 있으면 바뀜" 규칙은 여기서
    // 잘못 "유지"를 보여줬다.
    const opinions: Opinion[] = [
      {
        id: 'op1',
        originalText: '작성자를 누구도 추적할 수 없는 완전 익명으로 합시다.',
        selectedPhraseIds: ['P5'],
        confirmedConditionIds: ['ANON_FULL'],
        createdAt: 0,
      },
    ];
    const currentStances = scriptedStances(scenario, { stage: 'OPINIONS', opinions });
    render(
      <ReactionsScreen
        {...baseProps()}
        opinions={opinions}
        mode="scripted"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={currentStances}
      />,
    );

    const card = screen.getByTestId('reaction-card-CEO');
    // 본문이 "기존 의견 유지 — ..."로 시작해(연결된 반응 문구가 없다) 카드 전체
    // 텍스트에는 "유지"가 섞여 있다 — 배지 자체(.reaction-card__badge)만 따로 본다.
    expect(card.querySelector('.reaction-card__badge')).toHaveTextContent('바뀜');
  });

  it('RebuildConfirm이 뜬 동안 "답하지 않고 넘어가기"를 눌러도 다음 단계로 넘어가지 않는다(PR #12 Codex 5차 검토 P2-b, T84 #1)', () => {
    let keepPreviousCalls = 0;
    render(
      <ReactionsScreen
        {...baseProps()}
        onKeepPrevious={() => {
          keepPreviousCalls += 1;
        }}
        mode="scripted"
        roleStatus={idleRoleStatus}
        statements={[]}
        roundLog={[]}
        stances={stances}
      />,
    );

    // 직접 입력으로 dirty를 만든 뒤 체크 카드를 눌러 RebuildConfirm을 띄운다.
    fireEvent.change(screen.getByTestId('followup-textarea'), {
      target: { value: '제 나름대로 정리한 답변입니다.' },
    });
    fireEvent.click(screen.getByTestId('followup-option-0'));
    expect(screen.getByTestId('rebuild-confirm')).toBeInTheDocument();

    // T84 #1: keepPrevious 옵션은 더 이상 체크 카드로 그리지 않고 "답하지 않고 넘어가기"
    // 보조 버튼이다 — 확인 UI가 뜬 동안에는 눌러도 onKeepPrevious가 불리면 안 된다.
    expect(screen.queryByTestId('followup-option-2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('keep-previous-answer'));
    expect(keepPreviousCalls).toBe(0);
    expect(screen.getByTestId('rebuild-confirm')).toBeInTheDocument();
    // 직접 쓴 텍스트도 그대로 남아 있다(건너뛰고 버려지지 않았다).
    expect(screen.getByTestId('followup-textarea')).toHaveValue('제 나름대로 정리한 답변입니다.');
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
