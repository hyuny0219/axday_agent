// 결과 화면 "조건이 임원 표를 몇 명 바꿨는지" 요약·"한 끗 차이" 안내(T96)가 쓰는
// 순수 함수. resultSummary.test.ts와 같은 fixture 패턴(buildMotion·createInitialSession)을
// 쓴다.

import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { decideBoard } from '../../src/domain/voting';
import {
  countVotesChangedFromOpening,
  nextTrySuggestionLabel,
  oneStepAwayNote,
} from '../../src/components/persuasionSummary';
import type { Ballot, Motion, Session } from '../../src/domain/types';

const scenario = aiApprovalScenario;

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

function buildSession(conditionIds: string[]): Session {
  const motion = buildMotion(conditionIds);
  const boardBallots = decideBoard(scenario, motion);
  const participantBallot: Ballot = {
    memberId: 'PARTICIPANT',
    motionId: motion.id,
    motionHash: motion.hash,
    source: 'scripted',
    vote: 'YES',
    confirmedAt: 1,
  };
  return {
    ...createInitialSession(0, 's1'),
    stage: 'RESULT',
    mode: 'scripted',
    scenarioId: scenario.id,
    finalMotion: motion,
    ballots: [...boardBallots, participantBallot],
    outcome: 'PASS',
  };
}

describe('countVotesChangedFromOpening(T96)', () => {
  it('LOG+OWNER 확정: CAIO(미정→찬성)·CISO(반대→찬성) 2명이 첫 의견과 다르다', () => {
    const session = buildSession(['LOG', 'OWNER']);
    expect(countVotesChangedFromOpening(scenario, session)).toBe(2);
  });

  it('조건 없음: CEO·CFO·CISO는 첫 의견과 같고, CAIO만 "미정"에서 반대로 정해져 1명 바뀐다', () => {
    // CAIO의 첫 의견은 openingStance가 'UNDECIDED'(미정)다 — voteRules의 always 분기(NO)로
    // 정해지는 순간 "미정 → 반대"로 분명한 입장이 된 것이라 바뀜으로 센다(src/content/
    // scenarios/aiApproval.ts initialOpinions 주석 — 미정은 voteRules의 always 분기와 다른
    // 개념이다).
    const session = buildSession([]);
    expect(countVotesChangedFromOpening(scenario, session)).toBe(1);
  });
});

describe('oneStepAwayNote(T96, "한 끗 차이")', () => {
  it('CFO는 LIMIT만 있고 REVIEW가 없으면 "사람 표본 재검토 하나만 더 있었으면 찬성"', () => {
    expect(oneStepAwayNote(scenario, 'CFO', ['LIMIT'], null)).toBe(
      "'사람 표본 재검토' 하나만 더 있었으면 찬성",
    );
  });

  it('CFO가 이미 찬성(LIMIT+REVIEW 모두 확정)이면 null', () => {
    expect(oneStepAwayNote(scenario, 'CFO', ['LIMIT', 'REVIEW'], null)).toBeNull();
  });

  it('CFO가 조건 없이는 둘 다 필요해 2개 — 2개까지는 보여준다', () => {
    expect(oneStepAwayNote(scenario, 'CFO', [], null)).toBe(
      "'결재 금액 한도·사람 표본 재검토'만 더 있었으면 찬성",
    );
  });
});

describe('nextTrySuggestionLabel(T96)', () => {
  it('조건이 하나도 없으면 CFO가 필요로 하는 첫 조건(결재 금액 한도)을 추천한다', () => {
    expect(nextTrySuggestionLabel(scenario, [], null)).toBe('결재 금액 한도');
  });
});
