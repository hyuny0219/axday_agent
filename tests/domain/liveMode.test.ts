// live 모드 전용 회의 기록·임원표 흐름(T26). AGENT_BOARDROOM_SPEC.md 3·5·6장:
// 임원표는 RECORD_EXEC_BALLOT으로 하나씩 도착하고, motionHash 불일치·중복 역할·결과
// 확정 후 늦은 표는 조용히 무시한다(warnings만 남긴다). FINALIZE_RESULT는 미도착
// 임원을 UNCAST로 채우고 그 자리에서 집계를 확정한다. scripted 모드(기본값)는 이
// 카드로 인해 기존 흐름·결과가 달라지지 않는다.

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Ballot, Session, Statement } from '../../src/domain/types';
import { EXEC_MEMBER_ORDER, tally } from '../../src/domain/voting';
import type { ExecMemberId, Vote } from '../../src/content/types';

const scenario = anonBoardScenario;
const T0 = 1_700_000_000_000;

/** ATTRACT부터 live 모드 VOTE 단계(임원표 없음, roleStatus pending)까지 진행한다. */
function sessionAtLiveVote(now = T0, confirmedConditionIds: string[] = []): Session {
  let session = createInitialSession(now);
  session = reduce(session, { type: 'SET_MODE', mode: 'live' }, now);
  session = reduce(session, { type: 'START' }, now);
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, now);
  session = reduce(session, { type: 'NEXT_STAGE' }, now); // BRIEFING -> OPINIONS
  session = reduce(session, { type: 'NEXT_STAGE' }, now); // OPINIONS -> DISCUSS
  session = reduce(
    session,
    {
      type: 'SUBMIT_OPINION',
      originalText: '작은 범위로 먼저 시작합시다.',
      selectedPhraseIds: ['P1'],
      confirmedConditionIds,
    },
    now,
  ); // DISCUSS -> REACTIONS
  session = reduce(session, { type: 'KEEP_PREVIOUS' }, now); // REACTIONS -> MOTION
  session = reduce(session, { type: 'FREEZE_MOTION', scenario, confirmedConditionIds }, now); // MOTION -> VOTE (live: ballots 비어 있음)
  return session;
}

function execBallot(session: Session, memberId: ExecMemberId, vote: Vote, now = T0): Ballot {
  return {
    memberId,
    motionId: session.finalMotion!.id,
    motionHash: session.finalMotion!.hash,
    source: 'live',
    vote,
    reason: '판단 근거 요약',
    confirmedAt: now,
  };
}

/** memberId → vote 매핑을 EXEC_MEMBER_ORDER 순서대로 하나씩 RECORD_EXEC_BALLOT으로 반영한다. */
function recordExecBallots(session: Session, votes: Record<ExecMemberId, Vote>): Session {
  let next = session;
  for (const memberId of EXEC_MEMBER_ORDER) {
    next = reduce(
      next,
      { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(next, memberId, votes[memberId]) },
      T0,
    );
  }
  return next;
}

describe('live 모드 FREEZE_MOTION', () => {
  it('임원표를 비워 두고 roleStatus를 pending으로 둔다', () => {
    const session = sessionAtLiveVote();
    expect(session.mode).toBe('live');
    expect(session.stage).toBe('VOTE');
    expect(session.ballots).toHaveLength(0);
    expect(session.execBallotsPending).toBe(true);
    expect(session.roleStatus).toEqual({
      CEO: 'pending',
      CFO: 'pending',
      CAIO: 'pending',
      CISO: 'pending',
    });
  });
});

describe('live 모드 정상 4표 집계', () => {
  it('임원 4표가 모두 도착한 뒤 참가자가 확정하면 즉시 5석을 집계한다', () => {
    let session = sessionAtLiveVote();
    session = recordExecBallots(session, {
      CEO: 'YES',
      CFO: 'YES',
      CAIO: 'YES',
      CISO: 'HOLD',
    });
    expect(session.execBallotsPending).toBe(false);
    expect(session.ballots).toHaveLength(4);

    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);

    expect(session.stage).toBe('RESULT');
    expect(session.ballots).toHaveLength(5);
    const result = tally(session.ballots);
    expect(result.limitedByUnavailable).toBe(false);
    expect(session.outcome).toBe(result.outcome);
    expect(session.outcome).toBe('PASS');
  });

  it('참가자가 먼저 확정해도 4표가 이미 있으면 즉시 집계한다', () => {
    let session = sessionAtLiveVote();
    session = recordExecBallots(session, { CEO: 'YES', CFO: 'YES', CAIO: 'YES', CISO: 'YES' });
    session = reduce(session, { type: 'SELECT_VOTE', vote: 'NO' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);
    expect(session.stage).toBe('RESULT');
    expect(session.ballots).toHaveLength(5);
  });
});

describe('live 모드 미도착 임원 → FINALIZE_RESULT', () => {
  it('참가자가 먼저 확정해도 임원표가 부족하면 VOTE에 머무른다', () => {
    let session = sessionAtLiveVote();
    session = reduce(
      session,
      { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, 'CEO', 'YES') },
      T0,
    );
    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);

    expect(session.stage).toBe('VOTE');
    expect(session.outcome).toBeNull();
    expect(session.ballots.some((b) => b.memberId === 'PARTICIPANT')).toBe(true);
    expect(session.ballots).toHaveLength(2);
  });

  it('임원 한 명이 끝내 응답하지 않으면 FINALIZE_RESULT가 UNCAST로 채우고 limited 플래그를 세운다', () => {
    let session = sessionAtLiveVote();
    const missingRole: ExecMemberId = 'CISO';
    for (const memberId of EXEC_MEMBER_ORDER.filter((id) => id !== missingRole)) {
      session = reduce(
        session,
        { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, memberId, 'YES') },
        T0,
      );
    }
    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);
    expect(session.stage).toBe('VOTE');

    session = reduce(session, { type: 'FINALIZE_RESULT' }, T0 + 8_000);
    expect(session.stage).toBe('RESULT');
    expect(session.ballots).toHaveLength(5);

    const missingBallot = session.ballots.find((b) => b.memberId === missingRole);
    expect(missingBallot?.vote).toBe('UNCAST');
    expect(missingBallot?.source).toBe('unavailable');
    expect(missingBallot?.unavailableReason).toBeTruthy();

    const result = tally(session.ballots);
    expect(result.limitedByUnavailable).toBe(true);
    expect(session.outcome).toBe(result.outcome);
  });
});

describe('motionHash 불일치 표 거부', () => {
  it('안건 해시가 다른 임원 표는 반영하지 않는다', () => {
    const session = sessionAtLiveVote();
    const badBallot: Ballot = { ...execBallot(session, 'CEO', 'YES'), motionHash: 'wrong-hash' };
    const result = reduce(session, { type: 'RECORD_EXEC_BALLOT', ballot: badBallot }, T0);
    expect(result.ballots).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('중복 역할 표 거부', () => {
  it('이미 기록된 역할의 두 번째 표는 반영하지 않는다', () => {
    let session = sessionAtLiveVote();
    session = reduce(
      session,
      { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, 'CEO', 'YES') },
      T0,
    );
    const result = reduce(
      session,
      { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, 'CEO', 'NO') },
      T0,
    );
    expect(result.ballots).toHaveLength(1);
    expect(result.ballots[0]?.vote).toBe('YES');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('결과 확정 후 늦은 표 무시', () => {
  it('RESULT로 넘어간 뒤 도착한 임원 표는 결과를 바꾸지 못한다', () => {
    let session = sessionAtLiveVote();
    EXEC_MEMBER_ORDER.forEach((memberId) => {
      session = reduce(
        session,
        { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, memberId, 'YES') },
        T0,
      );
    });
    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);
    expect(session.stage).toBe('RESULT');
    const before = session.ballots;
    const beforeOutcome = session.outcome;

    const late = reduce(
      session,
      { type: 'RECORD_EXEC_BALLOT', ballot: execBallot(session, 'CEO', 'NO') },
      T0 + 1,
    );
    expect(late.ballots).toEqual(before);
    expect(late.outcome).toBe(beforeOutcome);
    expect(late.warnings.length).toBeGreaterThan(0);
  });
});

describe('APPEND_STATEMENTS revision 검사', () => {
  const statement: Statement = {
    id: 'stmt-1',
    roleId: 'CEO',
    stage: 'OPINIONS',
    text: '초기 의견',
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'live',
    createdAt: T0,
  };

  it('baseRevision이 현재 revision과 다르면 무시한다', () => {
    const session = sessionAtLiveVote();
    const result = reduce(
      session,
      { type: 'APPEND_STATEMENTS', stage: 'OPINIONS', statements: [statement], baseRevision: 5 },
      T0,
    );
    expect(result.transcript).toEqual(session.transcript);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('baseRevision이 일치하면 발언을 추가하고 revision을 올린다', () => {
    const session = sessionAtLiveVote();
    const result = reduce(
      session,
      {
        type: 'APPEND_STATEMENTS',
        stage: 'OPINIONS',
        statements: [statement],
        baseRevision: session.transcript.revision,
      },
      T0,
    );
    expect(result.transcript.revision).toBe(session.transcript.revision + 1);
    expect(result.transcript.statements).toEqual([statement]);
    expect(result.warnings).toEqual([]);
  });
});

describe('scripted 모드 결과가 기존과 동일', () => {
  it('mode를 지정하지 않으면 기본값 scripted로 기존과 동일한 표결 흐름을 낸다', () => {
    let session = createInitialSession(T0);
    expect(session.mode).toBe('scripted');
    session = reduce(session, { type: 'START' }, T0);
    session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, T0);
    session = reduce(session, { type: 'NEXT_STAGE' }, T0);
    session = reduce(session, { type: 'NEXT_STAGE' }, T0);
    session = reduce(
      session,
      {
        type: 'SUBMIT_OPINION',
        originalText: '작은 범위로 먼저 시작합시다.',
        selectedPhraseIds: ['P1'],
        confirmedConditionIds: [],
      },
      T0,
    );
    session = reduce(session, { type: 'KEEP_PREVIOUS' }, T0);
    session = reduce(session, { type: 'FREEZE_MOTION', scenario, confirmedConditionIds: [] }, T0);
    expect(session.ballots).toHaveLength(4);
    expect(session.execBallotsPending).toBe(false);

    session = reduce(session, { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    session = reduce(session, { type: 'CONFIRM_VOTE' }, T0);

    expect(session.stage).toBe('RESULT');
    expect(session.ballots).toHaveLength(5);
    // 대표 경로표: 없음(원안) / YES,HOLD,NO,NO / 참가자 YES → HOLD. (session.test.ts와 동일)
    expect(session.outcome).toBe('HOLD');
    expect(tally(session.ballots).limitedByUnavailable).toBe(false);
  });
});

describe('끝난 세션에는 발언을 붙이지 않는다', () => {
  it('RESULT 단계에서 온 APPEND_STATEMENTS는 무시하고 경고만 남긴다', () => {
    let session = sessionAtLiveVote(T0);
    session = reduce(session, { type: 'FINALIZE_RESULT' }, T0 + 8_000);
    expect(session.stage).toBe('RESULT');
    const revision = session.transcript.revision;
    const late: Statement = {
      id: 'st-after-result',
      roleId: 'CEO',
      stage: 'FOLLOWUP',
      text: '너무 늦은 발언',
      evidenceIds: [],
      referencedStatementIds: [],
      concerns: [],
      suggestedConditionIds: [],
      source: 'live',
      createdAt: T0 + 241_000,
    };
    const next = reduce(
      session,
      { type: 'APPEND_STATEMENTS', stage: 'FOLLOWUP', statements: [late], baseRevision: revision },
      T0 + 241_000,
    );
    expect(next.transcript.statements).toHaveLength(session.transcript.statements.length);
    expect(next.transcript.revision).toBe(revision);
    expect(next.warnings.length).toBeGreaterThan(0);
  });
});
