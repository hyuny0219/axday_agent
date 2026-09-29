// domain/stance.ts: 임원 4명의 "지금 기울어 있는 쪽" 계산(T63). scripted는 표결
// 규칙표로 미리 계산하고, live는 transcript의 가장 최근 발언 stance를 그대로 쓴다.
// persuasionStamp의 3석 경계와 UNCAST 제외도 함께 확인한다.

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { liveStances, persuasionStamp, scriptedStances } from '../../src/domain/stance';
import type { Ballot, Opinion, Session, Statement } from '../../src/domain/types';

const scenario = anonBoardScenario;

function opinion(confirmedConditionIds: string[]): Opinion {
  return {
    id: 'op-1',
    originalText: '검토했습니다.',
    selectedPhraseIds: [],
    confirmedConditionIds,
    createdAt: 0,
  };
}

function sessionAt(
  stage: Session['stage'],
  opinions: Opinion[] = [],
): Pick<Session, 'stage' | 'opinions'> {
  return { stage, opinions };
}

describe('scriptedStances', () => {
  it('BRIEFING(과 그 이전)은 조건과 무관하게 넷 다 UNDECIDED다', () => {
    const stances = scriptedStances(scenario, sessionAt('BRIEFING', [opinion(['ANON_FULL'])]));
    expect(stances).toEqual({ CEO: 'UNDECIDED', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' });
  });

  it('OPINIONS 진입 시(아직 의견 없음) 조건 없는 표결 규칙표로 넷을 함께 계산한다', () => {
    const stances = scriptedStances(scenario, sessionAt('OPINIONS', []));
    expect(stances).toEqual({ CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' });
  });

  it('DISCUSS는 OPINIONS와 같은 값으로 유지된다(아직 의견 제출 전)', () => {
    const opinionsStances = scriptedStances(scenario, sessionAt('OPINIONS', []));
    const discussStances = scriptedStances(scenario, sessionAt('DISCUSS', []));
    expect(discussStances).toEqual(opinionsStances);
  });

  it('REACTIONS는 확정 조건을 반영해 갱신한다(조건 보완 경로 → 전원 FOR로 전환)', () => {
    const stances = scriptedStances(
      scenario,
      sessionAt('REACTIONS', [opinion(['PILOT', 'MEASURE', 'SCREEN', 'TRACE'])]),
    );
    expect(stances).toEqual({ CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' });
  });

  it('완전 익명(ANON_FULL) 확정이면 전원 AGAINST다', () => {
    const stances = scriptedStances(scenario, sessionAt('REACTIONS', [opinion(['ANON_FULL'])]));
    expect(stances).toEqual({ CEO: 'AGAINST', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' });
  });

  it('MOTION·VOTE는 마지막 확정 집합으로 고정된다(REACTIONS와 같은 값)', () => {
    const opinions = [opinion(['PILOT', 'MEASURE', 'SCREEN', 'TRACE'])];
    const reactionsStances = scriptedStances(scenario, sessionAt('REACTIONS', opinions));
    expect(scriptedStances(scenario, sessionAt('MOTION', opinions))).toEqual(reactionsStances);
    expect(scriptedStances(scenario, sessionAt('VOTE', opinions))).toEqual(reactionsStances);
  });

  it('후속 보완이 조건을 해제하면(합집합이 아니라 마지막 의견 기준) 그 조건은 되살아나지 않는다', () => {
    const opinions = [opinion(['PILOT', 'MEASURE', 'SCREEN', 'TRACE']), opinion(['PILOT'])];
    const stances = scriptedStances(scenario, sessionAt('REACTIONS', opinions));
    // SCREEN·TRACE·MEASURE가 해제된 두 번째 의견 기준으로 CAIO(SCREEN 필요)·CISO(TRACE+SCREEN
    // 필요)는 다시 AGAINST로 돌아간다.
    expect(stances.CAIO).toBe('AGAINST');
    expect(stances.CISO).toBe('AGAINST');
  });
});

function statement(roleId: Statement['roleId'], stance: Statement['stance']): Statement {
  return {
    id: `st-${roleId}-${Math.random()}`,
    roleId,
    stage: 'OPINIONS',
    text: '발언',
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    stance,
    source: 'live',
    createdAt: 0,
  };
}

describe('liveStances', () => {
  it('발언이 아직 없는 임원은 UNDECIDED다', () => {
    const stances = liveStances({ transcript: { revision: 0, statements: [] } });
    expect(stances).toEqual({ CEO: 'UNDECIDED', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' });
  });

  it('가장 최근 발언의 stance를 쓴다(같은 임원의 이전 발언은 무시)', () => {
    const stances = liveStances({
      transcript: {
        revision: 2,
        statements: [statement('CEO', 'AGAINST'), statement('CEO', 'FOR')],
      },
    });
    expect(stances.CEO).toBe('FOR');
  });

  it('응답 실패로 새 발언이 기록되지 않으면 직전 발언의 stance가 그대로 남는다', () => {
    // OPINIONS에서 FOR를 낸 뒤 REACTIONS 라운드가 실패하면(새 Statement 없음) 그대로 FOR.
    const stances = liveStances({
      transcript: { revision: 1, statements: [statement('CFO', 'FOR')] },
    });
    expect(stances.CFO).toBe('FOR');
  });
});

function ballot(memberId: Ballot['memberId'], vote: Ballot['vote']): Ballot {
  return {
    memberId,
    motionId: 'm1',
    motionHash: 'h1',
    vote,
    confirmedAt: 1,
    source: memberId === 'PARTICIPANT' ? 'scripted' : 'scripted',
  };
}

describe('persuasionStamp', () => {
  it('2석(경계 미달)이면 도장을 얻지 못한다', () => {
    const ballots: Ballot[] = [
      ballot('CEO', 'NO'),
      ballot('CFO', 'YES'),
      ballot('CAIO', 'YES'),
      ballot('CISO', 'YES'),
      ballot('PARTICIPANT', 'NO'),
    ];
    const result = persuasionStamp(ballots, 'NO');
    expect(result).toEqual({ earned: false, sameVoteSeats: 2 });
  });

  it('3석(경계 충족, 참가자 포함)이면 도장을 얻는다', () => {
    const ballots: Ballot[] = [
      ballot('CEO', 'YES'),
      ballot('CFO', 'YES'),
      ballot('CAIO', 'NO'),
      ballot('CISO', 'NO'),
      ballot('PARTICIPANT', 'YES'),
    ];
    const result = persuasionStamp(ballots, 'YES');
    expect(result).toEqual({ earned: true, sameVoteSeats: 3 });
  });

  it('UNCAST는 세지 않는다', () => {
    const ballots: Ballot[] = [
      ballot('CEO', 'YES'),
      ballot('CFO', 'UNCAST'),
      ballot('CAIO', 'UNCAST'),
      ballot('CISO', 'YES'),
      ballot('PARTICIPANT', 'YES'),
    ];
    const result = persuasionStamp(ballots, 'YES');
    expect(result).toEqual({ earned: true, sameVoteSeats: 3 });
  });
});
