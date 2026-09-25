import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { computeMotionHash } from '../../src/domain/motion';
import {
  EXEC_MEMBER_ORDER,
  castParticipant,
  countVotesChangedByConditions,
  decideBoard,
  explainBoard,
  participantDecisive,
  tally,
  type TallyResult,
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

const PARTICIPANT_VOTES: Vote[] = ['YES', 'HOLD', 'NO', 'UNCAST'];

describe('허용 조건 조합 전수 (24개 × 참가자 4표)', () => {
  it('충돌쌍을 제외한 허용 조합이 24개다', () => {
    expect(allowedCombos.length).toBe(24);
  });

  it('규칙 총괄성·5석·ANON_FULL 부결·세 결론 도달·임원별 YES 존재', () => {
    const outcomesSeen = new Set<TallyResult['outcome']>();
    const yesSeenByMember: Record<ExecMemberId, boolean> = {
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
      }

      for (const participantVote of PARTICIPANT_VOTES) {
        const ballots = withParticipant(boardBallots, motion, participantVote);
        const result = tally(ballots);
        outcomesSeen.add(result.outcome);
        const totalSeats =
          result.counts.YES + result.counts.NO + result.counts.HOLD + result.counts.UNCAST;
        expect(totalSeats).toBe(5);
        if (combo.includes('ANON_FULL')) {
          expect(result.outcome).toBe('REJECT');
        }
      }
    }

    expect(outcomesSeen).toEqual(new Set(['PASS', 'HOLD', 'REJECT']));
    for (const memberId of EXEC_MEMBER_ORDER) {
      expect(yesSeenByMember[memberId]).toBe(true);
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

// docs/SCENARIO_AI_ASSISTANT.md "대표 경로 — v0.6" 표를 그대로 옮긴다.
const REPRESENTATIVE_PATHS: RepresentativePathRow[] = [
  {
    label: 'PILOT,SCREEN,TRACE,MEASURE / YES,YES,YES,YES / 참가자 YES',
    conditionIds: ['PILOT', 'SCREEN', 'TRACE', 'MEASURE'],
    execVotes: ['YES', 'YES', 'YES', 'YES'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 5, NO: 0, HOLD: 0, UNCAST: 0 },
  },
  {
    label: 'PILOT,SCREEN,TRACE,MEASURE / YES,YES,YES,YES / 참가자 NO',
    conditionIds: ['PILOT', 'SCREEN', 'TRACE', 'MEASURE'],
    execVotes: ['YES', 'YES', 'YES', 'YES'],
    participantVote: 'NO',
    outcome: 'PASS',
    counts: { YES: 4, NO: 1, HOLD: 0, UNCAST: 0 },
  },
  {
    label: 'SCREEN,TRACE / YES,HOLD,YES,YES / 참가자 YES',
    conditionIds: ['SCREEN', 'TRACE'],
    execVotes: ['YES', 'HOLD', 'YES', 'YES'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 4, NO: 0, HOLD: 1, UNCAST: 0 },
  },
  {
    label: 'SCREEN,TRACE / YES,HOLD,YES,YES / 참가자 HOLD',
    conditionIds: ['SCREEN', 'TRACE'],
    execVotes: ['YES', 'HOLD', 'YES', 'YES'],
    participantVote: 'HOLD',
    outcome: 'PASS',
    counts: { YES: 3, NO: 0, HOLD: 2, UNCAST: 0 },
  },
  {
    label: '없음(원안) / YES,HOLD,NO,NO / 참가자 NO',
    conditionIds: [],
    execVotes: ['YES', 'HOLD', 'NO', 'NO'],
    participantVote: 'NO',
    outcome: 'REJECT',
    counts: { YES: 1, NO: 3, HOLD: 1, UNCAST: 0 },
  },
  {
    label: '없음(원안) / YES,HOLD,NO,NO / 참가자 YES',
    conditionIds: [],
    execVotes: ['YES', 'HOLD', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'HOLD',
    counts: { YES: 2, NO: 2, HOLD: 1, UNCAST: 0 },
  },
  {
    label: 'ANON_FULL / HOLD,NO,NO,NO / 참가자 YES',
    conditionIds: ['ANON_FULL'],
    execVotes: ['HOLD', 'NO', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'REJECT',
    counts: { YES: 1, NO: 3, HOLD: 1, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 YES',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'YES',
    outcome: 'PASS',
    counts: { YES: 3, NO: 2, HOLD: 0, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 NO',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'NO',
    outcome: 'REJECT',
    counts: { YES: 2, NO: 3, HOLD: 0, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 HOLD',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'HOLD',
    outcome: 'HOLD',
    counts: { YES: 2, NO: 2, HOLD: 1, UNCAST: 0 },
  },
  {
    label: 'PILOT,MEASURE / YES,YES,NO,NO / 참가자 UNCAST',
    conditionIds: ['PILOT', 'MEASURE'],
    execVotes: ['YES', 'YES', 'NO', 'NO'],
    participantVote: 'UNCAST',
    outcome: 'HOLD',
    counts: { YES: 2, NO: 2, HOLD: 0, UNCAST: 1 },
  },
  {
    label: '없음(원안) / YES,HOLD,NO,NO / 참가자 UNCAST',
    conditionIds: [],
    execVotes: ['YES', 'HOLD', 'NO', 'NO'],
    participantVote: 'UNCAST',
    outcome: 'HOLD',
    counts: { YES: 1, NO: 2, HOLD: 1, UNCAST: 1 },
  },
];

describe('문서 대표 경로표 — v0.6 (12행)', () => {
  it('테스트 케이스 수가 문서 표 행 수와 같다', () => {
    expect(REPRESENTATIVE_PATHS.length).toBe(12);
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

  it('PILOT,MEASURE는 문서 표 기준 CFO 1명만 바뀐다(HOLD→YES)', () => {
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
    expect(rows.map((r) => r.vote)).toEqual(['YES', 'HOLD', 'NO', 'NO']);
    expect(rows.every((r) => !r.changed)).toBe(true);
  });

  it('ANON_FULL: CEO·CFO가 바뀌고 CAIO·CISO는 원안과 같은 NO라 바뀌지 않는다', () => {
    const motion = buildMotion(['ANON_FULL']);
    const rows = explainBoard(scenario, motion);
    expect(rows.map((r) => r.vote)).toEqual(['HOLD', 'NO', 'NO', 'NO']);
    expect(rows.map((r) => r.changed)).toEqual([true, true, false, false]);
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
    expect(tally(ballots).outcome).toBe('HOLD');
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
