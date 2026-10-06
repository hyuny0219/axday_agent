// live 모드의 DISCUSS 화면 임원 카드는 scenario.initialOpinions(각본 문구)가 아니라
// transcript의 실제 OPINIONS 발언을 보여줘야 한다(PR #11 Codex 18차 검토 P2 — live
// 무대 표정 배지는 실제 stance인데 카드 본문이 각본 문장이면 서로 모순돼 보인다).
// T69(2026-10-01): 자료 카드(EvidenceGrid accordion)는 없애고 BRIEFING(T68)과 같은
// "근거 자료 보기" 버튼 + EvidenceDialog 팝업으로 바꿨다 — BriefingScreen.test.tsx와
// 같은 형태의 테스트를 여기에도 둔다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiscussScreen } from '../../src/components/screens/DiscussScreen';
import { anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance, Statement, Transcript } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

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
      <DiscussScreen
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
    expect(screen.getByTestId('statement-card-CEO')).toHaveTextContent('[live] CEO의 실제 발언입니다.');
    expect(screen.getByTestId('statement-card-CFO')).toHaveTextContent('[live] CFO의 실제 발언입니다.');

    // 아직 응답 없는(pending) 임원은 각본 문장 대신 OPINIONS 화면과 같은 "판단 중…" 문구다.
    expect(screen.getByTestId('statement-pending-CAIO')).toHaveTextContent('생각을 정리하고 있습니다');

    // 실패한 임원은 OPINIONS 화면과 같은 "응답 지연·확인 필요" 문구다.
    expect(screen.getByTestId('statement-failed-CISO')).toHaveTextContent('이번에는 답을 받지 못했습니다');

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
      <DiscussScreen
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
      <DiscussScreen
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
      <DiscussScreen
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
    fireEvent.click(screen.getByRole('button', { name: 'AI 비서실장에게 정리 맡기기' }));
    expect(info.hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'AI 비서실장 숨기기' }));
    expect(info.hasAttribute('inert')).toBe(false);
  });
});
