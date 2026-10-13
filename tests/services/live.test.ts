// services/boardAgents/live.ts: fetch mock으로 timeout·abort·비정상 응답(배열 아님/개별 항목
// 형식 오류) 처리와 정상 변환(Statement/Ballot), 최종 안건 없는 경우의 가드를 확인한다.
// AGENT_BOARDROOM_SPEC.md 5·6장.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { fakeClock, type FakeClock } from '../../src/domain/clock';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Session } from '../../src/domain/types';
import { EXEC_MEMBER_ORDER } from '../../src/domain/voting';
import {
  createLiveBoardAgentsAdapter,
  MAX_ROUND_TIMEOUT_MS,
  TRANSPORT_MARGIN_MS,
} from '../../src/services/boardAgents/live';
import type { BoardAgentsContext } from '../../src/services/boardAgents/types';

function toOpinionsStage(clock: FakeClock): Session {
  let session = createInitialSession(clock.now());
  session = reduce(session, { type: 'START' }, clock.now());
  session = reduce(session, { type: 'SET_MODE', mode: 'live' }, clock.now());
  session = reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // INTRO -> SELECT
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: anonBoardScenario.id }, clock.now());
  return reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // BRIEFING -> OPINIONS
}

function toVoteStage(clock: FakeClock): Session {
  let session = toOpinionsStage(clock);
  session = reduce(session, { type: 'NEXT_STAGE' }, clock.now()); // OPINIONS -> DISCUSS
  session = reduce(
    session,
    {
      type: 'SUBMIT_OPINION',
      originalText: '검토했습니다. 작은 범위로 시작하는 데 동의합니다.',
      selectedPhraseIds: [],
      confirmedConditionIds: [],
    },
    clock.now(),
  ); // DISCUSS -> REACTIONS
  session = reduce(session, { type: 'KEEP_PREVIOUS' }, clock.now()); // REACTIONS -> MOTION
  return reduce(
    session,
    { type: 'FREEZE_MOTION', scenario: anonBoardScenario, confirmedConditionIds: [] },
    clock.now(),
  ); // MOTION -> VOTE
}

function makeCtx(session: Session, signal: AbortSignal = new AbortController().signal): BoardAgentsContext {
  return {
    sessionId: session.sessionId,
    requestId: 'req-1',
    session,
    scenario: anonBoardScenario,
    budgetMs: 8000,
    signal,
  };
}

/** signal이 abort되기 전에는 절대 resolve/reject하지 않는 fetch mock. timeout·abort 테스트에 쓴다. */
function neverSettlesUntilAbort(): ReturnType<typeof vi.fn> {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
        return;
      }
      signal?.addEventListener(
        'abort',
        () => reject(new DOMException('요청이 취소되었습니다.', 'AbortError')),
        { once: true },
      );
    });
  });
}

/** ms 뒤에 payload로 응답하되, 그전에 signal이 abort되면 대신 reject하는 fetch mock. 서버
 * per-role 타임아웃 직후(클라이언트 abort 여유 안)에 도착하는 부분 실패 응답을 흉내낸다
 * (PR #11 Codex 24차 P1, TRANSPORT_MARGIN_MS). */
function delayedResponseFetch(ms: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((resolve, reject) => {
      const signal = init?.signal;
      const timer = setTimeout(() => resolve({ ok: true, json: async () => payload }), ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
        },
        { once: true },
      );
    });
  });
}

describe('live board agents adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('정상 응답을 Statement로 변환하고 실패한 역할은 failed로 남긴다', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          roleId: 'CEO',
          status: 'answered',
          statement: {
            roleId: 'CEO',
            message: '자료를 검토했습니다.',
            evidenceIds: ['E1'],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'FOR',
          },
        },
        { roleId: 'CFO', status: 'failed', failReason: 'timeout' },
        {
          roleId: 'CAIO',
          status: 'answered',
          statement: {
            roleId: 'CAIO',
            message: '실행 가능성을 봅시다.',
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'UNDECIDED',
          },
        },
        {
          roleId: 'CISO',
          status: 'answered',
          statement: {
            roleId: 'CISO',
            message: '권한 범위를 확인합시다.',
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'AGAINST',
          },
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.initialOpinions(makeCtx(toOpinionsStage(clock)));

    expect(fetchMock).toHaveBeenCalledWith('/api/board/round', expect.objectContaining({ method: 'POST' }));
    const byRole = Object.fromEntries(outcomes.map((o) => [o.roleId, o]));
    expect(byRole.CEO?.status).toBe('answered');
    expect(byRole.CEO?.statement?.text).toBe('자료를 검토했습니다.');
    expect(byRole.CEO?.statement?.stage).toBe('OPINIONS');
    expect(byRole.CEO?.statement?.source).toBe('live');
    expect(byRole.CEO?.statement?.stance).toBe('FOR');
    expect(byRole.CFO?.status).toBe('failed');
    expect(byRole.CFO?.failReason).toBe('timeout');
  });

  it('timeout이 되면 임원 4명 모두 failed로 남는다', async () => {
    const fetchMock = neverSettlesUntilAbort();
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomesPromise = adapter.initialOpinions(makeCtx(toOpinionsStage(clock)));
    // 클라이언트 abort 타이머는 서버 예산(MAX_ROUND_TIMEOUT_MS)보다 TRANSPORT_MARGIN_MS만큼
    // 더 늦게 끊는다(PR #11 Codex 24차 P1) — 그 여유까지 지나야 진짜로 abort된다.
    await vi.advanceTimersByTimeAsync(MAX_ROUND_TIMEOUT_MS + TRANSPORT_MARGIN_MS);
    const outcomes = await outcomesPromise;

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'failed')).toBe(true);
  });

  it('서버 예산 직후(여유 안)에 일부만 응답해도(3명 성공+1명 timeout) 그 역할만 failed로 남는다(PR #11 Codex 24차 P1)', async () => {
    const partialPayload = [
      {
        roleId: 'CEO',
        status: 'answered',
        statement: {
          roleId: 'CEO',
          message: '늦게라도 검토했습니다.',
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'FOR',
        },
      },
      { roleId: 'CFO', status: 'failed', failReason: 'timeout' },
      {
        roleId: 'CAIO',
        status: 'answered',
        statement: {
          roleId: 'CAIO',
          message: '실행 가능성을 봅시다.',
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'UNDECIDED',
        },
      },
      {
        roleId: 'CISO',
        status: 'answered',
        statement: {
          roleId: 'CISO',
          message: '권한 범위를 확인합시다.',
          evidenceIds: [],
          referencedStatementIds: [],
          concerns: [],
          suggestedConditionIds: [],
          stance: 'AGAINST',
        },
      },
    ];
    // 서버가 MAX_ROUND_TIMEOUT_MS + 500ms(< TRANSPORT_MARGIN_MS)에 응답한다 — 고치기 전
    // 클라이언트 abort 타이머(MAX_ROUND_TIMEOUT_MS 그대로)였다면 이 응답이 오기 전에 이미
    // abort돼 4명 모두 failed로 덮였을 시점이다.
    const fetchMock = delayedResponseFetch(MAX_ROUND_TIMEOUT_MS + 500, partialPayload);
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomesPromise = adapter.initialOpinions(makeCtx(toOpinionsStage(clock)));
    await vi.advanceTimersByTimeAsync(MAX_ROUND_TIMEOUT_MS + 500);
    const outcomes = await outcomesPromise;

    const byRole = Object.fromEntries(outcomes.map((o) => [o.roleId, o]));
    expect(byRole.CEO?.status).toBe('answered');
    expect(byRole.CFO?.status).toBe('failed');
    expect(byRole.CFO?.failReason).toBe('timeout');
    expect(byRole.CAIO?.status).toBe('answered');
    expect(byRole.CISO?.status).toBe('answered');
  });

  it('signal이 이미 취소된 상태면 응답을 기다리지 않고 모두 failed로 남는다', async () => {
    const fetchMock = neverSettlesUntilAbort();
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const controller = new AbortController();
    controller.abort();
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.reactions(makeCtx(toOpinionsStage(clock), controller.signal));

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'failed')).toBe(true);
  });

  it('응답이 배열이 아니면 임원 4명 모두 failed(invalid_response)로 남는다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ unexpected: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.reactions(makeCtx(toOpinionsStage(clock)));

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'failed' && o.failReason === 'invalid_response')).toBe(true);
  });

  it('HTTP 오류 응답(!ok)이면 임원 4명 모두 failed로 남는다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.followUp(makeCtx(toOpinionsStage(clock)));

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'failed')).toBe(true);
  });

  it('개별 응답이 형식에 맞지 않으면 그 역할만 failed(invalid_response)로 남긴다', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { roleId: 'CEO', status: 'answered', statement: { message: '괜찮습니다.' } }, // evidenceIds 등 누락
        {
          roleId: 'CFO',
          status: 'answered',
          statement: {
            roleId: 'CFO',
            message: '비용을 봅시다.',
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'AGAINST',
          },
        },
        { roleId: 'CAIO', status: 'failed', failReason: 'invalid_response' },
        {
          roleId: 'CISO',
          status: 'answered',
          statement: {
            roleId: 'CISO',
            message: '권한을 봅시다.',
            evidenceIds: [],
            referencedStatementIds: [],
            concerns: [],
            suggestedConditionIds: [],
            stance: 'UNDECIDED',
          },
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.followUp(makeCtx(toOpinionsStage(clock)));
    const byRole = Object.fromEntries(outcomes.map((o) => [o.roleId, o]));

    expect(byRole.CEO?.status).toBe('failed');
    expect(byRole.CEO?.failReason).toBe('invalid_response');
    expect(byRole.CFO?.status).toBe('answered');
    expect(byRole.CAIO?.status).toBe('failed');
    expect(byRole.CISO?.status).toBe('answered');
  });

  it('최종 표 응답을 Ballot으로 변환하고 요청 본문에 고정 안건을 담는다', async () => {
    const clock = fakeClock(0);
    const session = toVoteStage(clock);
    const motion = session.finalMotion;
    if (!motion) throw new Error('테스트 전제: finalMotion이 있어야 합니다.');
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { motion?: { id?: string; hash?: string } };
      expect(body.motion?.id).toBe(motion.id);
      expect(body.motion?.hash).toBe(motion.hash);
      return {
        ok: true,
        json: async () =>
          EXEC_MEMBER_ORDER.map((roleId) => ({
            roleId,
            status: 'answered',
            ballot: {
              roleId,
              motionId: motion.id,
              motionHash: motion.hash,
              vote: 'YES',
              reason: '검토 결과 찬성합니다.',
              evidenceIds: [],
              remainingConcerns: [],
            },
            modelId: 'model-x',
            promptVersion: 'v1',
          })),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.finalVotes(makeCtx(session));

    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'answered' && o.ballot?.vote === 'YES')).toBe(true);
    expect(outcomes.every((o) => o.ballot?.source === 'live')).toBe(true);
  });

  it('표 요청도 서버 예산 직후(여유 안)에 일부만 응답하면 그 역할만 failed로 남긴다(PR #11 Codex 24차 P1)', async () => {
    const clock = fakeClock(0);
    const session = toVoteStage(clock);
    const motion = session.finalMotion;
    if (!motion) throw new Error('테스트 전제: finalMotion이 있어야 합니다.');
    const partialPayload = EXEC_MEMBER_ORDER.map((roleId) =>
      roleId === 'CFO'
        ? { roleId, status: 'failed', failReason: 'timeout' }
        : {
            roleId,
            status: 'answered',
            ballot: {
              roleId,
              motionId: motion.id,
              motionHash: motion.hash,
              vote: 'YES',
              reason: '검토 결과 찬성합니다.',
              evidenceIds: [],
              remainingConcerns: [],
            },
            modelId: 'model-x',
            promptVersion: 'v1',
          },
    );
    // 표 요청도 라운드 요청과 같은 abort 여유(TRANSPORT_MARGIN_MS)를 쓴다 — 서버 예산
    // (MAX_ROUND_TIMEOUT_MS) 직후 500ms(< 여유)에 응답이 와도 abort되지 않아야 한다.
    const fetchMock = delayedResponseFetch(MAX_ROUND_TIMEOUT_MS + 500, partialPayload);
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomesPromise = adapter.finalVotes(makeCtx(session));
    await vi.advanceTimersByTimeAsync(MAX_ROUND_TIMEOUT_MS + 500);
    const outcomes = await outcomesPromise;

    const byRole = Object.fromEntries(outcomes.map((o) => [o.roleId, o]));
    expect(byRole.CEO?.status).toBe('answered');
    expect(byRole.CFO?.status).toBe('failed');
    expect(byRole.CFO?.failReason).toBe('timeout');
    expect(byRole.CAIO?.status).toBe('answered');
    expect(byRole.CISO?.status).toBe('answered');
  });

  it('고정된 최종 안건이 없으면 요청을 보내지 않고 모두 failed로 남긴다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const clock = fakeClock(0);
    const adapter = createLiveBoardAgentsAdapter();

    const outcomes = await adapter.finalVotes(makeCtx(toOpinionsStage(clock)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcomes).toHaveLength(4);
    expect(outcomes.every((o) => o.status === 'failed' && o.failReason === 'no_final_motion')).toBe(true);
  });
});
