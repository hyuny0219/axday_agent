// "이사회 한 장 요약" 패널이 쓰는 순수 함수(T48). scripted는 explainBoard에서 이유·바뀐
// 표를 읽고, live는 session.ballots의 reason(없으면 unavailableReason, 그것도 없으면
// "판단 근거 없음")을 읽으며 changed는 항상 false다.

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { decideBoard, rulesFallbackBallot } from '../../src/domain/voting';
import { buildResultSummary } from '../../src/components/resultSummary';
import type { Ballot, Motion, Session } from '../../src/domain/types';

const scenario = anonBoardScenario;

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

describe('buildResultSummary — scripted', () => {
  it('PILOT,MEASURE + 참가자 YES: 집계·조건 라벨·CFO만 바뀐 표·결정력을 계산한다', () => {
    const motion = buildMotion(['PILOT', 'MEASURE']);
    const boardBallots = decideBoard(scenario, motion);
    const participantBallot: Ballot = {
      memberId: 'PARTICIPANT',
      motionId: motion.id,
      motionHash: motion.hash,
      source: 'scripted',
      vote: 'YES',
      confirmedAt: 1,
    };
    const session: Session = {
      ...createInitialSession(0, 's1'),
      followUpAnswered: true,
      stage: 'RESULT',
      mode: 'scripted',
      scenarioId: scenario.id,
      finalMotion: motion,
      ballots: [...boardBallots, participantBallot],
      outcome: 'PASS',
      opinions: [
        {
          id: 'op1',
          originalText: '작은 범위로 먼저 시작하고 효과를 확인한 뒤 넓히겠습니다.',
          selectedPhraseIds: ['P1', 'P4'],
          confirmedConditionIds: ['PILOT', 'MEASURE'],
          createdAt: 0,
        },
      ],
    };

    const summary = buildResultSummary(scenario, session);

    expect(summary.tally.outcome).toBe('PASS');
    expect(summary.tally.counts).toEqual({ YES: 3, NO: 2, UNCAST: 0 });
    expect(summary.conditionLabels).toEqual(['한 게시판에서 시범', '운영 효과 측정 후 확대']);
    expect(summary.execRows.map((r) => r.vote)).toEqual(['YES', 'YES', 'NO', 'NO']);
    expect(summary.execRows.map((r) => r.changed)).toEqual([false, true, false, false]);
    expect(summary.execRows.every((r) => r.reason.length > 0)).toBe(true);
    expect(summary.participant.vote).toBe('YES');
    expect(summary.participant.decisive).toBe(true);
    expect(summary.quote).toEqual(['작은 범위로 먼저 시작하고 효과를 확인한 뒤 넓히겠습니다.']);
  });

  it('조건 없음(원안): 조건 라벨이 비어 아무도 바뀌지 않는다', () => {
    const motion = buildMotion([]);
    const boardBallots = decideBoard(scenario, motion);
    const participantBallot: Ballot = {
      memberId: 'PARTICIPANT',
      motionId: motion.id,
      motionHash: motion.hash,
      source: 'scripted',
      vote: 'NO',
      confirmedAt: 1,
    };
    const session: Session = {
      ...createInitialSession(0, 's2'),
      followUpAnswered: true,
      stage: 'RESULT',
      mode: 'scripted',
      scenarioId: scenario.id,
      finalMotion: motion,
      ballots: [...boardBallots, participantBallot],
      outcome: 'REJECT',
      opinions: [],
    };

    const summary = buildResultSummary(scenario, session);
    expect(summary.conditionLabels).toEqual([]);
    expect(summary.execRows.every((r) => !r.changed)).toBe(true);
  });
});

describe('buildResultSummary — live', () => {
  it('live 임원 좌석은 ballot.reason을 읽고, UNCAST 좌석은 판단 근거 없음으로 대체하며 changed는 항상 false다', () => {
    const motion = buildMotion(['SCREEN']);
    const ballots: Ballot[] = [
      {
        memberId: 'CEO',
        motionId: motion.id,
        motionHash: motion.hash,
        source: 'live',
        vote: 'YES',
        reason: '보고 준비를 줄이는 방향에 찬성합니다.',
        confirmedAt: 1,
      },
      {
        memberId: 'CFO',
        motionId: motion.id,
        motionHash: motion.hash,
        source: 'unavailable',
        vote: 'UNCAST',
        unavailableReason: '응답 지연으로 시간 내 답하지 못했습니다.',
        confirmedAt: 1,
      },
      {
        memberId: 'CAIO',
        motionId: motion.id,
        motionHash: motion.hash,
        source: 'live',
        vote: 'YES',
        reason: '출처·기준일 검토 절차가 있어 찬성합니다.',
        confirmedAt: 1,
      },
      {
        memberId: 'CISO',
        motionId: motion.id,
        motionHash: motion.hash,
        source: 'unavailable',
        vote: 'UNCAST',
        confirmedAt: 1,
      },
      {
        memberId: 'PARTICIPANT',
        motionId: motion.id,
        motionHash: motion.hash,
        source: 'live',
        vote: 'YES',
        confirmedAt: 1,
      },
    ];
    const session: Session = {
      ...createInitialSession(0, 's3'),
      followUpAnswered: true,
      stage: 'RESULT',
      mode: 'live',
      scenarioId: scenario.id,
      finalMotion: motion,
      ballots,
      outcome: 'PASS',
      opinions: [
        {
          id: 'op1',
          originalText: '출처와 기준일을 표시하고 검토 후 공유합시다.',
          selectedPhraseIds: [],
          confirmedConditionIds: ['SCREEN'],
          createdAt: 0,
        },
      ],
    };

    const summary = buildResultSummary(scenario, session);

    expect(summary.execRows.every((r) => !r.changed)).toBe(true);
    expect(summary.execRows.find((r) => r.memberId === 'CEO')?.reason).toBe(
      '보고 준비를 줄이는 방향에 찬성합니다.',
    );
    expect(summary.execRows.find((r) => r.memberId === 'CFO')?.reason).toBe(
      '응답 지연으로 시간 내 답하지 못했습니다.',
    );
    expect(summary.execRows.find((r) => r.memberId === 'CISO')?.reason).toBe('판단 근거 없음');
    expect(summary.conditionLabels).toEqual(['게시 전 검수']);
    expect(summary.quote).toEqual(['출처와 기준일을 표시하고 검토 후 공유합시다.']);
  });

  it('규칙표로 정한 표(source rules)는 fallback 표시와 규칙표 reason을 담고, 표는 실제 표와 같이 집계된다(T136)', () => {
    const motion = buildMotion([]);
    const base = { motionId: motion.id, motionHash: motion.hash, confirmedAt: 1 } as const;
    const ballots: Ballot[] = [
      { ...base, memberId: 'CEO', source: 'live', vote: 'YES', reason: '찬성합니다.' },
      { ...rulesFallbackBallot(scenario, motion, 'CFO', 'FOR', true, 1) },
      { ...base, memberId: 'CAIO', source: 'live', vote: 'YES', reason: '찬성합니다.' },
      { ...base, memberId: 'CISO', source: 'live', vote: 'YES', reason: '찬성합니다.' },
      { ...base, memberId: 'PARTICIPANT', source: 'live', vote: 'YES' },
    ];
    const session: Session = {
      ...createInitialSession(0, 's4'),
      followUpAnswered: true,
      stage: 'RESULT',
      mode: 'live',
      scenarioId: scenario.id,
      finalMotion: motion,
      ballots,
      outcome: 'PASS',
    };

    const summary = buildResultSummary(scenario, session);

    expect(summary.execRows.filter((r) => r.fallback).map((r) => r.memberId)).toEqual(['CFO']);
    expect(summary.execRows.find((r) => r.memberId === 'CFO')?.reason).not.toBe('판단 근거 없음');
    // T138: 이유가 없으면(기본) 늦은 응답, direction이면 방향 불일치로 규칙표 표로 바꾼 것이다.
    expect(summary.execRows.find((r) => r.memberId === 'CFO')?.fallbackCause).toBe('late');
    const directionSession: Session = {
      ...session,
      ballots: ballots.map((b) => (b.memberId === 'CFO' ? { ...b, rulesCause: 'direction' as const } : b)),
    };
    expect(buildResultSummary(scenario, directionSession).execRows.find((r) => r.memberId === 'CFO')?.fallbackCause).toBe('direction');
    expect(summary.tally.counts.UNCAST).toBe(0);
    expect(summary.tally.counts.YES + summary.tally.counts.NO).toBe(5);
  });
});
