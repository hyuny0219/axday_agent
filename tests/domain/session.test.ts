import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Session } from '../../src/domain/types';

const scenario = anonBoardScenario;
const T0 = 1_700_000_000_000;

/** ATTRACT에서 REACTIONS 직전(의견 전달 완료)까지 정상 경로로 진행한 세션을 만든다. */
function sessionAtReactions(now = T0): Session {
  let session = createInitialSession(now);
  session = reduce(session, { type: 'START' }, now);
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, now);
  // BRIEFING: 자동 정리 카드가 렌더되면 세션당 한 번만 기록한다(지시서 5장). 중복은 무시.
  session = reduce(session, { type: 'MARK_SUMMARY_SHOWN' }, now);
  session = reduce(session, { type: 'MARK_SUMMARY_SHOWN' }, now);
  session = reduce(session, { type: 'NEXT_STAGE' }, now);
  session = reduce(session, { type: 'NEXT_STAGE' }, now);
  session = reduce(
    session,
    {
      type: 'SUBMIT_OPINION',
      originalText: '작은 범위로 먼저 시작합시다.',
      selectedPhraseIds: ['P1'],
      confirmedConditionIds: [],
    },
    now,
  );
  return session;
}

describe('정상 완주', () => {
  it('ATTRACT부터 RESULT까지 이동하며 5석 표결과 결론을 만든다', () => {
    let session = sessionAtReactions();
    expect(session.stage).toBe('REACTIONS');
    expect(session.opinions).toHaveLength(1);

    session = reduce(session, { type: 'KEEP_PREVIOUS' }, T0);
    expect(session.stage).toBe('MOTION');
    expect(session.followUpUsed).toBe(true);

    session = reduce(
      session,
      { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: [] },
      T0,
    );
    expect(session.stage).toBe('VOTE');
    expect(session.finalMotion?.kind).toBe('original');
    expect(session.ballots).toHaveLength(4);

    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    expect(session.pendingVote).toBe('YES');

    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);
    expect(session.stage).toBe('RESULT');
    expect(session.pendingVote).toBeNull();
    expect(session.ballots).toHaveLength(5);
    // 대표 경로표: 없음(원안) / YES,HOLD,NO,NO / 참가자 YES → HOLD.
    expect(session.outcome).toBe('HOLD');
    expect(session.warnings).toEqual([]);

    expect(session.assistantActions).toEqual(['SUMMARY_SHOWN']);
  });
});

describe('후속 1회 제한', () => {
  it('첫 후속 의견 전달은 허용되고 followUpUsed가 true가 된다', () => {
    const session = reduce(
      sessionAtReactions(),
      {
        type: 'SUBMIT_FOLLOWUP',
        originalText: '권한 확인도 함께 해봅시다.',
        selectedPhraseIds: ['P3'],
        confirmedConditionIds: ['TRACE'],
      },
      T0,
    );
    expect(session.stage).toBe('MOTION');
    expect(session.followUpUsed).toBe(true);
    expect(session.opinions).toHaveLength(2);
    expect(session.warnings).toEqual([]);
  });

  it('이미 사용한 후속 질문은 두 번째 SUBMIT_FOLLOWUP을 무시한다', () => {
    const already: Session = { ...sessionAtReactions(), followUpUsed: true };
    const result = reduce(
      already,
      {
        type: 'SUBMIT_FOLLOWUP',
        originalText: '다시 시도',
        selectedPhraseIds: [],
        confirmedConditionIds: [],
      },
      T0,
    );
    expect(result.stage).toBe('REACTIONS');
    expect(result.opinions).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('이미 사용한 후속 질문은 KEEP_PREVIOUS도 무시한다', () => {
    const already: Session = { ...sessionAtReactions(), followUpUsed: true };
    const result = reduce(already, { type: 'KEEP_PREVIOUS' }, T0);
    expect(result.stage).toBe('REACTIONS');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('FREEZE_MOTION 충돌 조건 방어', () => {
  it('충돌하는 두 조건을 함께 넘기면 고정을 거부하고 warnings만 남긴다', () => {
    const session = reduce(sessionAtReactions(), { type: 'KEEP_PREVIOUS' }, T0);
    expect(session.stage).toBe('MOTION');

    const result = reduce(
      session,
      { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: ['TRACE', 'ANON_FULL'] },
      T0,
    );

    expect(result.stage).toBe('MOTION');
    expect(result.finalMotion).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('충돌이 없으면 정상적으로 VOTE로 넘어간다', () => {
    const session = reduce(sessionAtReactions(), { type: 'KEEP_PREVIOUS' }, T0);

    const result = reduce(
      session,
      { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: ['TRACE'] },
      T0,
    );

    expect(result.stage).toBe('VOTE');
    expect(result.finalMotion).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

describe('이중 확정', () => {
  function sessionAtVote(): Session {
    let session = reduce(sessionAtReactions(), { type: 'KEEP_PREVIOUS' }, T0);
    session = reduce(session, { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: [] }, T0);
    return reduce(session, { type: 'SELECT_VOTE', vote: 'NO' }, T0);
  }

  it('두 번째 CONFIRM_VOTE는 무시한다', () => {
    const confirmed = reduce(sessionAtVote(), { type: 'CONFIRM_VOTE' }, T0);
    expect(confirmed.stage).toBe('RESULT');
    const confirmedBallots = confirmed.ballots;

    // 이미 확정된 세션에서 다시 확정을 시도하면(예: 재전송) 단계가 달라 그대로 무시된다.
    const second = reduce(confirmed, { type: 'CONFIRM_VOTE' }, T0);
    expect(second.stage).toBe('RESULT');
    expect(second.ballots).toEqual(confirmedBallots);
    expect(second.outcome).toBe(confirmed.outcome);
    expect(second.warnings.length).toBeGreaterThan(0);
  });

  it('이미 참가자 표가 있는 VOTE 단계에서 재확정을 명시적으로 차단한다', () => {
    const atVote = sessionAtVote();
    const votedButNotAdvanced: Session = {
      ...atVote,
      ballots: [
        ...atVote.ballots,
        {
          memberId: 'PARTICIPANT',
          motionId: atVote.finalMotion!.id,
          motionHash: atVote.finalMotion!.hash,
          source: 'scripted',
          vote: 'NO',
          confirmedAt: T0,
        },
      ],
    };
    const result = reduce(votedButNotAdvanced, { type: 'CONFIRM_VOTE' }, T0);
    expect(result.stage).toBe('VOTE');
    expect(result.ballots).toHaveLength(5);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('리셋 후 이전 값 없음', () => {
  it('OPERATOR_RESET은 새 sessionId와 초기 상태를 돌려준다', () => {
    let session = reduce(sessionAtReactions(), { type: 'KEEP_PREVIOUS' }, T0);
    session = reduce(session, { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: [] }, T0);
    const beforeReset = session;

    const reset = reduce(session, { type: 'OPERATOR_RESET', nextSessionId: 'reset-1' }, T0 + 1);
    expect(reset.sessionId).not.toBe(beforeReset.sessionId);
    expect(reset.stage).toBe('ATTRACT');
    expect(reset.scenarioId).toBeNull();
    expect(reset.opinions).toEqual([]);
    expect(reset.finalMotion).toBeNull();
    expect(reset.ballots).toEqual([]);
    expect(reset.outcome).toBeNull();
    expect(reset.followUpUsed).toBe(false);
    expect(reset.warnings).toEqual([]);
    expect(reset.sessionId).toBe('reset-1');
  });

  it('리셋은 순수하다: 같은 (session, action, now)를 두 번 reduce하면 같은 결과가 나온다', () => {
    const session = sessionAtReactions();
    const action = { type: 'OPERATOR_RESET', nextSessionId: 'reset-same' } as const;
    expect(reduce(session, action, T0 + 1)).toEqual(reduce(session, action, T0 + 1));
  });
});

describe('단계 밖 액션 무시', () => {
  it('ATTRACT에서 NEXT_STAGE는 무시된다', () => {
    const session = createInitialSession(T0);
    const result = reduce(session, { type: 'NEXT_STAGE' }, T0);
    expect(result.stage).toBe('ATTRACT');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('SELECT 단계에서 SUBMIT_OPINION은 무시된다', () => {
    const session = reduce(createInitialSession(T0), { type: 'START' }, T0);
    const result = reduce(
      session,
      { type: 'SUBMIT_OPINION', originalText: '아직 이르다', selectedPhraseIds: [], confirmedConditionIds: [] },
      T0,
    );
    expect(result.stage).toBe('SELECT');
    expect(result.opinions).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('BRIEFING 단계 밖에서는 RECORD_ASSISTANT_ACTION을 무시한다', () => {
    const session = createInitialSession(T0);
    const result = reduce(
      session,
      {
        type: 'RECORD_ASSISTANT_ACTION',
        entry: { type: 'OPINION_SUMMARY', mode: 'scripted', evidenceIds: [] },
      },
      T0,
    );
    expect(result.assistantActions).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('RECORD_ASSISTANT_ACTION은 mode·evidenceIds·applied·requestedAt(now)을 그대로 기록한다', () => {
    let session = reduce(createInitialSession(T0), { type: 'START' }, T0);
    session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, T0);
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // BRIEFING -> OPINIONS
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // OPINIONS -> DISCUSS

    const now = T0 + 1234;
    const result = reduce(
      session,
      {
        type: 'RECORD_ASSISTANT_ACTION',
        entry: { type: 'DRAFT_REFINE', mode: 'live', evidenceIds: ['E1'], applied: true },
      },
      now,
    );
    expect(result.assistantActions).toHaveLength(1);
    const entry = JSON.parse(result.assistantActions[0] as string) as {
      type: string;
      mode: string;
      evidenceIds: string[];
      applied: boolean;
      requestedAt: number;
    };
    expect(entry).toEqual({
      type: 'DRAFT_REFINE',
      mode: 'live',
      evidenceIds: ['E1'],
      applied: true,
      requestedAt: now,
    });
  });
});
