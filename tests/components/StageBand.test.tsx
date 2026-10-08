// StageBand 말풍선(T102): 발언 전문 대신 핵심 한 구절만 보인다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StageBand } from '../../src/components/parts/StageBand';
import { aiApprovalScenario as aiApproval } from '../../src/content/scenarios/aiApproval';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance } from '../../src/domain/types';

afterEach(cleanup);

const roleStatus: Record<ExecMemberId, RoleStatus> = {
  CEO: 'answered',
  CFO: 'answered',
  CAIO: 'answered',
  CISO: 'answered',
};
const stances: Record<ExecMemberId, Stance> = {
  CEO: 'FOR',
  CFO: 'AGAINST',
  CAIO: 'UNDECIDED',
  CISO: 'AGAINST',
};

describe('StageBand 말풍선', () => {
  it('scripted OPINIONS: bubble 필드의 한 구절만 보이고 전문은 없다', () => {
    render(
      <StageBand
        stage="OPINIONS"
        mode="scripted"
        roleStatus={roleStatus}
        statements={[]}
        opinions={[]}
        scenario={aiApproval}
        stances={stances}
      />,
    );
    const cfo = aiApproval.initialOpinions.find((o) => o.memberId === 'CFO');
    const bubble = screen.getByTestId('stage-bubble-CFO');
    expect(bubble).toHaveTextContent(cfo?.bubble ?? 'missing');
    expect(bubble).not.toHaveTextContent(cfo?.text ?? 'missing');
  });

  it('live OPINIONS: 응답 전문을 18자 이내 한 구절로 줄인다', () => {
    render(
      <StageBand
        stage="OPINIONS"
        mode="live"
        roleStatus={roleStatus}
        statements={[
          {
            id: 's1',
            roleId: 'CFO',
            stage: 'OPINIONS',
            text: '이 안건은 비용이 걱정입니다, 그래서 한도를 정해야 합니다.',
          } as never,
        ]}
        opinions={[]}
        scenario={aiApproval}
        stances={stances}
      />,
    );
    expect(screen.getByTestId('stage-bubble-CFO')).toHaveTextContent('이 안건은 비용이 걱정입니다');
    expect(screen.getByTestId('stage-bubble-CFO')).not.toHaveTextContent('한도를 정해야');
  });
});
