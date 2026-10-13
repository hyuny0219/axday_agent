// domain/stance.ts: 임원 4명의 "지금 기울어 있는 쪽" 계산(T63). scripted는 표결
// 규칙표로 미리 계산하고, live는 transcript의 가장 최근 발언 stance를 그대로 쓴다.
// persuasionStamp의 3석 경계와 UNCAST 제외도 함께 확인한다.

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import { liveStances, membersAwaitingAnswer, persuasionStamp, scriptedStances } from '../../src/domain/stance';
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

// PR #13 Codex 3차 검토: voteRules의 조건 없음(always) 분기만으로 OPINIONS 표정을
// 계산하면, 두 안건의 문서가 명시한 CAIO의 첫 stance("미정")와 어긋났다(voteRules
// always 분기는 CAIO NO/AGAINST). initialOpinions[].openingStance를 참가자가 아직
// 말하지 않은 동안(OPINIONS·DISCUSS) 그대로 쓰고, 의견을 전달한 뒤(REACTIONS~)에는
// 조건이 그 rule을 충족하는 순간 voteRules 기반으로 넘어가 전환되는지 확인한다.
describe('scriptedStances의 OPINIONS 출발 성향(안건①·②, PR #13 Codex 3차 검토)', () => {
  const EXPECTED_OPENING = { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'UNDECIDED', CISO: 'AGAINST' } as const;

  it.each([
    ['ai-approval', aiApprovalScenario],
    ['experience-first', experienceFirstScenario],
  ] as const)('%s의 OPINIONS 표정은 CEO FOR·CFO AGAINST·CAIO UNDECIDED·CISO AGAINST다', (_label, s) => {
    expect(scriptedStances(s, sessionAt('OPINIONS', []))).toEqual(EXPECTED_OPENING);
  });

  it.each([
    ['ai-approval', aiApprovalScenario],
    ['experience-first', experienceFirstScenario],
  ] as const)('%s의 DISCUSS도 OPINIONS와 같은 출발 성향을 유지한다(아직 의견 제출 전)', (_label, s) => {
    expect(scriptedStances(s, sessionAt('DISCUSS', []))).toEqual(
      scriptedStances(s, sessionAt('OPINIONS', [])),
    );
  });

  it('ai-approval: CAIO의 rule을 만족하는 조건(LOG)을 전달하면 REACTIONS에서 FOR로 바뀐다', () => {
    const opinions = [opinion(['LOG'])];
    expect(scriptedStances(aiApprovalScenario, sessionAt('OPINIONS', [])).CAIO).toBe('UNDECIDED');
    expect(scriptedStances(aiApprovalScenario, sessionAt('REACTIONS', opinions)).CAIO).toBe('FOR');
  });

  it('experience-first: CAIO의 rule을 만족하는 조건(SCOPE)을 전달하면 REACTIONS에서 FOR로 바뀐다', () => {
    const opinions = [opinion(['SCOPE'])];
    expect(scriptedStances(experienceFirstScenario, sessionAt('OPINIONS', [])).CAIO).toBe('UNDECIDED');
    expect(scriptedStances(experienceFirstScenario, sessionAt('REACTIONS', opinions)).CAIO).toBe('FOR');
  });

  it('조건을 전달하지 않아도(빈 배열) opinions가 생기면 voteRules의 always 분기로 넘어간다(CAIO AGAINST)', () => {
    const opinions = [opinion([])];
    expect(scriptedStances(aiApprovalScenario, sessionAt('REACTIONS', opinions)).CAIO).toBe('AGAINST');
    expect(scriptedStances(experienceFirstScenario, sessionAt('REACTIONS', opinions)).CAIO).toBe(
      'AGAINST',
    );
  });
});

// T110: 조건이 맞아도 1차 반응(REACTIONS, 아직 답하지도 넘기지도 않음)에서는 "고민 중"까지만 움직이고,
// 추가 질문에 답하면(followUpAnswered) 찬성, 답하지 않고 넘어가면 표결과 같은 반대가 된다.
describe('scriptedStances의 두 단계 설득(T110)', () => {
  const ai = aiApprovalScenario;
  const forOpinion = (ids: string[]): Opinion => ({ ...opinion(ids), stance: 'FOR' });
  const againstOpinion = (ids: string[]): Opinion => ({ ...opinion(ids), stance: 'AGAINST' });
  const ALL = ['LIMIT', 'REVIEW', 'LOG', 'OWNER'];

  it('1차 반응: 조건이 모두 맞아도 CFO·CAIO·CISO는 고민 중이고 CEO는 처음부터 찬성이다', () => {
    const session = { stage: 'REACTIONS' as const, opinions: [forOpinion(ALL)], followUpUsed: false, followUpAnswered: false };
    expect(scriptedStances(ai, session)).toEqual({ CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' });
    expect(membersAwaitingAnswer(ai, session)).toEqual(['CFO', 'CAIO', 'CISO']);
  });

  it('조건이 모자라 원래 반대인 임원은 고민 중이 아니라 반대 그대로다', () => {
    const session = { stage: 'REACTIONS' as const, opinions: [forOpinion(['LOG'])], followUpUsed: false, followUpAnswered: false };
    expect(scriptedStances(ai, session)).toEqual({ CEO: 'FOR', CFO: 'AGAINST', CAIO: 'UNDECIDED', CISO: 'AGAINST' });
    expect(membersAwaitingAnswer(ai, session)).toEqual(['CAIO']);
  });

  it('답변을 전달한 뒤(MOTION)에는 조건이 맞은 임원이 모두 찬성이다', () => {
    const session = { stage: 'MOTION' as const, opinions: [forOpinion(ALL), forOpinion(ALL)], followUpUsed: true, followUpAnswered: true };
    expect(scriptedStances(ai, session)).toEqual({ CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' });
    expect(membersAwaitingAnswer(ai, session)).toEqual([]);
  });

  it('답하지 않고 넘어가면(MOTION·VOTE) 고민 중이던 임원은 반대로 확정된다', () => {
    const base = { opinions: [forOpinion(ALL)], followUpUsed: true, followUpAnswered: false };
    const expected = { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' };
    expect(scriptedStances(ai, { ...base, stage: 'MOTION' })).toEqual(expected);
    expect(scriptedStances(ai, { ...base, stage: 'VOTE' })).toEqual(expected);
  });

  it('반대 참가자(대칭): 조건으로 돌아설 CEO가 1차 반응에서는 고민 중, 답하면 반대, 넘어가면 찬성 그대로', () => {
    const opinions = [againstOpinion(['FULL_AUTO'])];
    expect(scriptedStances(ai, { stage: 'REACTIONS', opinions, followUpUsed: false, followUpAnswered: false }).CEO).toBe('UNDECIDED');
    expect(scriptedStances(ai, { stage: 'MOTION', opinions: [...opinions, ...opinions], followUpUsed: true, followUpAnswered: true }).CEO).toBe('AGAINST');
    expect(scriptedStances(ai, { stage: 'MOTION', opinions, followUpUsed: true, followUpAnswered: false }).CEO).toBe('FOR');
  });

  it('값을 생략하면 답을 이미 받은 것으로 본다(의견 단계·규칙표 확인용 호출)', () => {
    expect(scriptedStances(ai, { stage: 'REACTIONS', opinions: [forOpinion(ALL)] })).toEqual({
      CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR',
    });
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
