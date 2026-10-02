import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveStatementCards } from '../../src/components/parts/LiveStatementCards';
import { anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance, Statement } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

const scenario = anonBoardScenario;

const roleStatus: Record<ExecMemberId, RoleStatus> = {
  CEO: 'answered',
  CFO: 'pending',
  CAIO: 'failed',
  CISO: 'idle',
};

const statements: Statement[] = [
  {
    id: 's0',
    roleId: 'CEO',
    stage: 'OPINIONS',
    text: '원안에 찬성합니다.',
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'live',
    createdAt: 0,
  },
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

const stances: Record<ExecMemberId, Stance> = {
  CEO: 'FOR',
  CFO: 'AGAINST',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

describe('LiveStatementCards', () => {
  it('기본은 4열 그리드 컨테이너이며 답글형 클래스가 붙지 않는다', () => {
    render(
      <LiveStatementCards
        scenario={scenario}
        stage="OPINIONS"
        roleStatus={roleStatus}
        statements={statements}
        stances={stances}
      />,
    );
    const container = screen.getByTestId('live-round-OPINIONS');
    expect(container).toHaveClass('live-round__cards');
    expect(container).not.toHaveClass('live-round__cards--reply');
  });

  it("variant='reaction'(REACTIONS, T74)은 grid와 같은 틀을 쓰고 상태 표시는 그대로다", () => {
    render(
      <LiveStatementCards
        scenario={scenario}
        stage="REACTIONS"
        roleStatus={roleStatus}
        statements={statements}
        stances={stances}
        variant="reaction"
      />,
    );
    // 컨테이너는 'grid'와 같은 2열 그리드이고, 옛 답글형 클래스는 없다.
    expect(screen.getByTestId('live-round-REACTIONS')).toHaveClass('live-round__cards');
    expect(screen.getByTestId('live-round-REACTIONS')).not.toHaveClass('live-round__cards--reply');
    expect(screen.getByTestId('statement-card-CEO')).toHaveTextContent('작게 시작하는 데 찬성합니다.');
    expect(screen.getByTestId('statement-pending-CFO')).toHaveTextContent('판단 중');
    expect(screen.getByTestId('statement-failed-CAIO')).toHaveTextContent('응답 지연');
    expect(screen.getByTestId('live-role-CEO')).toHaveClass(
      'live-statement--answered',
      'live-statement--grid',
      'live-statement--reaction',
    );
    // CEO의 OPINIONS 발언과 REACTIONS 발언 텍스트가 다르므로 "바뀜"(유지 아님)으로 본다.
    expect(screen.getByTestId('live-role-CEO')).not.toHaveClass('live-statement--maintained');
    expect(screen.getByTestId('exec-mood-label-CEO')).toHaveTextContent('찬성 쪽');
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('반대 쪽');
    expect(screen.getByTestId('exec-mood-label-CAIO')).toHaveTextContent('미정');
  });

  it("variant='reaction'에서 실패한 역할은 재요청 버튼을 카드 안에 그린다(T74)", () => {
    render(
      <LiveStatementCards
        scenario={scenario}
        stage="REACTIONS"
        roleStatus={roleStatus}
        statements={statements}
        stances={stances}
        variant="reaction"
        onRetryFailedRoles={() => {}}
      />,
    );
    // CAIO만 failed다 — 버튼이 정확히 하나만 있어야 한다(그리드 아래 공용 버튼과
    // 중복되지 않는다).
    expect(screen.getAllByTestId('retry-failed-roles')).toHaveLength(1);
    expect(screen.getByTestId('retry-failed-roles')).toHaveTextContent('응답 없는 임원 다시 요청');
  });

  it("variant='reaction'에서 실패한 역할이 둘 이상이어도 재요청 버튼은 하나만 그린다(PR #12 Codex 1차 검토 P2-b)", () => {
    const twoFailed: Record<ExecMemberId, RoleStatus> = {
      ...roleStatus,
      CFO: 'failed',
    };
    render(
      <LiveStatementCards
        scenario={scenario}
        stage="REACTIONS"
        roleStatus={twoFailed}
        statements={statements}
        stances={stances}
        variant="reaction"
        onRetryFailedRoles={() => {}}
      />,
    );
    // CFO·CAIO 둘 다 failed지만 고정 순서상 먼저 나오는 CFO 카드에만 버튼이 있다 —
    // 같은 testid가 두 번 생기면 strict 모드 단언이 깨진다.
    expect(screen.getAllByTestId('retry-failed-roles')).toHaveLength(1);
    expect(screen.getByTestId('live-role-CFO')).toContainElement(
      screen.getByTestId('retry-failed-roles'),
    );
  });
});
