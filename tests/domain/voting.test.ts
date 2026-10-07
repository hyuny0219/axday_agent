import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import { computeMotionHash } from '../../src/domain/motion';
import {
  EXEC_MEMBER_ORDER,
  castParticipant,
  countVotesChangedByConditions,
  decideBoard,
  decideMember,
  evalPredicate,
  explainBoard,
  participantDecisive,
  tally,
  type TallyResult,
  type VoteContext,
} from '../../src/domain/voting';
import type { Ballot, Motion } from '../../src/domain/types';
import type { ExecMemberId, Vote } from '../../src/content/types';

const scenario = anonBoardScenario;
const allConditionIds = scenario.conditions.map((c) => c.id);

function isAllowedCombo(ids: readonly string[]): boolean {
  return scenario.conflicts.every(([a, b]) => !(ids.includes(a) && ids.includes(b)));
}

function powerset(ids: string[]): string[][] {
  return ids.reduce<string[][]>((acc, id) => acc.concat(acc.map((combo) => [...combo, id])), [
    [],
  ]);
}

const allowedCombos = powerset(allConditionIds).filter(isAllowedCombo);

function buildMotion(conditionIds: string[]): Motion {
  const id = 'motion-under-test';
  const text = scenario.originalMotion.text;
  const executionMode = 'DEFAULT';
  return {
    id,
    scenarioId: scenario.id,
    kind: conditionIds.length === 0 ? 'original' : 'amended',
    conditionIds,
    baseConditionIds: [],
    effectiveConditionIds: conditionIds,
    executionMode,
    frozenAt: 0,
    text,
    hash: computeMotionHash({ id, text, effectiveConditionIds: conditionIds, executionMode }),
  };
}

function withParticipant(boardBallots: Ballot[], motion: Motion, vote: Vote): Ballot[] {
  const participantBallot: Ballot = {
    memberId: 'PARTICIPANT',
    motionId: motion.id,
    motionHash: motion.hash,
    source: 'scripted',
    vote,
    confirmedAt: vote === 'UNCAST' ? null : 1,
  };
  return [...boardBallots, participantBallot];
}

const PARTICIPANT_VOTES: Vote[] = ['YES', 'NO', 'UNCAST'];

describe('허용 조건 조합 전수 (24개 × 참가자 3표)', () => {
  it('충돌쌍을 제외한 허용 조합이 24개다', () => {
    expect(allowedCombos.length).toBe(24);
  });

  it('규칙 총괄성·5석·ANON_FULL 부결·두 결론 도달·임원별 YES·NO 존재', () => {
    const outcomesSeen = new Set<TallyResult['outcome']>();
    const yesSeenByMember: Record<ExecMemberId, boolean> = {
      CEO: false,
      CFO: false,
      CAIO: false,
      CISO: false,
    };
    const noSeenByMember: Record<ExecMemberId, boolean> = {
      CEO: false,
      CFO: false,
      CAIO: false,
      CISO: false,
    };

    for (const combo of allowedCombos) {
      const motion = buildMotion(combo);
      // decideBoard가 던지지 않는 것 자체가 규칙 총괄성(모든 입력에 일치 행 존재) 검증이다.
      const boardBallots = decideBoard(scenario, motion);
      expect(boardBallots).toHaveLength(4);
      for (const memberId of EXEC_MEMBER_ORDER) {
        const ballot = boardBallots.find((b) => b.memberId === memberId);
        expect(ballot).toBeDefined();
        if (ballot && ballot.vote === 'YES') {
          yesSeenByMember[memberId] = true;
        }
        if (ballot && ballot.vote === 'NO') {
          noSeenByMember[memberId] = true;
        }
      }

      for (const participantVote of PARTICIPANT_VOTES) {
        const ballots = withParticipant(boardBallots, motion, participantVote);
        const result = tally(ballots);
        outcomesSeen.add(result.outcome);
        const totalSeats = result.counts.YES + result.counts.NO + result.counts.UNCAST;
        expect(totalSeats).toBe(5);
        if (combo.includes('ANON_FULL')) {
          expect(result.outcome).toBe('REJECT');
        }
      }
    }

    expect(outcomesSeen).toEqual(new Set(['PASS', 'REJECT']));
    for (const memberId of EXEC_MEMBER_ORDER) {
      expect(yesSeenByMember[memberId]).toBe(true);
      expect(noSeenByMember[memberId]).toBe(true);
    }
  });
});

interface RepresentativePathRow {
  label: string;
  conditionIds: string[];
  execVotes: [Vote, Vote, Vote, Vote]; // CEO, CFO, CAIO, CISO 순서
  participantVote: Vote;
  outcome: TallyResult['outcome'];
  counts: TallyResult['counts'];
}

// docs/SCENARIO_ANON_BOARD.md "표결 우선순위"(T62, 보류 제거 후 찬성·반대 두 표) 표를
// 그대로 옮긴다.
const REPRESENTATIVE_PATHS: RepresentativePathRow[] = [
  {
    label: 'PILOT,SCREEN,TRACE,MEASURE / YES,YES,YES,YES / 참가자 YES',
    conditionIds: ['PILOT', 'SCREEN', 'TRACE', 'MEASURE'],
    execVotes: ['YES', 'YES', 'YES', 'YES'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 5, NO: 0, UNCAST: 0 },
  },
  {
    label: 'PILOT,SCREEN,TRACE,MEASURE / YES,YES,YES,YES / 참가자 NO',
    conditionIds: ['PILOT', 'SCREEN', 'TRACE', 'MEASURE'],
    execVotes: ['YES', 'YES', 'YES', 'YES'],
    participantVote: 'NO',
    outcome: 'PASS',
    counts: { YES: 4, NO: 1, UNCAST: 0 },
  },
  {
    label: 'SCREEN,TRACE / YES,NO,YES,YES / 참가자 YES',
    conditionIds: ['SCREEN', 'TRACE'],
    execVotes: ['YES', 'NO', 'YES', 'YES'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 4, NO: 1, UNCAST: 0 },
  },
  {
    label: 'SCREEN,TRACE / YES,NO,YES,YES / 참가자 NO',
    conditionIds: ['SCREEN', 'TRACE'],
    execVotes: ['YES', 'NO', 'YES', 'YES'],
    participantVote: 'NO',
    outcome: 'PASS',
    counts: { YES: 3, NO: 2, UNCAST: 0 },
  },
  {
    label: '없음(원안) / YES,NO,NO,NO / 참가자 NO',
    conditionIds: [],
    execVotes: ['YES', 'NO', 'NO', 'NO'],
    participantVote: 'NO',
    outcome: 'REJECT',
    counts: { YES: 1, NO: 4, UNCAST: 0 },
  },
  {
    label: '없음(원안) / YES,NO,NO,NO / 참가자 YES',
    conditionIds: [],
    execVotes: ['YES', 'NO', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'REJECT',
    counts: { YES: 2, NO: 3, UNCAST: 0 },
  },
  {
    label: 'ANON_FULL / NO,NO,NO,NO / 참가자 YES',
    conditionIds: ['ANON_FULL'],
    execVotes: ['NO', 'NO', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'REJECT',
    counts: { YES: 1, NO: 4, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 YES',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 3, NO: 2, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 NO',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'NO',
    outcome: 'REJECT',
    counts: { YES: 2, NO: 3, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 UNCAST',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'UNCAST',
    outcome: 'REJECT',
    counts: { YES: 2, NO: 2, UNCAST: 1 },
  },
  {
    label: '없음(원안) / YES,NO,NO,NO / 참가자 UNCAST',
    conditionIds: [],
    execVotes: ['YES', 'NO', 'NO', 'NO'],
    participantVote: 'UNCAST',
    outcome: 'REJECT',
    counts: { YES: 1, NO: 3, UNCAST: 1 },
  },
];

describe('문서 대표 경로표 — T62 (11행)', () => {
  it('테스트 케이스 수가 문서 표 행 수와 같다', () => {
    expect(REPRESENTATIVE_PATHS.length).toBe(11);
  });

  it.each(REPRESENTATIVE_PATHS)(
    '$label → 임원 표·결론이 문서와 일치한다',
    ({ conditionIds, execVotes, participantVote, outcome, counts }) => {
      const motion = buildMotion(conditionIds);
      const boardBallots = decideBoard(scenario, motion);
      const actualExecVotes = EXEC_MEMBER_ORDER.map(
        (memberId) => boardBallots.find((b) => b.memberId === memberId)?.vote,
      );
      expect(actualExecVotes).toEqual(execVotes);

      const ballots = withParticipant(boardBallots, motion, participantVote);
      const result = tally(ballots);
      expect(result.outcome).toBe(outcome);
      expect(result.counts).toEqual(counts);
    },
  );
});

describe('countVotesChangedByConditions — 내 조건이 바꾼 표 게이지(T43)', () => {
  it('원안(조건 없음)과 비교하므로 원안 자체는 0명이 바뀐다', () => {
    const motion = buildMotion([]);
    expect(countVotesChangedByConditions(scenario, motion)).toBe(0);
  });

  it('PILOT,MEASURE는 문서 표 기준 CFO 1명만 바뀐다(NO→YES)', () => {
    const motion = buildMotion(['PILOT', 'MEASURE']);
    expect(countVotesChangedByConditions(scenario, motion)).toBe(1);
  });

  it('SCREEN,TRACE는 문서 표 기준 CAIO·CISO 2명이 바뀐다(NO→YES)', () => {
    const motion = buildMotion(['SCREEN', 'TRACE']);
    expect(countVotesChangedByConditions(scenario, motion)).toBe(2);
  });

  it('PILOT,SCREEN,TRACE,MEASURE는 문서 표 기준 CFO·CAIO·CISO 3명이 바뀐다', () => {
    const motion = buildMotion(['PILOT', 'SCREEN', 'TRACE', 'MEASURE']);
    expect(countVotesChangedByConditions(scenario, motion)).toBe(3);
  });

  it('4명을 넘길 수 없다(임원은 4명뿐)', () => {
    for (const combo of allowedCombos) {
      const motion = buildMotion(combo);
      expect(countVotesChangedByConditions(scenario, motion)).toBeLessThanOrEqual(4);
    }
  });
});

describe('explainBoard — 이사회 한 장 요약의 임원별 이유·바뀐 표(T48)', () => {
  it('4조건(PILOT,SCREEN,TRACE,MEASURE): 임원 표는 전원 YES, CFO·CAIO·CISO만 바뀐다', () => {
    const motion = buildMotion(['PILOT', 'SCREEN', 'TRACE', 'MEASURE']);
    const rows = explainBoard(scenario, motion);
    expect(rows.map((r) => r.vote)).toEqual(['YES', 'YES', 'YES', 'YES']);
    expect(rows.map((r) => r.changed)).toEqual([false, true, true, true]);
    expect(rows.every((r) => typeof r.reason === 'string' && r.reason!.length > 0)).toBe(true);
    expect(rows.find((r) => r.memberId === 'CFO')?.reason).toBe(
      '한 게시판에서 시범과 운영 효과 측정 후 확대 조건이 있어 찬성',
    );
  });

  it('PILOT,MEASURE: 임원 표는 YES,YES,NO,NO이고 CFO만 바뀐다', () => {
    const motion = buildMotion(['PILOT', 'MEASURE']);
    const rows = explainBoard(scenario, motion);
    expect(rows.map((r) => r.vote)).toEqual(['YES', 'YES', 'NO', 'NO']);
    expect(rows.map((r) => r.changed)).toEqual([false, true, false, false]);
  });

  it('조건 없음(원안): 자기 자신과 비교하므로 아무도 바뀌지 않는다', () => {
    const motion = buildMotion([]);
    const rows = explainBoard(scenario, motion);
    expect(rows.map((r) => r.vote)).toEqual(['YES', 'NO', 'NO', 'NO']);
    expect(rows.every((r) => !r.changed)).toBe(true);
  });

  it('ANON_FULL: CEO만 바뀌고 CFO·CAIO·CISO는 원안과 같은 NO라 바뀌지 않는다', () => {
    const motion = buildMotion(['ANON_FULL']);
    const rows = explainBoard(scenario, motion);
    expect(rows.map((r) => r.vote)).toEqual(['NO', 'NO', 'NO', 'NO']);
    expect(rows.map((r) => r.changed)).toEqual([true, false, false, false]);
    expect(rows.every((r) => r.reason?.includes('완전 익명 — 추적 불가'))).toBe(true);
  });
});

describe('participantDecisive — 내 표의 결정력(T48)', () => {
  it('PILOT,MEASURE + 참가자 YES: 대안 표에 따라 결론이 갈려 결정적이다', () => {
    const motion = buildMotion(['PILOT', 'MEASURE']);
    const boardBallots = decideBoard(scenario, motion);
    const ballots = withParticipant(boardBallots, motion, 'YES');
    expect(participantDecisive(ballots)).toBe(true);
  });

  it('4조건 + 참가자 NO: 임원만으로 이미 가결이라 결정적이지 않다', () => {
    const motion = buildMotion(['PILOT', 'SCREEN', 'TRACE', 'MEASURE']);
    const boardBallots = decideBoard(scenario, motion);
    const ballots = withParticipant(boardBallots, motion, 'NO');
    expect(participantDecisive(ballots)).toBe(false);
  });

  it('PILOT,MEASURE + 참가자 UNCAST: UNCAST를 포함한 대안 중 다른 결론이 있어 결정적이다', () => {
    const motion = buildMotion(['PILOT', 'MEASURE']);
    const boardBallots = decideBoard(scenario, motion);
    const ballots = withParticipant(boardBallots, motion, 'UNCAST');
    expect(tally(ballots).outcome).toBe('REJECT');
    expect(participantDecisive(ballots)).toBe(true);
  });
});

describe('차단 규칙', () => {
  const conditionIds = ['PILOT', 'MEASURE'];
  const motion = buildMotion(conditionIds);
  const boardBallots = decideBoard(scenario, motion);

  it('의석이 5석이 아니면 tally가 던진다', () => {
    expect(() => tally(boardBallots)).toThrow();
  });

  it('최종 안건 ID가 없는 투표는 차단한다', () => {
    expect(() => castParticipant(boardBallots, { ...motion, id: '' }, 'YES', 'scripted')).toThrow();
  });

  it('잘못된 안건 ID에 대한 투표는 차단한다', () => {
    expect(() =>
      castParticipant(boardBallots, { ...motion, id: 'other-motion-id' }, 'YES', 'scripted'),
    ).toThrow();
  });

  it('정상 투표는 5석을 완성한다', () => {
    const ballots = castParticipant(boardBallots, motion, 'YES', 'scripted');
    expect(ballots).toHaveLength(5);
  });

  it('중복 의석·확정 후 재투표는 차단한다', () => {
    const ballots = castParticipant(boardBallots, motion, 'YES', 'scripted');
    expect(() => castParticipant(ballots, motion, 'NO', 'scripted')).toThrow();
  });
});

// T92: 참가자 입장(participantStance) predicate. 사용자 지적 "AI 임원들이 찬성 쪽으로
// 몰고 가는 경향"을 scripted 엔진 쪽에서 회귀로 고정한다.
describe('participantStance predicate(T92)', () => {
  const baseCtx: VoteContext = { conditionIds: [], executionMode: 'DEFAULT' };

  it('participantStance를 생략하면 null과 같다', () => {
    expect(evalPredicate({ participantStance: null }, baseCtx)).toBe(true);
    expect(evalPredicate({ participantStance: 'AGAINST' }, baseCtx)).toBe(false);
  });

  it('participantStance가 일치하는 값만 true', () => {
    const against: VoteContext = { ...baseCtx, participantStance: 'AGAINST' };
    expect(evalPredicate({ participantStance: 'AGAINST' }, against)).toBe(true);
    expect(evalPredicate({ participantStance: 'FOR' }, against)).toBe(false);
    expect(evalPredicate({ participantStance: null }, against)).toBe(false);
  });

  it('decideMember가 participantStance 조합 규칙을 평가할 수 있다', () => {
    const rules = [
      { when: { participantStance: 'AGAINST' as const }, vote: 'NO' as const },
      { when: { always: true as const }, vote: 'YES' as const },
    ];
    expect(decideMember(rules, { ...baseCtx, participantStance: 'AGAINST' })).toBe('NO');
    expect(decideMember(rules, { ...baseCtx, participantStance: 'FOR' })).toBe('YES');
    expect(decideMember(rules, baseCtx)).toBe('YES');
  });
});

// T92: 두 활성 안건(①②)의 기존 voteRules가 참가자 반대 입장에서도 "조건이 붙어 있다는
// 사실만으로" 찬성으로 몰리지 않는지(사용자 지적) decideBoard로 확인한다. CFO·CAIO·CISO
// 기본값이 모두 NO라 순수 반대(조건 없음)·단일 조건 조건부 반대 모두 과반 YES에
// 못 미쳐야 한다(참가자 자신의 표까지 더하면 REJECT).
describe('반대 입장 경로의 표 분포(T92, 안건①②)', () => {
  function voteCounts(scenario: typeof aiApprovalScenario, conditionIds: string[]) {
    const id = 'motion-under-test';
    const text = scenario.originalMotion.text;
    const executionMode = 'DEFAULT';
    const motion: Motion = {
      id,
      scenarioId: scenario.id,
      kind: conditionIds.length === 0 ? 'original' : 'amended',
      conditionIds,
      baseConditionIds: [],
      effectiveConditionIds: conditionIds,
      executionMode,
      frozenAt: 0,
      text,
      hash: computeMotionHash({ id, text, effectiveConditionIds: conditionIds, executionMode }),
    };
    const ballots = decideBoard(scenario, motion, 'AGAINST');
    return ballots.filter((b) => b.vote === 'YES').length;
  }

  it('안건① 순수 반대(조건 없음)는 YES가 1명(CEO)뿐이라 참가자 NO까지 더하면 부결', () => {
    expect(voteCounts(aiApprovalScenario, [])).toBe(1);
  });

  it('안건① 조건부 반대(REVIEW 1개만)도 YES 과반에 못 미친다', () => {
    expect(voteCounts(aiApprovalScenario, ['REVIEW'])).toBeLessThan(3);
  });

  it('안건② 순수 반대(조건 없음)는 YES가 1명(CEO)뿐이라 참가자 NO까지 더하면 부결', () => {
    expect(voteCounts(experienceFirstScenario, [])).toBe(1);
  });

  it('안건② 조건부 반대(RECORD 1개만)도 YES 과반에 못 미친다', () => {
    expect(voteCounts(experienceFirstScenario, ['RECORD'])).toBeLessThan(3);
  });
});
