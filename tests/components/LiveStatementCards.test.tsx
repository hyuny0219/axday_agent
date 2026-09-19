import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveStatementCards } from '../../src/components/parts/LiveStatementCards';
import { aiAssistantScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Statement } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

const scenario = aiAssistantScenario;

const roleStatus: Record<ExecMemberId, RoleStatus> = {
  CEO: 'answered',
  CFO: 'pending',
  CAIO: 'failed',
  CISO: 'idle',
};

const statements: Statement[] = [
  {
    id: 's1',
    roleId: 'CEO',
    stage: 'REACTIONS',
    text: '작게 시작하는 데 찬성합니다.',
    evidenceIds: ['E3'],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'live',
    createdAt: 0,
  },
];

describe('LiveStatementCards', () => {
  it('기본은 4열 그리드 컨테이너이며 답글형 클래스가 붙지 않는다', () => {
    render(
      <LiveStatementCards scenario={scenario} stage="OPINIONS" roleStatus={roleStatus} statements={statements} />,
    );
    const container = screen.getByTestId('live-round-OPINIONS');
    expect(container).toHaveClass('live-round__cards');
    expect(container).not.toHaveClass('live-round__cards--reply');
  });

  it("variant='reply'(REACTIONS)는 답글형 컨테이너로 바뀌고 상태 표시는 그대로다", () => {
    render(
      <LiveStatementCards
        scenario={scenario}
        stage="REACTIONS"
        roleStatus={roleStatus}
        statements={statements}
        variant="reply"
      />,
    );
    expect(screen.getByTestId('live-round-REACTIONS')).toHaveClass('live-round__cards--reply');
    expect(screen.getByTestId('statement-card-CEO')).toHaveTextContent('작게 시작하는 데 찬성합니다.');
    expect(screen.getByTestId('statement-pending-CFO')).toHaveTextContent('판단 중');
    expect(screen.getByTestId('statement-failed-CAIO')).toHaveTextContent('응답 지연');
    expect(screen.getByTestId('live-role-CEO')).toHaveClass('live-statement--answered');
  });
});
