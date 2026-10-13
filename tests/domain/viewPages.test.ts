// domain/viewPages.ts: 지난 화면 보기(T126). 오갈 수 있는 화면 목록, 이전·다음 이동,
// 스냅숏이 세션을 건드리지 않고 봉인(T114·T118·T120)을 지키는지 확인한다.

import { describe, expect, it } from 'vitest';
import {
  currentPageOf,
  nextPageOf,
  pagesUpTo,
  prevPageOf,
  snapshotAt,
} from '../../src/domain/viewPages';
import { createInitialSession } from '../../src/domain/session';
import type { Opinion, Session, Statement } from '../../src/domain/types';

function opinion(id: string, stance: 'FOR' | 'AGAINST' = 'FOR'): Opinion {
  return { id, originalText: `의견 ${id}`, selectedPhraseIds: ['p1'], confirmedConditionIds: ['C1'], stance, createdAt: 1 };
}

function statement(roleId: Statement['roleId'], stage: Statement['stage']): Statement {
  return {
    id: `${roleId}-${stage}`,
    roleId,
    stage,
    text: `${roleId} ${stage}`,
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    stance: 'FOR',
    source: 'live',
    createdAt: 1,
  };
}

function session(partial: Partial<Session>): Session {
  return { ...createInitialSession(0, 's1'), scenarioId: 'anon-board', ...partial };
}

describe('currentPageOf', () => {
  it('BRIEFING부터 VOTE까지만 있고 RESULT·SELECT 이전은 null이다', () => {
    expect(currentPageOf({ stage: 'BRIEFING', opinions: [] }, 'listen')).toBe('BRIEFING');
    expect(currentPageOf({ stage: 'VOTE', opinions: [] }, 'listen')).toBe('VOTE');
    expect(currentPageOf({ stage: 'RESULT', opinions: [] }, 'listen')).toBeNull();
    expect(currentPageOf({ stage: 'SELECT', opinions: [] }, 'listen')).toBeNull();
    expect(currentPageOf({ stage: 'INTRO', opinions: [] }, 'listen')).toBeNull();
  });

  it('REACTIONS는 서브스텝으로 두 화면이다', () => {
    expect(currentPageOf({ stage: 'REACTIONS', opinions: [1] }, 'listen')).toBe('REACTIONS_LISTEN');
    expect(currentPageOf({ stage: 'REACTIONS', opinions: [1] }, 'answer')).toBe('REACTIONS_ANSWER');
  });
});

describe('이전·다음 이동', () => {
  it('BRIEFING(첫 화면)에서는 이전이 없다 — SELECT 이전으로 가지 않는다', () => {
    expect(prevPageOf('BRIEFING', null, 0)).toBeNull();
  });

  it('지금 화면에서 이전을 누르면 바로 앞 화면, 거기서 다음은 한 단계씩 앞으로 가다 지금 화면에서 끝난다', () => {
    expect(prevPageOf('DISCUSS', null, 1)).toBe('OPINIONS');
    expect(prevPageOf('DISCUSS', 'OPINIONS', 1)).toBe('BRIEFING');
    expect(nextPageOf('DISCUSS', 'BRIEFING', 1)).toBe('OPINIONS');
    expect(nextPageOf('DISCUSS', 'OPINIONS', 1)).toBe('CURRENT');
  });

  it('지금 화면(보기 모드 아님)에서는 다음이 비활성이다 — 건너뛰기 금지', () => {
    expect(nextPageOf('DISCUSS', null, 0)).toBeNull();
    expect(nextPageOf('VOTE', null, 2)).toBeNull();
  });

  it('답하지 않고 넘어갔다면(의견 1건) 다시 답하기 화면은 지난 화면에 끼지 않는다', () => {
    expect(pagesUpTo('MOTION', 1)).toEqual(['BRIEFING', 'OPINIONS', 'DISCUSS', 'REACTIONS_LISTEN', 'MOTION']);
    expect(pagesUpTo('MOTION', 2)).toContain('REACTIONS_ANSWER');
    expect(prevPageOf('MOTION', null, 1)).toBe('REACTIONS_LISTEN');
    expect(prevPageOf('MOTION', null, 2)).toBe('REACTIONS_ANSWER');
  });

  it('VOTE에서 이전은 MOTION이고, MOTION에서 다음은 지금 화면(VOTE)으로 돌아온다', () => {
    expect(prevPageOf('VOTE', null, 2)).toBe('MOTION');
    expect(nextPageOf('VOTE', 'MOTION', 2)).toBe('CURRENT');
  });
});

describe('snapshotAt', () => {
  const full = session({
    stage: 'VOTE',
    mode: 'live',
    opinions: [opinion('1'), opinion('2', 'AGAINST')],
    followUpUsed: true,
    followUpAnswered: true,
    finalMotion: { hash: 'h' } as unknown as Session['finalMotion'],
    ballots: [{ memberId: 'PARTICIPANT', vote: 'YES' } as unknown as Session['ballots'][number]],
    pendingVote: 'YES' as unknown as Session['pendingVote'],
    roleStatus: { CEO: 'answered', CFO: 'answered', CAIO: 'answered', CISO: 'answered' },
    transcript: {
      revision: 3,
      statements: [
        statement('CEO', 'OPINIONS'),
        statement('CFO', 'OPINIONS'),
        statement('CEO', 'REACTIONS'),
        statement('CEO', 'FOLLOWUP'),
      ],
    },
  });

  it('원본 세션을 바꾸지 않는다', () => {
    const before = JSON.stringify(full);
    snapshotAt(full, 'DISCUSS', []);
    snapshotAt(full, 'REACTIONS_LISTEN', []);
    expect(JSON.stringify(full)).toBe(before);
  });

  it('REACTIONS 화면은 첫 의견까지만, 첫 반응까지만 보인다(마지막 반응·표는 가린다)', () => {
    const view = snapshotAt(full, 'REACTIONS_LISTEN', []);
    expect(view.stage).toBe('REACTIONS');
    expect(view.opinions).toHaveLength(1);
    expect(view.followUpUsed).toBe(false);
    expect(view.transcript.statements.map((item) => item.stage)).not.toContain('FOLLOWUP');
    expect(view.finalMotion).toBeNull();
    expect(view.ballots).toEqual([]);
    expect(view.pendingVote).toBeNull();
  });

  it('DISCUSS 화면은 의견이 아직 없던 때의 모습이다', () => {
    const view = snapshotAt(full, 'DISCUSS', []);
    expect(view.stage).toBe('DISCUSS');
    expect(view.opinions).toEqual([]);
    expect(view.transcript.statements.every((item) => item.stage === 'OPINIONS')).toBe(true);
  });

  it('MOTION 화면은 표결 결과 없이 모든 의견과 후속 발언을 보인다', () => {
    const view = snapshotAt(full, 'MOTION', []);
    expect(view.stage).toBe('MOTION');
    expect(view.opinions).toHaveLength(2);
    expect(view.finalMotion).toBeNull();
  });

  it('live 임원 응답 상태는 그 화면 라운드 기록으로 되돌린다(발언 있음=answered, 없음=failed)', () => {
    const view = snapshotAt(full, 'OPINIONS', []);
    expect(view.roleStatus).toEqual({ CEO: 'answered', CFO: 'answered', CAIO: 'failed', CISO: 'failed' });
    const brief = snapshotAt(full, 'BRIEFING', []);
    expect(brief.roleStatus.CEO).toBe('idle');
  });

  it('scripted는 임원 응답 상태를 그대로 둔다', () => {
    const scripted = { ...full, mode: 'scripted' as const };
    expect(snapshotAt(scripted, 'OPINIONS', []).roleStatus).toEqual(scripted.roleStatus);
  });
});
