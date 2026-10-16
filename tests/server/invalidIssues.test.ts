// T136: 응답 형식 검사 실패 원인을 `invalidIssues` 로그 필드로 남긴다(본문은 남기지 않는다).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallLogEntry } from '../../server/log';

const logged: CallLogEntry[] = [];
vi.mock('../../server/log', () => ({
  logCall: (entry: CallLogEntry) => {
    logged.push(entry);
  },
}));

import { handleVote, type VoteRequest } from '../../server/handlers/vote';
import { summarizeInvalidIssues } from '../../server/handlers/shared';
import { voteResponseSchema } from '../../server/validate';
import type { ModelProvider } from '../../server/providers/types';

function input(): VoteRequest {
  return {
    sessionId: 'session-1',
    requestId: 'req-1',
    mode: 'live',
    scenarioId: 'ai-approval',
    budgetMs: 15000,
    transcript: { revision: 1, statements: [{ id: 's1', roleId: 'CEO', message: '작게 시작합시다.' }] },
    motion: {
      id: 'work-assistant-original',
      hash: 'hash-1',
      text: '업무 비서를 도입한다.',
      effectiveConditionIds: ['LIMIT'],
      executionMode: 'pilot',
    },
    roleIds: ['CFO'],
  };
}

function providerReturning(patch: Record<string, unknown>): ModelProvider {
  return {
    async complete(req) {
      const envelope = JSON.parse(req.user) as { roleId: string; motionId: string; motionHash: string };
      return {
        json: {
          roleId: envelope.roleId,
          motionId: envelope.motionId,
          motionHash: envelope.motionHash,
          vote: 'YES',
          reason: '비용 대비 효과가 확인됩니다.',
          evidenceIds: ['E1'],
          remainingConcerns: [],
          ...patch,
        },
        modelId: 'fake',
      };
    },
  };
}

describe('invalidIssues 로그 필드', () => {
  beforeEach(() => {
    logged.length = 0;
  });

  it('reason이 160자를 넘으면 reason:too_big만 남기고 본문은 남기지 않는다', async () => {
    await handleVote(input(), { provider: providerReturning({ reason: '가'.repeat(200) }) });
    expect(logged).toHaveLength(1);
    expect(logged[0]?.invalidIssues).toEqual(['reason:too_big']);
    expect(JSON.stringify(logged[0])).not.toContain('가가가');
  });

  it('영문 토큰이 걸리면 reason:custom:토큰을 남긴다', async () => {
    await handleVote(input(), { provider: providerReturning({ reason: 'E4 자료에 따라 찬성합니다.' }) });
    expect(logged[0]?.invalidIssues).toEqual(['reason:custom:E4']);
  });

  it('내부 식별자가 아닌 영문 단어(참가자 이름·프로젝트명 등)는 로그에 남기지 않고 other로만 적는다(PR #22 Codex P1)', async () => {
    await handleVote(input(), { provider: providerReturning({ reason: 'Hyunwoo 이사님 말대로 Phoenix 사업은 찬성합니다.' }) });
    expect(logged[0]?.invalidIssues).toEqual(['reason:custom:other']);
    const line = JSON.stringify(logged[0]);
    expect(line).not.toContain('Hyunwoo');
    expect(line).not.toContain('Phoenix');
  });

  it('조건 ID 같은 내부 식별자는 그대로 남긴다', async () => {
    await handleVote(input(), { provider: providerReturning({ reason: 'LIMIT 조건이 있어 찬성합니다.' }) });
    expect(logged[0]?.invalidIssues).toEqual(['reason:custom:LIMIT']);
  });

  it('motionHash가 다르면 motionHash:invalid_value 계열 코드가 남는다', async () => {
    await handleVote(input(), { provider: providerReturning({ motionHash: 'other' }) });
    expect(logged[0]?.invalidIssues?.[0]).toMatch(/^motionHash:/);
  });

  it('첫 시도가 형식 오류였다가 재시도로 성공해도 원인을 남긴다(PR #22 Codex P2)', async () => {
    const first = providerReturning({ reason: '가'.repeat(200) });
    const second = providerReturning({});
    let calls = 0;
    const flaky: ModelProvider = {
      async complete(req) {
        calls += 1;
        return calls === 1 ? first.complete(req) : second.complete(req);
      },
    };
    await handleVote(input(), { provider: flaky });
    expect(logged).toHaveLength(1);
    expect(logged[0]?.status).toBe('answered');
    expect(logged[0]?.attempts).toBe(2);
    expect(logged[0]?.invalidIssues).toEqual(['reason:too_big']);
  });

  it('성공한 표에는 invalidIssues가 없다', async () => {
    await handleVote(input(), { provider: providerReturning({}) });
    expect(logged[0]?.status).toBe('answered');
    expect(logged[0]?.invalidIssues).toBeUndefined();
  });

  it('summarizeInvalidIssues는 중복을 합치고 8개까지만 남긴다', () => {
    const json = { roleId: 'CFO', motionId: 'x', motionHash: 'y', vote: 'MAYBE', reason: 'LIMIT', evidenceIds: [], remainingConcerns: [] };
    const parsed = voteResponseSchema({ motionId: 'm', motionHash: 'h' }).safeParse(json);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = summarizeInvalidIssues(parsed.error, json, ['reason']);
      expect(issues.length).toBeLessThanOrEqual(8);
      expect(new Set(issues).size).toBe(issues.length);
      expect(issues).toContain('vote:invalid_value');
    }
  });
});
