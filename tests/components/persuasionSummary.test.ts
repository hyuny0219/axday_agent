// 결과 화면 "조건이 임원 표를 몇 명 바꿨는지" 요약·"한 끗 차이" 안내(T96)가 쓰는
// 순수 함수. resultSummary.test.ts와 같은 fixture 패턴(buildMotion·createInitialSession)을
// 쓴다.

import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { decideBoard } from '../../src/domain/voting';
import {
  countVotesChangedByFinalConditions,
  liveStanceChangeLine,
  nextTrySuggestionLabel,
  oneStepAwayNote,
} from '../../src/components/persuasionSummary';
import { experienceFirstScenario } from '../../src/content/scenarios';
import type { Ballot, Motion, Session, Statement } from '../../src/domain/types';

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

describe('countVotesChangedByFinalConditions(T96, Codex 27차 검토 P2-2)', () => {
  it('LOG+OWNER 확정: 같은 최종안에서 조건만 뺀 baseline과 비교해 CAIO·CISO 2명의 표가 실제로 다르다', () => {
    const session = buildSession(['LOG', 'OWNER']);
    expect(countVotesChangedByFinalConditions(scenario, session)).toBe(2);
  });

  it('조건 없음: baseline(조건 없음)과 실제 안건(조건 없음)이 같으므로 0명이다', () => {
    // CAIO의 첫 의견은 'UNDECIDED'(미정)였다가 조건 없이도 voteRules의 always 분기로
    // NO가 되지만, 이건 "조건이 바꾼 표"가 아니다(baseline도 똑같이 NO). 옛 구현은
    // "첫 의견 stance"와 비교해 이 경우를 1명으로 잘못 셌다(Codex 27차 검토 P2-2).
    const session = buildSession([]);
    expect(countVotesChangedByFinalConditions(scenario, session)).toBe(0);
  });

  it('live는 scripted 규칙표로 "조건 없었다면"을 가정할 수 없어 항상 0이다', () => {
    const session = { ...buildSession(['LOG', 'OWNER']), mode: 'live' as const };
    expect(countVotesChangedByFinalConditions(scenario, session)).toBe(0);
  });
});

describe('oneStepAwayNote(T96, "한 끗 차이")', () => {
  it('CFO는 LIMIT만 있고 REVIEW가 없으면 "사람이 일부 다시 보기 하나만 더 있었으면 찬성"', () => {
    expect(oneStepAwayNote(scenario, 'CFO', ['LIMIT'], null)).toBe(
      "'사람이 일부 다시 보기' 하나만 더 있었으면 찬성",
    );
  });

  it('CFO가 이미 찬성(LIMIT+REVIEW 모두 확정)이면 null', () => {
    expect(oneStepAwayNote(scenario, 'CFO', ['LIMIT', 'REVIEW'], null)).toBeNull();
  });

  it('CFO가 조건 없이는 둘 다 필요해 2개 — 2개까지는 보여준다', () => {
    expect(oneStepAwayNote(scenario, 'CFO', [], null)).toBe(
      "'결재 금액 한도·사람이 일부 다시 보기'만 더 있었으면 찬성",
    );
  });
});

describe('nextTrySuggestionLabel(T96)', () => {
  it('조건이 하나도 없으면 CFO가 필요로 하는 첫 조건(결재 금액 한도)을 추천한다', () => {
    expect(nextTrySuggestionLabel(scenario, [], null)).toBe('결재 금액 한도');
  });
});

describe('반대 참가자 결과 안내(Codex 33차 P2-2)', () => {
  const allFor = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' } as const;

  it('AGAINST면 찬성으로 돌리는 조건(LIMIT 등)을 "다음엔" 추천하지 않는다 — 두 안건 모두', () => {
    for (const sc of [aiApprovalScenario, experienceFirstScenario]) {
      const label = nextTrySuggestionLabel(sc, [], 'AGAINST', { ...allFor });
      // 적용 가능한 반대 방향 조건이 없으면 생략(null), 있으면 NO로 돌리는 조건뿐이다.
      expect(label).toBeNull();
    }
    // 같은 입력의 FOR 경로는 기존대로 찬성으로 돌리는 조건을 추천한다.
    expect(nextTrySuggestionLabel(aiApprovalScenario, [], 'FOR')).toBe('결재 금액 한도');
  });

  it('AGAINST면 "한 끗 차이"(찬성이었을 텐데) 안내를 보이지 않는다', () => {
    expect(oneStepAwayNote(aiApprovalScenario, 'CFO', ['LIMIT'], 'AGAINST')).toBeNull();
    expect(oneStepAwayNote(aiApprovalScenario, 'CFO', ['LIMIT'], 'FOR')).not.toBeNull();
  });
});

describe('liveStanceChangeLine(Codex 33차 P2-1)', () => {
  const stmt = (roleId: Statement['roleId'], stance: Statement['stance']): Statement => ({
    id: roleId,
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
  });

  it('첫 입장과 최종 표가 다른 임원 수를 센다(표를 못 낸 임원은 세지 않는다)', () => {
    const statements = [stmt('CEO', 'FOR'), stmt('CFO', 'AGAINST'), stmt('CAIO', 'UNDECIDED'), stmt('CISO', 'AGAINST')];
    const line = liveStanceChangeLine(scenario, statements, [
      { memberId: 'CEO', vote: 'YES' },
      { memberId: 'CFO', vote: 'YES' },
      { memberId: 'CAIO', vote: 'NO' },
      { memberId: 'CISO', vote: 'UNCAST' },
    ]);
    expect(line).toBe('임원 2명의 입장이 이사님의 발언 뒤 바뀌었습니다');
  });

  it('모두 같으면 처음과 같았다고 말하고 인과 문구를 쓰지 않는다', () => {
    const statements = [stmt('CEO', 'FOR'), stmt('CFO', 'AGAINST'), stmt('CAIO', 'FOR'), stmt('CISO', 'AGAINST')];
    const line = liveStanceChangeLine(scenario, statements, [
      { memberId: 'CEO', vote: 'YES' },
      { memberId: 'CFO', vote: 'NO' },
      { memberId: 'CAIO', vote: 'YES' },
      { memberId: 'CISO', vote: 'NO' },
    ]);
    expect(line).toBe('임원 입장은 처음과 같았습니다');
    expect(line).not.toContain('조건');
  });
});
