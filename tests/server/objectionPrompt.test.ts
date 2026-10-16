// T137(프롬프트 v19): 반대 근거는 조건과 따로 실린다 — 한국어 라벨만(ID 노출 금지), 안건 수정 아님,
// 허용 조건 목록·ID 대응표에서 제외, 고민 중으로 시작한 임원(CAIO·CISO)에게만 표결 방향 지시.
import { describe, expect, it } from 'vitest';
import { handleRound, type RoundRequest } from '../../server/handlers/round';
import { handleVote, type VoteRequest } from '../../server/handlers/vote';
import type { ModelCompleteRequest, ModelProvider } from '../../server/providers/types';

interface Envelope {
  kind?: string;
  roleId?: string;
  motionId?: string;
  motionHash?: string;
}

function capture(): { provider: ModelProvider; systems: Record<string, string> } {
  const systems: Record<string, string> = {};
  const provider: ModelProvider = {
    async complete(req: ModelCompleteRequest) {
      const envelope = JSON.parse(req.user) as Envelope;
      systems[envelope.roleId ?? '?'] = req.system;
      if (envelope.kind === 'vote') {
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: envelope.motionHash,
            vote: 'NO',
            reason: '근거가 충분합니다.',
            evidenceIds: [],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      }
      return {
        json: {
          roleId: envelope.roleId,
          message: '말씀을 들었습니다.',
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'AGAINST',
        },
        modelId: 'fake-model',
      };
    },
  };
  return { provider, systems };
}

function voteInput(overrides: Partial<VoteRequest> = {}): VoteRequest {
  return {
    sessionId: 's1',
    requestId: 'req-vote',
    mode: 'live',
    scenarioId: 'ai-approval',
    budgetMs: 8000,
    transcript: { revision: 1, statements: [] },
    motion: {
      id: 'm1',
      hash: 'h1',
      text: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다.',
      effectiveConditionIds: ['AG_AUDIT'],
      executionMode: 'DEFAULT',
    },
    participantStance: 'AGAINST',
    ...overrides,
  };
}

describe('표결 프롬프트(v19) — 반대 근거', () => {
  it('반대 근거는 "적용 조건"이 아니라 "참가자가 내건 조건"로 한국어 라벨만 실린다', async () => {
    const { provider, systems } = capture();
    await handleVote(voteInput(), { provider });
    const system = systems.CAIO ?? '';
    expect(system).toContain('참가자가 내건 조건');
    expect(system).toContain('- 승인 이유를 확인할 수 없음');
    expect(system).toContain('적용 조건: 없음');
    expect(system).not.toContain('AG_AUDIT');
  });

  it('허용 조건 목록과 ID 대응표에는 반대 근거가 없다', async () => {
    const { provider, systems } = capture();
    await handleVote(voteInput(), { provider });
    const system = systems.CEO ?? '';
    expect(system).toContain('- 결재 금액 한도');
    expect(system).not.toContain('믿지 못해 책임이 흐려짐');
    expect(system).not.toMatch(/AG_[A-Z]+/);
  });

  it('찬성 참가자에게는 반대 근거 블록이 없다', async () => {
    const { provider, systems } = capture();
    await handleVote(
      voteInput({ participantStance: 'FOR', motion: { ...voteInput().motion, effectiveConditionIds: ['LOG'] } }),
      { provider },
    );
    expect(systems.CAIO).not.toContain('참가자가 내건 조건');
    expect(systems.CAIO).toContain('적용 조건: 승인 사유 기록');
  });

  it('처음 고민 중이던 CAIO·CISO에게만 "설득되지 않았다면 참가자 반대편" 지시가 붙는다', async () => {
    const { provider, systems } = capture();
    await handleVote(voteInput(), { provider });
    for (const roleId of ['CAIO', 'CISO']) expect(systems[roleId]).toContain('처음에 고민 중이었습니다');
    for (const roleId of ['CEO', 'CFO']) expect(systems[roleId]).not.toContain('처음에 고민 중이었습니다');
  });
});

describe('라운드 프롬프트(v19) — 반대 근거', () => {
  function roundInput(overrides: Partial<RoundRequest> = {}): RoundRequest {
    return {
      sessionId: 's1',
      requestId: 'req-round',
      mode: 'live',
      stage: 'REACTIONS',
      transcript: { revision: 1, statements: [] },
      scenarioId: 'experience-first',
      budgetMs: 8000,
      participantStance: 'AGAINST',
      participantOpinion: '반대합니다.',
      confirmedConditionIds: ['AG_WHY'],
      ...overrides,
    };
  }

  it('확정한 반대 근거를 한국어 라벨로 싣고 ID는 싣지 않는다', async () => {
    const { provider, systems } = capture();
    await handleRound(roundInput(), { provider });
    const system = systems.CISO ?? '';
    expect(system).toContain('참가자가 내건 조건');
    expect(system).toContain('- 판단 이유를 설명할 수 없음');
    expect(system).not.toContain('AG_WHY');
  });

  it('반대 근거를 확정하지 않았으면 블록이 없다', async () => {
    const { provider, systems } = capture();
    await handleRound(roundInput({ confirmedConditionIds: [] }), { provider });
    expect(systems.CISO).not.toContain('참가자가 내건 조건');
  });
});
