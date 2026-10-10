// T115: 비서실장 결과가 입장·조건·회의 기록이 바뀐 뒤에도 옛 내용으로 남지 않는지 확인한다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AssistantPanel } from '../../src/components/parts/AssistantPanel';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { scriptedStances } from '../../src/domain/stance';
import type { AssistantAdapter } from '../../src/services/assistant/types';
import { scriptedAssistantAdapter } from '../../src/services/assistant/scripted';

afterEach(() => cleanup());

const scenario = aiApprovalScenario;
const stances = scriptedStances(scenario, { stage: 'DISCUSS', opinions: [] });

function props(overrides: Record<string, unknown> = {}) {
  return {
    scenario,
    sessionId: 's1',
    selectedConditionIds: [] as string[],
    participantStance: 'FOR' as const,
    mode: 'scripted' as const,
    stances,
    draftText: '',
    draftRevision: 0,
    transcript: { revision: 0, statements: [] },
    onApplyDraft: () => {},
    onAssistantAction: () => {},
    ...overrides,
  };
}

describe('AssistantPanel 결과 갱신(T115)', () => {
  it('조건 추천을 연 뒤 조건을 확정하면 "처음 안과의 차이"가 지금 확정한 조건을 보여준다', async () => {
    const { rerender } = render(<AssistantPanel {...props()} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-compare'));
    await screen.findByTestId('assistant-recommend-opening', {}, { timeout: 2000 });
    expect(screen.getByText('지금까지 확정한 조건이 없습니다.')).toBeInTheDocument();
    rerender(<AssistantPanel {...props({ selectedConditionIds: ['LOG'] })} />);
    expect(screen.queryByText('지금까지 확정한 조건이 없습니다.')).toBeNull();
    expect(screen.getByTestId('assistant-result-compare')).toHaveTextContent('승인 사유 기록');
  });

  it('live 요약을 본 뒤 회의 기록이 바뀌면(새 반응 도착) 옛 요약을 비운다', async () => {
    const adapter: AssistantAdapter = {
      ...scriptedAssistantAdapter,
      summarizeOpinions: async () => ({ mode: 'live', evidenceIds: [], commonPoints: [], disagreements: [], summaryText: '옛 요약 문장' }),
    };
    const { rerender } = render(<AssistantPanel {...props({ adapter, mode: 'live' })} />);
    fireEvent.click(screen.getByTestId('assistant-toggle'));
    fireEvent.click(screen.getByTestId('assistant-action-summary'));
    await screen.findByTestId('assistant-summary-text');
    rerender(<AssistantPanel {...props({ adapter, mode: 'live', transcript: { revision: 3, statements: [] } })} />);
    expect(screen.queryByText('옛 요약 문장')).toBeNull();
  });
});
