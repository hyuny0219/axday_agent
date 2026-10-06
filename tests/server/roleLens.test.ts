// T79: 안건별 임원 렌즈(<role_lens>)·첫 의견 전용 출발 성향(<opening_stance>)이 임원
// 프롬프트의 올바른 자리에만 들어가는지 확인한다. OPINIONS에는 둘 다, REACTIONS·FOLLOWUP·
// VOTE에는 role_lens만, 비서실장 refine·summarize에는 둘 다 없어야 한다(EXEC_DECISION_RULE과
// 같은 위치 — server/prompts/roles/index.ts — 에 둬서 새지 않게 했다).

import { describe, expect, it } from 'vitest';
import { handleRound, type RoundRequest } from '../../server/handlers/round';
import { handleVote, type VoteRequest } from '../../server/handlers/vote';
import {
  handleAssistantRefine,
  handleAssistantSummarize,
  type AssistantRefineRequest,
  type AssistantSummarizeRequest,
} from '../../server/handlers/assistant';
import type { ModelCompleteRequest, ModelProvider } from '../../server/providers/types';

interface Envelope {
  kind?: string;
  roleId?: string;
  motionId?: string;
  motionHash?: string;
  draftRevision?: number;
}

/** 호출마다 system 프롬프트를 수집하고, 어떤 kind로 와도 각 핸들러의 응답 스키마를
 * 통과하는 최소 JSON을 돌려주는 fake provider. */
function captureSystemProvider(): { provider: ModelProvider; systems: string[] } {
  const systems: string[] = [];
  const provider: ModelProvider = {
    async complete(req: ModelCompleteRequest) {
      systems.push(req.system);
      const envelope = JSON.parse(req.user) as Envelope;
      if (envelope.kind === 'vote') {
        return {
          json: {
            roleId: envelope.roleId,
            motionId: envelope.motionId,
            motionHash: envelope.motionHash,
            vote: 'YES',
            reason: '근거가 충분합니다.',
            evidenceIds: [],
            remainingConcerns: [],
          },
          modelId: 'fake-model',
        };
      }
      if (envelope.kind === 'assistant_refine' || envelope.kind === 'assistant_summarize') {
        return {
          json: {
            draftRevision: envelope.draftRevision ?? 0,
            draftText: '정리된 문장입니다.',
            evidenceIds: [],
            suggestedConditionIds: [],
          },
          modelId: 'fake-model',
        };
      }
      return {
        json: {
          roleId: envelope.roleId,
          message: '검토했습니다.',
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'FOR',
        },
        modelId: 'fake-model',
      };
    },
  };
  return { provider, systems };
}

describe('T79 안건별 임원 렌즈·첫 의견 출발 성향', () => {
  it('OPINIONS 프롬프트에는 role_lens와 opening_stance가 모두 들어간다', async () => {
    const { provider, systems } = captureSystemProvider();
    const input: RoundRequest = {
      sessionId: 's1',
      requestId: 'req-opinions',
      mode: 'live',
      stage: 'OPINIONS',
      transcript: { revision: 0, statements: [] },
      scenarioId: 'ai-approval',
      budgetMs: 8000,
      roleIds: ['CEO'],
    };
    await handleRound(input, { provider });
    expect(systems).toHaveLength(1);
    expect(systems[0]).toContain('<role_lens>');
    expect(systems[0]).toContain('<opening_stance>');
  });

  it.each(['REACTIONS', 'FOLLOWUP'] as const)(
    '%s 프롬프트에는 role_lens만 있고 opening_stance는 없다',
    async (stage) => {
      const { provider, systems } = captureSystemProvider();
      const input: RoundRequest = {
        sessionId: 's1',
        requestId: `req-${stage}`,
        mode: 'live',
        stage,
        transcript: { revision: 1, statements: [] },
        scenarioId: 'ai-approval',
        budgetMs: 8000,
        roleIds: ['CEO'],
      };
      await handleRound(input, { provider });
      expect(systems[0]).toContain('<role_lens>');
      expect(systems[0]).not.toContain('<opening_stance>');
    },
  );

  it('VOTE 프롬프트에는 role_lens만 있고 opening_stance는 없다', async () => {
    const { provider, systems } = captureSystemProvider();
    const input: VoteRequest = {
      sessionId: 's1',
      requestId: 'req-vote',
      mode: 'live',
      scenarioId: 'ai-approval',
      budgetMs: 8000,
      transcript: { revision: 2, statements: [] },
      motion: { id: 'm1', hash: 'h1', text: '안건', effectiveConditionIds: [], executionMode: 'DEFAULT' },
      roleIds: ['CEO'],
    };
    await handleVote(input, { provider });
    expect(systems[0]).toContain('<role_lens>');
    expect(systems[0]).not.toContain('<opening_stance>');
  });

  it('비서실장 refine·summarize 프롬프트에는 role_lens·opening_stance가 전혀 없다', async () => {
    const { provider, systems } = captureSystemProvider();
    const refineInput: AssistantRefineRequest = {
      sessionId: 's1',
      requestId: 'req-refine',
      mode: 'live',
      scenarioId: 'ai-approval',
      budgetMs: 5000,
      draftText: '제 생각은 이렇습니다.',
      draftRevision: 0,
    };
    await handleAssistantRefine(refineInput, { provider });
    const summarizeInput: AssistantSummarizeRequest = {
      sessionId: 's1',
      requestId: 'req-summarize',
      mode: 'live',
      scenarioId: 'ai-approval',
      budgetMs: 5000,
      transcript: { revision: 0, statements: [] },
    };
    await handleAssistantSummarize(summarizeInput, { provider });

    expect(systems).toHaveLength(2);
    for (const system of systems) {
      expect(system).not.toContain('<role_lens>');
      expect(system).not.toContain('<opening_stance>');
    }
  });

  it('두 안건(ai-approval·experience-first) 모두 OPINIONS에서 역할별 렌즈 문구가 실제로 들어간다', async () => {
    const { provider, systems } = captureSystemProvider();
    await handleRound(
      {
        sessionId: 's1',
        requestId: 'req-ai-approval-ciso',
        mode: 'live',
        stage: 'OPINIONS',
        transcript: { revision: 0, statements: [] },
        scenarioId: 'ai-approval',
        budgetMs: 8000,
        roleIds: ['CISO'],
      },
      { provider },
    );
    await handleRound(
      {
        sessionId: 's1',
        requestId: 'req-experience-first-ciso',
        mode: 'live',
        stage: 'OPINIONS',
        transcript: { revision: 0, statements: [] },
        scenarioId: 'experience-first',
        budgetMs: 8000,
        roleIds: ['CISO'],
      },
      { provider },
    );

    expect(systems[0]).toContain('감사 메모의 기록 부재를 권한 위임의 책임 문제');
    expect(systems[0]).toContain('반대 쪽으로 기운 채');
    expect(systems[1]).toContain('인터뷰 메모의 기록 부재를 사후 검증 불가 문제');
    expect(systems[1]).toContain('반대 쪽으로 기운 채');
  });
});
