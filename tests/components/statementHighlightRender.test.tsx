import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EvidenceGrid } from '../../src/components/parts/EvidenceGrid';
import { LiveStatementCards } from '../../src/components/parts/LiveStatementCards';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance, Statement } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

describe.each([aiApprovalScenario, experienceFirstScenario])('$id 자료 카드 강조', (scenario) => {
  it('카드마다 key-term이 1~4곳이고 제목에는 없다', () => {
    const { container } = render(<EvidenceGrid evidence={scenario.evidence} scenario={scenario} />);
    for (const card of container.querySelectorAll('.evidence-card')) {
      const marks = card.querySelectorAll('mark.key-term').length;
      expect(marks).toBeGreaterThanOrEqual(1);
      expect(marks).toBeLessThanOrEqual(4);
      expect(card.querySelectorAll('.evidence-card__heading mark').length).toBe(0);
    }
  });

  it('scenario를 안 주면 강조 없이 그대로 그린다', () => {
    const { container } = render(<EvidenceGrid evidence={scenario.evidence} />);
    expect(container.querySelectorAll('mark').length).toBe(0);
  });
});

describe('LiveStatementCards 강조', () => {
  it('live 발언 본문의 조건 이름·숫자를 강조하고 4곳을 넘지 않는다', () => {
    const scenario = aiApprovalScenario;
    const text = '결재 금액 한도를 정하고 1건 2건 3건 4건 5건 6건을 확인합시다.';
    const statements: Statement[] = [
      {
        id: 's0', roleId: 'CFO', stage: 'OPINIONS', text, evidenceIds: [], referencedStatementIds: [],
        concerns: [], suggestedConditionIds: [], stance: 'FOR', source: 'live', createdAt: 0,
      },
    ];
    const roleStatus: Record<ExecMemberId, RoleStatus> = { CEO: 'idle', CFO: 'answered', CAIO: 'idle', CISO: 'idle' };
    const stances: Record<ExecMemberId, Stance> = { CEO: 'UNDECIDED', CFO: 'FOR', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' };
    const { container } = render(
      <LiveStatementCards scenario={scenario} stage="OPINIONS" roleStatus={roleStatus} statements={statements} stances={stances} />,
    );
    const marks = [...container.querySelectorAll('.live-statement__text mark.key-term')];
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks.length).toBeLessThanOrEqual(4);
    expect(marks.map((m) => m.textContent)).toContain('결재 금액 한도');
  });
});
