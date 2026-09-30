// live 모드의 DISCUSS 화면 임원 카드는 scenario.initialOpinions(각본 문구)가 아니라
// transcript의 실제 OPINIONS 발언을 보여줘야 한다(PR #11 Codex 18차 검토 P2 — live
// 무대 표정 배지는 실제 stance인데 카드 본문이 각본 문장이면 서로 모순돼 보인다).
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

    // 실제 발언이 있고 answered인 임원은 그 발언 텍스트가 그대로 보인다(각본 문장 아님).
    expect(screen.getByTestId('statement-card-CEO')).toHaveTextContent('[live] CEO의 실제 발언입니다.');
    expect(screen.getByTestId('statement-card-CFO')).toHaveTextContent('[live] CFO의 실제 발언입니다.');

    // 아직 응답 없는(pending) 임원은 각본 문장 대신 OPINIONS 화면과 같은 "판단 중…" 문구다.
    expect(screen.getByTestId('statement-pending-CAIO')).toHaveTextContent('판단 중');

    // 실패한 임원은 OPINIONS 화면과 같은 "응답 지연·확인 필요" 문구다.
    expect(screen.getByTestId('statement-failed-CISO')).toHaveTextContent('응답 지연·확인 필요');

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

    for (const opinion of scenario.initialOpinions) {
      expect(screen.getByText(opinion.text)).toBeInTheDocument();
    }
    expect(screen.queryAllByTestId(/^statement-card-/)).toHaveLength(0);
  });
});
