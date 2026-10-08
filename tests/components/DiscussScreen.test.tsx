// live 모드의 DISCUSS 화면 임원 카드는 scenario.initialOpinions(각본 문구)가 아니라
// transcript의 실제 OPINIONS 발언을 보여줘야 한다(PR #11 Codex 18차 검토 P2 — live
// 무대 표정 배지는 실제 stance인데 카드 본문이 각본 문장이면 서로 모순돼 보인다).
// T69(2026-10-01): 자료 카드(EvidenceGrid accordion)는 없애고 BRIEFING(T68)과 같은
// "근거 자료 보기" 버튼 + EvidenceDialog 팝업으로 바꿨다 — BriefingScreen.test.tsx와
// 같은 형태의 테스트를 여기에도 둔다.
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DiscussScreen, type DiscussScreenProps } from '../../src/components/screens/DiscussScreen';
import { aiApprovalScenario, anonBoardScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance, Statement, Transcript } from '../../src/domain/types';
import { scriptedStances } from '../../src/domain/stance';
import { encodeAssistantLogEntry, type AssistantActionType } from '../../src/domain/assistantLog';

afterEach(() => {
  cleanup();
});

// T89: App.tsx StageRouter가 side state를 들고 DiscussScreen에 컨트롤드 props로
// 내려준다 — 이 테스트 전체에서 그 자리를 흉내 내는 래퍼를 쓴다. 입장 선택과 무관한
// 테스트는 initialSide를 비워 둬 기존(null) 동작 그대로다.
function ControlledDiscuss(
  props: Omit<DiscussScreenProps, 'side' | 'onChooseSide'> & {
    initialSide?: 'FOR' | 'AGAINST' | null;
  },
) {
  const { initialSide, ...rest } = props;
  const [side, setSide] = useState<'FOR' | 'AGAINST' | null>(initialSide ?? null);
  return <DiscussScreen {...rest} side={side} onChooseSide={setSide} />;
}

const scenario = anonBoardScenario;

const stances: Record<ExecMemberId, Stance> = {
  CEO: 'FOR',
  CFO: 'AGAINST',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

const noop = () => {};

describe('DiscussScreen', () => {
  it('live 모드는 임원 카드 본문에 transcript의 실제 OPINIONS 발언을 보여주고 각본 문장은 쓰지 않는다', () => {
    const roleStatus: Record<ExecMemberId, RoleStatus> = {
      CEO: 'answered',
      CFO: 'answered',
      CAIO: 'pending',
      CISO: 'failed',
    };
    const statements: Statement[] = [
      {
        id: 's-ceo',
        roleId: 'CEO',
        stage: 'OPINIONS',
        text: '[live] CEO의 실제 발언입니다.',
        evidenceIds: [],
        referencedStatementIds: [],
        concerns: [],
        suggestedConditionIds: [],
        source: 'live',
        createdAt: 0,
      },
      {
        id: 's-cfo',
        roleId: 'CFO',
        stage: 'OPINIONS',
        text: '[live] CFO의 실제 발언입니다.',
        evidenceIds: [],
        referencedStatementIds: [],
        concerns: [],
        suggestedConditionIds: [],
        source: 'live',
        createdAt: 0,
      },
    ];
    const transcript: Transcript = { revision: 1, statements };

    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="live"
        roleStatus={roleStatus}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );

    // T73: 임원 발언은 더 이상 화면에 상시 보이지 않고, "근거 자료 · 임원 발언 보기"
    // 팝업의 STATEMENTS 열에서 본다.
    fireEvent.click(screen.getByTestId('open-evidence'));

    // 실제 발언이 있고 answered인 임원은 그 발언 텍스트가 그대로 보인다(각본 문장 아님).
    expect(screen.getByTestId('statement-card-CEO')).toHaveTextContent(
      '[live] CEO의 실제 발언입니다.',
    );
    expect(screen.getByTestId('statement-card-CFO')).toHaveTextContent(
      '[live] CFO의 실제 발언입니다.',
    );

    // 아직 응답 없는(pending) 임원은 각본 문장 대신 OPINIONS 화면과 같은 "판단 중…" 문구다.
    expect(screen.getByTestId('statement-pending-CAIO')).toHaveTextContent(
      '생각을 정리하고 있습니다',
    );

    // 실패한 임원은 OPINIONS 화면과 같은 "응답 지연·확인 필요" 문구다.
    expect(screen.getByTestId('statement-failed-CISO')).toHaveTextContent(
      '이번에는 답을 받지 못했습니다',
    );

    // scenario.initialOpinions의 각본 문구는 live 모드에서 화면에 나오면 안 된다.
    for (const opinion of scenario.initialOpinions) {
      expect(screen.queryByText(opinion.text)).not.toBeInTheDocument();
    }
  });

  it('scripted 모드는 그대로 scenario.initialOpinions 각본 문장을 보여준다', () => {
    const roleStatus: Record<ExecMemberId, RoleStatus> = {
      CEO: 'idle',
      CFO: 'idle',
      CAIO: 'idle',
      CISO: 'idle',
    };
    const transcript: Transcript = { revision: 0, statements: [] };

    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="scripted"
        roleStatus={roleStatus}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );

    // T73: scripted 각본 문장도 "근거 자료 · 임원 발언 보기" 팝업의 STATEMENTS
    // 열에서 본다(화면에 상시 보이지 않는다).
    fireEvent.click(screen.getByTestId('open-evidence'));
    for (const opinion of scenario.initialOpinions) {
      expect(screen.getByText(opinion.text)).toBeInTheDocument();
    }
    // scripted 각본 문장은 live 전용 statement-card- testid를 쓰지 않는다(OpinionsScreen의
    // scripted .opinion-card와 같은 규칙).
    expect(screen.queryAllByTestId(/^statement-card-/)).toHaveLength(0);
  });

  it('팝업을 열기 전에는 evidence-card가 없고, "근거 자료 보기" 클릭 시 4장이 나타나며 Esc로 닫으면 포커스가 버튼으로 돌아온다', () => {
    const roleStatus: Record<ExecMemberId, RoleStatus> = {
      CEO: 'idle',
      CFO: 'idle',
      CAIO: 'idle',
      CISO: 'idle',
    };
    const transcript: Transcript = { revision: 0, statements: [] };

    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="scripted"
        roleStatus={roleStatus}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );

    for (const card of scenario.evidence) {
      expect(screen.queryByTestId(`evidence-card-${card.id}`)).not.toBeInTheDocument();
    }

    const openEvidence = screen.getByTestId('open-evidence');
    // jsdom의 fireEvent.click은 실제 브라우저와 달리 클릭한 버튼에 포커스를 주지
    // 않으므로, EvidenceDialog가 "열기 전 포커스 요소"로 기억할 대상을 직접 만든다.
    openEvidence.focus();
    fireEvent.click(openEvidence);

    expect(screen.getByTestId('evidence-dialog')).toBeInTheDocument();
    for (const card of scenario.evidence) {
      expect(screen.getByTestId(`evidence-card-${card.id}`)).toBeInTheDocument();
    }

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('evidence-dialog')).not.toBeInTheDocument();
    expect(openEvidence).toHaveFocus();
  });

  it('AI 비서실장 드로어가 열린 동안 오른쪽 열은 inert라 숨은 "근거 자료 보기"에 포커스가 가지 않는다(PR #11 Codex 31차)', () => {
    const roleStatus: Record<ExecMemberId, RoleStatus> = {
      CEO: 'idle',
      CFO: 'idle',
      CAIO: 'idle',
      CISO: 'idle',
    };
    const transcript: Transcript = { revision: 0, statements: [] };
    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="scripted"
        roleStatus={roleStatus}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );
    const info = screen.getByTestId('discuss-info');
    expect(info.hasAttribute('inert')).toBe(false);
    fireEvent.click(screen.getByTestId('discuss-side-for'));
    fireEvent.click(document.querySelector('[data-testid^="phrase-card-"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'AI 비서실장에게 맡기기' }));
    expect(info.hasAttribute('inert')).toBe(true);
    // T89: 드로어 대신 팝업(DialogShell)이 된 뒤로는 토글 라벨이 "숨기기"로 바뀌지
    // 않고, 팝업 자체의 닫기 버튼(testid assistant-close)으로 닫는다.
    fireEvent.click(screen.getByTestId('assistant-close'));
    expect(info.hasAttribute('inert')).toBe(false);
  });

  // T87(사용자 — "찬성/반대를 고르면 추천 문구가 뜨도록"): 입장을 고르기 전에는
  // 추천 문구 대신 안내가 보이고, 입장을 고르면 그 side(+BOTH)만 보인다.
  describe('입장 선택(T87)', () => {
    const idleRoleStatus: Record<ExecMemberId, RoleStatus> = {
      CEO: 'idle',
      CFO: 'idle',
      CAIO: 'idle',
      CISO: 'idle',
    };
    const emptyTranscript: Transcript = { revision: 0, statements: [] };

    it('입장을 고르기 전에는 추천 문구 그리드 대신 안내가 보인다', () => {
      render(
        <ControlledDiscuss
          scenario={aiApprovalScenario}
          sessionId="s1"
          transcript={emptyTranscript}
          mode="scripted"
          roleStatus={idleRoleStatus}
          stances={stances}
          onSubmit={noop}
          onAssistantAction={noop}
        />,
      );
      expect(screen.getByTestId('discuss-side-guide')).toHaveTextContent('먼저 입장을 골라 주세요');
      expect(screen.queryByTestId('phrase-card-P1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phrase-card-N1')).not.toBeInTheDocument();
    });

    it('찬성을 고르면 FOR·BOTH 문구만 보이고, 반대를 고르면 AGAINST·BOTH 문구만 보인다', () => {
      render(
        <ControlledDiscuss
          scenario={aiApprovalScenario}
          sessionId="s1"
          transcript={emptyTranscript}
          mode="scripted"
          roleStatus={idleRoleStatus}
          stances={stances}
          onSubmit={noop}
          onAssistantAction={noop}
        />,
      );
      fireEvent.click(screen.getByTestId('discuss-side-for'));
      expect(screen.getByTestId('phrase-card-P1')).toBeInTheDocument();
      expect(screen.getByTestId('phrase-card-P6')).toBeInTheDocument(); // BOTH(요청형)
      expect(screen.queryByTestId('phrase-card-N1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('discuss-side-against'));
      expect(screen.queryByTestId('phrase-card-P1')).not.toBeInTheDocument();
      expect(screen.getByTestId('phrase-card-N1')).toBeInTheDocument();
      expect(screen.getByTestId('phrase-card-P6')).toBeInTheDocument();
    });

    it('입장을 바꾸면 체크된 문구가 해제된다', () => {
      const phraseP1Text = aiApprovalScenario.phrases.find((phrase) => phrase.id === 'P1')!.text;
      render(
        <ControlledDiscuss
          scenario={aiApprovalScenario}
          sessionId="s1"
          transcript={emptyTranscript}
          mode="scripted"
          roleStatus={idleRoleStatus}
          stances={stances}
          onSubmit={noop}
          onAssistantAction={noop}
        />,
      );
      fireEvent.click(screen.getByTestId('discuss-side-for'));
      fireEvent.click(screen.getByTestId('phrase-card-P1'));
      expect(screen.getByTestId('draft-editor-textarea')).toHaveValue(phraseP1Text);

      fireEvent.click(screen.getByTestId('discuss-side-against'));
      expect(screen.getByTestId('draft-editor-textarea')).toHaveValue('');
      fireEvent.click(screen.getByTestId('discuss-side-for'));
      expect(screen.queryByText(phraseP1Text)).toBeInTheDocument();
      // 다시 찬성으로 돌아와도 체크는 풀린 채로 시작한다(토글 input이 아직 checked가 아니다).
      const checkbox = screen.getByTestId('phrase-card-P1').querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeChecked();
    });

    // PR #20 Codex 7차 검토 P2: RebuildConfirm이 열린 채 입장을 바꾸면 대기 선택도 함께
    // 취소돼야 한다 — 남겨 두면 확인 뒤 이전 입장의 숨은 문구가 다시 선택된다.
    it('RebuildConfirm이 열린 채 입장을 바꾸면 확인 UI와 대기 중인 문구 선택이 함께 사라진다', () => {
      render(
        <ControlledDiscuss
          scenario={aiApprovalScenario}
          sessionId="s1"
          transcript={emptyTranscript}
          mode="scripted"
          roleStatus={idleRoleStatus}
          stances={stances}
          onSubmit={noop}
          onAssistantAction={noop}
        />,
      );
      fireEvent.click(screen.getByTestId('discuss-side-for'));
      fireEvent.change(screen.getByTestId('draft-editor-textarea'), {
        target: { value: '직접 쓴 의견입니다.' },
      });
      fireEvent.click(screen.getByTestId('phrase-card-P1'));
      expect(screen.getByTestId('rebuild-confirm')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('discuss-side-against'));
      expect(screen.queryByTestId('rebuild-confirm')).not.toBeInTheDocument();
      // 직접 쓴 텍스트는 유지되고, 이전 입장의 문구는 어디에도 반영되지 않는다.
      expect(screen.getByTestId('draft-editor-textarea')).toHaveValue('직접 쓴 의견입니다.');
      fireEvent.click(screen.getByTestId('discuss-side-for'));
      const checkbox = screen.getByTestId('phrase-card-P1').querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeChecked();
    });
  });
});

// T97: 추천 문구 선택 → AI 비서실장 세 기능 한 번씩 → 의견 전달.
describe('비서실장 필수 사용 게이팅(T97)', () => {
  const idle: Record<ExecMemberId, RoleStatus> = {
    CEO: 'idle',
    CFO: 'idle',
    CAIO: 'idle',
    CISO: 'idle',
  };
  const emptyTranscript: Transcript = { revision: 0, statements: [] };
  const entry = (type: AssistantActionType, failed = false) =>
    encodeAssistantLogEntry({ type, mode: 'scripted', evidenceIds: [], failed }, 0);

  function renderDiscuss(assistantActions: string[]) {
    return render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={emptyTranscript}
        mode="scripted"
        roleStatus={idle}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
        assistantActions={assistantActions}
        initialSide="FOR"
      />,
    );
  }

  it('문구를 고르기 전에는 비서실장 버튼이 잠기고 힌트가 보이며, 고르면 열린다(Codex 29차 P2)', () => {
    renderDiscuss([]);
    expect(screen.getByTestId('assistant-toggle')).toBeDisabled();
    expect(screen.getByTestId('assistant-toggle-hint')).toHaveTextContent('먼저 추천 문구를 골라 주세요');
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('assistant-toggle')).toBeEnabled();
    expect(screen.queryByTestId('assistant-toggle-hint')).not.toBeInTheDocument();
  });

  it('문구가 없으면 전달이 막히고 힌트는 문구를 고르라고 하며, 하이라이트는 문구 목록에 있다', () => {
    renderDiscuss([]);
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      '추천 문구를 고르거나 직접 써 주세요',
    );
    expect(screen.getByTestId('assistant-toggle')).not.toHaveAttribute('data-guide');
    expect(screen.getByTestId('submit-opinion')).not.toHaveAttribute('data-guide');
  });

  it('문구만 고르면 힌트가 (0/3)으로 바뀌고 하이라이트가 비서실장 버튼으로 옮겨 간다', () => {
    renderDiscuss([]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      'AI 비서실장을 먼저 써 보세요 (0/3)',
    );
    expect(screen.getByTestId('assistant-toggle')).toHaveAttribute('data-guide', 'next');
    expect(screen.getByTestId('submit-opinion')).not.toHaveAttribute('data-guide');
  });

  it('두 개만 써도 (2/3)이고 전달은 계속 막혀 있다', () => {
    renderDiscuss([entry('OPINION_SUMMARY'), entry('CONDITION_RECOMMEND_VIEW')]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent('(2/3)');
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
  });

  it('세 개를 다 쓰면(실패 기록 포함) 전달이 열리고 하이라이트가 전달 버튼으로 옮겨 가며 힌트가 사라진다', () => {
    renderDiscuss([
      entry('OPINION_SUMMARY'),
      entry('CONDITION_RECOMMEND_VIEW', true),
      entry('DRAFT_REFINE'),
    ]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('submit-opinion')).toBeEnabled();
    expect(screen.getByTestId('submit-opinion')).toHaveAttribute('data-guide', 'next');
    expect(screen.getByTestId('assistant-toggle')).not.toHaveAttribute('data-guide');
    expect(screen.queryByTestId('discuss-cta-hint')).not.toBeInTheDocument();
  });

  it('입장을 고르지 않으면 직접 쓴 글과 세 기능이 있어도 전달·비서실장이 잠긴다(Codex 35차 P2-1)', () => {
    render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={emptyTranscript}
        mode="scripted"
        roleStatus={idle}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
        assistantActions={[
          entry('OPINION_SUMMARY'),
          entry('CONDITION_RECOMMEND_VIEW'),
          entry('DRAFT_REFINE'),
        ]}
      />,
    );
    fireEvent.change(screen.getByTestId('draft-editor-textarea'), {
      target: { value: '작은 범위로 먼저 시작합시다.' },
    });
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('assistant-toggle')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent('먼저 입장을 골라 주세요');
    expect(screen.getByTestId('assistant-toggle-hint')).toHaveTextContent('먼저 입장을 골라 주세요');
  });

  it('비서실장을 다 써도 문구가 없으면 전달은 여전히 막힌다', () => {
    renderDiscuss([
      entry('OPINION_SUMMARY'),
      entry('CONDITION_RECOMMEND_VIEW'),
      entry('DRAFT_REFINE'),
    ]);
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      '추천 문구를 고르거나 직접 써 주세요',
    );
  });

  it('예전 한 줄 안내는 없고 안내판이 대신한다(T98)', () => {
    renderDiscuss([]);
    expect(screen.queryByTestId('discuss-assistant-tip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discuss-guide-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('step-guide')).toBeInTheDocument();
  });

  it('안내판 현재 칩이 입장 → 문구 → 비서실장 → 전달 순으로 옮겨 가고 실제 조작 대상도 같이 강조된다(T98)', () => {
    const { unmount } = render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={emptyTranscript}
        mode="scripted"
        roleStatus={idle}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
        assistantActions={[]}
      />,
    );
    // ① 입장 미선택
    expect(screen.getByTestId('step-chip-side')).toHaveAttribute('data-status', 'current');
    expect(screen.getByTestId('discuss-side-select')).toHaveAttribute('data-guide', 'next');
    fireEvent.click(screen.getByTestId('discuss-side-for'));
    // ② 문구
    expect(screen.getByTestId('step-chip-side')).toHaveAttribute('data-status', 'done');
    expect(screen.getByTestId('step-chip-phrase')).toHaveAttribute('data-status', 'current');
    expect(screen.getByTestId('discuss-side-select')).not.toHaveAttribute('data-guide');
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    // ③ 비서실장
    expect(screen.getByTestId('step-chip-assistant')).toHaveAttribute('data-status', 'current');
    expect(screen.getByTestId('assistant-toggle')).toHaveAttribute('data-guide', 'next');
    unmount();

    // ④ 세 기능을 다 쓴 뒤
    render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={emptyTranscript}
        mode="scripted"
        roleStatus={idle}
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
        assistantActions={[entry('OPINION_SUMMARY'), entry('CONDITION_RECOMMEND_VIEW'), entry('DRAFT_REFINE')]}
        initialSide="FOR"
      />,
    );
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('step-chip-submit')).toHaveAttribute('data-status', 'current');
    expect(screen.getByTestId('submit-opinion')).toHaveAttribute('data-guide', 'next');
    expect(screen.getByTestId('step-check-compare')).toHaveAttribute('data-checked', 'true');
  });

});

// PR #20 Codex 28차 P2-1: 복합 추천 "모두 적용"은 조건 여러 개를 단일 상태 업데이트로 반영한다.
describe('조건 추천 묶음 적용(Codex 28차 P2-1)', () => {
  it('LIMIT+REVIEW 묶음을 적용하면 두 문구가 모두 체크되고 기록도 두 조건 모두 남는다', async () => {
    const actions: { type: string; evidenceIds: string[] }[] = [];
    render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={{ revision: 0, statements: [] }}
        mode="scripted"
        roleStatus={{ CEO: 'idle', CFO: 'idle', CAIO: 'idle', CISO: 'idle' }}
        stances={scriptedStances(aiApprovalScenario, { stage: 'DISCUSS', opinions: [] })}
        onSubmit={noop}
        onAssistantAction={(event) => actions.push(event)}
        assistantActions={[]}
        initialSide="FOR"
      />,
    );
    fireEvent.click(screen.getByTestId('phrase-card-P2'));
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-compare'));
    fireEvent.click(await screen.findByTestId('assistant-recommend-apply-bundle-LIMIT+REVIEW', {}, { timeout: 2000 }));

    await waitFor(() => {
      expect(actions.filter((event) => event.type === 'CONDITION_RECOMMEND_APPLY')).toHaveLength(2);
    });
    for (const id of ['P1', 'P3']) {
      const checkbox = screen.getByTestId(`phrase-card-${id}`).querySelector('input[type="checkbox"]');
      expect(checkbox).toBeChecked();
    }
  });
});

describe('조건 추천 적용 가능 여부와 확인 뒤 묶음 적용(Codex 30차 P2)', () => {
  const idleRoles: Record<ExecMemberId, RoleStatus> = { CEO: 'idle', CFO: 'idle', CAIO: 'idle', CISO: 'idle' };

  function renderWith(
    sc: typeof aiApprovalScenario,
    initialSide: 'FOR' | 'AGAINST',
    actions: { type: string; evidenceIds: string[] }[] = [],
  ) {
    return render(
      <ControlledDiscuss
        scenario={sc}
        sessionId="s1"
        transcript={{ revision: 0, statements: [] }}
        mode="scripted"
        roleStatus={idleRoles}
        stances={scriptedStances(sc, { stage: 'DISCUSS', opinions: [] })}
        onSubmit={noop}
        onAssistantAction={(event) => actions.push(event)}
        assistantActions={[]}
        initialSide={initialSide}
      />,
    );
  }

  async function openCompare() {
    fireEvent.change(screen.getByTestId('draft-editor-textarea'), { target: { value: '직접 쓴 의견입니다.' } });
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-compare'));
    await screen.findByTestId('assistant-recommend-opening', {}, { timeout: 2000 });
  }

  it.each([
    ['ai-approval', aiApprovalScenario, 'FULL_AUTO'],
    ['experience-first', experienceFirstScenario, 'EXP_ONLY'],
  ])('AGAINST + %s: 적용할 문구가 없는 추천은 버튼 없이 직접 써 달라고 안내한다', async (_name, sc, conditionId) => {
    renderWith(sc, 'AGAINST');
    await openCompare();
    expect(screen.getByTestId(`assistant-recommend-row-${conditionId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`assistant-recommend-apply-${conditionId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`assistant-recommend-manual-${conditionId}`)).toHaveTextContent('직접 써 주세요');
  });

  it('FOR에서는 기존대로 적용 버튼이 보인다', async () => {
    renderWith(aiApprovalScenario, 'FOR');
    await openCompare();
    expect(screen.getByTestId('assistant-recommend-apply-LOG')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-recommend-manual-LOG')).not.toBeInTheDocument();
  });

  it('직접 쓴 뒤 묶음 적용 → 확인(다시 구성) 하면 두 문구가 모두 체크되고 기록도 2건이다', async () => {
    const actions: { type: string; evidenceIds: string[] }[] = [];
    renderWith(aiApprovalScenario, 'FOR', actions);
    await openCompare();
    fireEvent.click(screen.getByTestId('assistant-recommend-apply-bundle-LIMIT+REVIEW'));
    fireEvent.click(await screen.findByTestId('rebuild-confirm-rebuild'));
    // 확인 창이 뜨면 비서실장 팝업은 닫혀 있다(Codex 31차 P2-1).
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
    for (const id of ['P1', 'P3']) {
      expect(screen.getByTestId(`phrase-card-${id}`).querySelector('input[type="checkbox"]')).toBeChecked();
    }
    expect(actions.filter((event) => event.type === 'CONDITION_RECOMMEND_APPLY').map((e) => e.evidenceIds)).toEqual([
      ['LIMIT'],
      ['REVIEW'],
    ]);
  });

  it('직접 쓴 내용 유지를 골라도 선택 문구의 조건이 확정되므로 묶음 기록이 2건 남는다(Codex 32차 P2-1)', async () => {
    const actions: { type: string; evidenceIds: string[] }[] = [];
    renderWith(aiApprovalScenario, 'FOR', actions);
    await openCompare();
    fireEvent.click(screen.getByTestId('assistant-recommend-apply-bundle-LIMIT+REVIEW'));
    fireEvent.click(await screen.findByTestId('rebuild-confirm-keep'));
    expect(screen.queryByTestId('rebuild-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('draft-editor-textarea')).toHaveValue('직접 쓴 의견입니다.');
    expect(actions.filter((event) => event.type === 'CONDITION_RECOMMEND_APPLY').map((e) => e.evidenceIds)).toEqual([
      ['LIMIT'],
      ['REVIEW'],
    ]);
  });

  it('DISCUSS는 고른 문구의 조건이 본문을 고쳐도 제안으로 남아 적용 버튼이 그대로 보인다(Codex 31차 P2-3 확인)', async () => {
    renderWith(aiApprovalScenario, 'FOR');
    fireEvent.click(screen.getByTestId('phrase-card-P2'));
    await openCompare();
    expect(screen.getByTestId('assistant-recommend-opening')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-recommend-manual-LOG')).not.toBeInTheDocument();
  });
});
