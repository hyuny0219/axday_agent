// live 모드의 DISCUSS 화면 임원 카드는 scenario.initialOpinions(각본 문구)가 아니라
// transcript의 실제 OPINIONS 발언을 보여줘야 한다(PR #11 Codex 18차 검토 P2 — live
// 무대 표정 배지는 실제 stance인데 카드 본문이 각본 문장이면 서로 모순돼 보인다).
// T69(2026-10-01): 자료 카드(EvidenceGrid accordion)는 없애고 BRIEFING(T68)과 같은
// "근거 자료 보기" 버튼 + EvidenceDialog 팝업으로 바꿨다 — BriefingScreen.test.tsx와
// 같은 형태의 테스트를 여기에도 둔다.
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiscussScreen, type DiscussScreenProps } from '../../src/components/screens/DiscussScreen';
import { aiApprovalScenario, anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Stance, Transcript } from '../../src/domain/types';
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
  it('근거 자료 팝업에는 자료 4장만 있고 임원 발언 열이 없다(T105)', () => {
    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={{ revision: 0, statements: [] }}
        mode="scripted"
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );
    fireEvent.click(screen.getByTestId('open-evidence'));
    const dialog = screen.getByTestId('evidence-dialog');
    expect(dialog).toHaveTextContent('근거 자료');
    expect(dialog).not.toHaveTextContent('임원이 한 말');
    expect(screen.queryAllByTestId(/^statement-(card|pending|failed)-/)).toHaveLength(0);
    for (const opinion of scenario.initialOpinions) {
      expect(screen.queryByText(opinion.text)).not.toBeInTheDocument();
    }
  });

  it('팝업을 열기 전에는 evidence-card가 없고, "근거 자료 보기" 클릭 시 4장이 나타나며 Esc로 닫으면 포커스가 버튼으로 돌아온다', () => {
    const transcript: Transcript = { revision: 0, statements: [] };

    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="scripted"
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

  it('발언 정리 팝업이 열린 동안 오른쪽 열은 inert라 숨은 "근거 자료 보기"에 포커스가 가지 않는다(PR #11 Codex 31차)', () => {
    const transcript: Transcript = { revision: 0, statements: [] };
    render(
      <ControlledDiscuss
        scenario={scenario}
        sessionId="s1"
        transcript={transcript}
        mode="scripted"
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );
    const info = screen.getByTestId('discuss-info');
    expect(info.hasAttribute('inert')).toBe(false);
    fireEvent.click(screen.getByTestId('discuss-side-for'));
    fireEvent.click(document.querySelector('[data-testid^="phrase-card-"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: '발언 정리' }));
    expect(info.hasAttribute('inert')).toBe(true);
    // T89: 드로어 대신 팝업(DialogShell)이 된 뒤로는 토글 라벨이 "숨기기"로 바뀌지
    // 않고, 팝업 자체의 닫기 버튼(testid assistant-close)으로 닫는다.
    fireEvent.click(screen.getByTestId('assistant-close'));
    expect(info.hasAttribute('inert')).toBe(false);
  });

  // T87(사용자 — "찬성/반대를 고르면 추천 문구가 뜨도록"): 입장을 고르기 전에는
  // 추천 문구 대신 안내가 보이고, 입장을 고르면 그 side(+BOTH)만 보인다.
  describe('입장 선택(T87)', () => {
    const emptyTranscript: Transcript = { revision: 0, statements: [] };

    it('입장을 고르기 전에는 추천 문구 그리드 대신 안내가 보인다', () => {
      render(
        <ControlledDiscuss
          scenario={aiApprovalScenario}
          sessionId="s1"
          transcript={emptyTranscript}
          mode="scripted"
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

// T97: 추천 문구 선택 → AI 비서실장 한 기능 이상 → 의견 전달.
describe('비서실장 필수 사용 게이팅(T97)', () => {
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

  it('문구가 없으면 전달이 막히고 힌트는 문구를 고르라고 하며', () => {
    renderDiscuss([]);
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      '추천 문구를 고르거나 직접 써 주세요',
    );
  });

  it('문구만 고르면 힌트가 발언 정리를 한 번 해 보라고 바뀐다', () => {
    renderDiscuss([]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      '발언 정리를 한 번 해 보세요',
    );
  });

  it('발언 정리를 한 번 하면 전달이 열리고 힌트가 사라진다(T149)', () => {
    renderDiscuss([entry('DRAFT_REFINE')]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('submit-opinion')).toBeEnabled();
    expect(screen.queryByTestId('discuss-cta-hint')).not.toBeInTheDocument();
  });

  it('발언 정리가 실패 기록이어도 전달이 열린다(T109)', () => {
    renderDiscuss([entry('DRAFT_REFINE', true)]);
    fireEvent.click(screen.getByTestId('phrase-card-P1'));
    expect(screen.getByTestId('submit-opinion')).toBeEnabled();
  });

  it('입장을 고르지 않으면 직접 쓴 글과 발언 정리 기록이 있어도 전달·비서실장이 잠긴다(Codex 35차 P2-1)', () => {
    render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={emptyTranscript}
        mode="scripted"
        stances={stances}
        onSubmit={noop}
        onAssistantAction={noop}
        assistantActions={[entry('DRAFT_REFINE')]}
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

  it('발언 정리를 해도 문구가 없으면 전달은 여전히 막힌다', () => {
    renderDiscuss([entry('DRAFT_REFINE')]);
    expect(screen.getByTestId('submit-opinion')).toBeDisabled();
    expect(screen.getByTestId('discuss-cta-hint')).toHaveTextContent(
      '추천 문구를 고르거나 직접 써 주세요',
    );
  });

  it('예전 한 줄 안내와 단계 칩은 없다(T103에서 코치로 대체)', () => {
    renderDiscuss([]);
    expect(screen.queryByTestId('discuss-assistant-tip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discuss-guide-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-guide')).not.toBeInTheDocument();
    expect(document.querySelector('[data-guide]')).toBeNull();
  });

});


describe('새로 뽑은 조건의 입장 필터(T137 Codex P2)', () => {
  function renderSide(side: 'FOR' | 'AGAINST') {
    render(
      <ControlledDiscuss
        scenario={aiApprovalScenario}
        sessionId="s1"
        transcript={{ revision: 0, statements: [] }}
        mode="scripted"
        stances={stances}
        initialSide={side}
        onSubmit={noop}
        onAssistantAction={noop}
      />,
    );
  }

  it('반대 입장에서 찬성 조건 키워드를 쓰면 초록 칩이 생기지 않는다', () => {
    renderSide('AGAINST');
    fireEvent.change(screen.getByTestId('draft-editor-textarea'), { target: { value: '금액 한도를 정해 두면 좋겠습니다.' } });
    expect(screen.queryByTestId('condition-chip-LIMIT')).not.toBeInTheDocument();
  });

  it('찬성 입장에서 반대 조건 키워드를 쓰면 빨간 칩이 생기지 않는다', () => {
    renderSide('FOR');
    fireEvent.change(screen.getByTestId('draft-editor-textarea'), { target: { value: '승인 이유가 남지 않았습니다.' } });
    expect(screen.queryByTestId('condition-chip-AG_AUDIT')).not.toBeInTheDocument();
  });

  it('같은 입장 키워드는 칩이 생긴다(대조)', () => {
    renderSide('FOR');
    fireEvent.change(screen.getByTestId('draft-editor-textarea'), { target: { value: '금액 한도를 정해 두면 좋겠습니다.' } });
    expect(screen.getByTestId('condition-chip-LIMIT')).toBeInTheDocument();
  });
});
