// 결과 화면 "조건이 임원 표를 몇 명 바꿨는지" 요약·"한 끗 차이" 안내(T96)가 쓰는
// 순수 함수. resultSummary.test.ts와 같은 fixture 패턴(buildMotion·createInitialSession)을
// 쓴다.

import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { countVotesChangedByConditions, decideBoard, membersChangedByConditionsToward } from '../../src/domain/voting';
import {
  computePersuasionTally,
  persuadedCountLabel,
  countVotesChangedByFinalConditions,
  buildPersuasionResult,
  nextTrySuggestionLabel,
  oneStepAwayNote,
} from '../../src/components/persuasionSummary';
import { experienceFirstScenario } from '../../src/content/scenarios';
import { persuasionStamp } from '../../src/domain/stance';
import type { Ballot, Motion, Session, Stance, Statement } from '../../src/domain/types';

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
    followUpAnswered: true,
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

describe('computePersuasionTally(T101) — 현황판·결과 제목·도장이 같은 세션에서 모순되지 않는다', () => {
  function subsets(ids: string[]): string[][] {
    const result: string[][] = [[]];
    for (const id of ids) {
      for (const existing of [...result]) result.push([...existing, id]);
    }
    return result;
  }

  it('두 안건·두 입장·모든 조건 조합에서 같은 편 좌석 = 나 + 처음부터 같은 편 + 설득한 임원, 분모 = 4 - 처음부터 같은 편', () => {
    for (const sc of [aiApprovalScenario, experienceFirstScenario]) {
      for (const side of ['FOR', 'AGAINST'] as const) {
        for (const conditionIds of subsets(sc.conditions.map((condition) => condition.id))) {
          const id = 'm';
          const motion: Motion = {
            id,
            scenarioId: sc.id,
            kind: conditionIds.length === 0 ? 'original' : 'amended',
            conditionIds,
            baseConditionIds: [],
            effectiveConditionIds: conditionIds,
            executionMode: 'DEFAULT',
            frozenAt: 0,
            text: sc.originalMotion.text,
            hash: 'h',
          };
          const ballots = decideBoard(sc, motion, side);
          const participantVote = side === 'FOR' ? 'YES' : 'NO';
          const finalStances = {} as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
          for (const ballot of ballots) {
            const memberId = ballot.memberId as 'CEO' | 'CFO' | 'CAIO' | 'CISO';
            finalStances[memberId] = ballot.vote === 'YES' ? 'FOR' : ballot.vote === 'NO' ? 'AGAINST' : 'UNDECIDED';
          }
          const tally = computePersuasionTally(sc, 'scripted', [], side, finalStances);
          const participantBallot: Ballot = {
            memberId: 'PARTICIPANT',
            motionId: id,
            motionHash: 'h',
            source: 'scripted',
            vote: participantVote,
            confirmedAt: 1,
          };
          const seats = persuasionStamp([...ballots, participantBallot], participantVote).sameVoteSeats;
          expect(1 + tally.alreadySame.length + tally.persuaded.length).toBe(seats);
          expect(tally.total).toBe(4 - tally.alreadySame.length);
          expect(tally.persuaded.length).toBeLessThanOrEqual(tally.total);
          expect(tally.alreadySame.length + tally.persuaded.length + tally.remaining.length).toBe(4);
        }
      }
    }
  });

  it('안건①: 찬성이면 처음부터 찬성인 CEO를 분모에서 빼 "설득한 임원 0/3"이고, 반대면 CFO·CISO를 빼 "0/2"다', () => {
    const none: Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance> = {
      CEO: 'FOR',
      CFO: 'AGAINST',
      CAIO: 'UNDECIDED',
      CISO: 'AGAINST',
    };
    const forTally = computePersuasionTally(aiApprovalScenario, 'scripted', [], 'FOR', none);
    expect(forTally.alreadySame).toEqual(['CEO']);
    expect(persuadedCountLabel(forTally)).toBe('설득한 임원 0/3');
    const againstTally = computePersuasionTally(aiApprovalScenario, 'scripted', [], 'AGAINST', none);
    expect(againstTally.alreadySame).toEqual(['CFO', 'CISO']);
    expect(persuadedCountLabel(againstTally)).toBe('설득한 임원 0/2');
  });

  it('모두 처음부터 같은 편이면 숫자 대신 말로 표시한다', () => {
    const tally = { target: 'FOR' as const, alreadySame: ['CEO', 'CFO', 'CAIO', 'CISO'] as never[], persuaded: [], remaining: [], total: 0 };
    expect(persuadedCountLabel(tally)).toBe('모두 처음부터 같은 편');
  });
});

describe('buildPersuasionResult(T101 검토) — 제목의 M이 현황판·도장의 tally와 같다', () => {
  function subsets(ids: string[]): string[][] {
    const result: string[][] = [[]];
    for (const id of ids) for (const e of [...result]) result.push([...e, id]);
    return result;
  }
  const stmt = (roleId: Statement['roleId'], stance: Statement['stance']): Statement => ({
    id: roleId, roleId, stage: 'OPINIONS', text: '발언', evidenceIds: [], referencedStatementIds: [],
    concerns: [], suggestedConditionIds: [], stance, source: 'live', createdAt: 0,
  });

  it('두 안건 × 두 입장 × 모든 조건 조합: 제목 문구의 M은 tally.persuaded 수와 같고, M=0이면 "바꾸지 못했습니다"다', () => {
    for (const sc of [aiApprovalScenario, experienceFirstScenario]) {
      for (const side of ['FOR', 'AGAINST'] as const) {
        for (const conditionIds of subsets(sc.conditions.map((c) => c.id))) {
          const motion: Motion = {
            id: 'm', scenarioId: sc.id, kind: conditionIds.length === 0 ? 'original' : 'amended',
            conditionIds, baseConditionIds: [], effectiveConditionIds: conditionIds,
            executionMode: 'DEFAULT', frozenAt: 0, text: sc.originalMotion.text, hash: 'h',
          };
          const finalStances = {} as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
          for (const ballot of decideBoard(sc, motion, side)) {
            const id = ballot.memberId as 'CEO' | 'CFO' | 'CAIO' | 'CISO';
            finalStances[id] = ballot.vote === 'YES' ? 'FOR' : ballot.vote === 'NO' ? 'AGAINST' : 'UNDECIDED';
          }
          const session = { ...createInitialSession(0, 's'), followUpAnswered: true, mode: 'scripted' as const };
          const result = buildPersuasionResult(sc, session, finalStances, {
            participantVote: side === 'FOR' ? 'YES' : 'NO',
            participantStance: side,
            conditionCount: conditionIds.length,
            finalConditionIds: conditionIds,
            finalMotion: motion,
          });
          const m = result.tally.persuaded.length;
          const match = /임원 (\d)명이 이사님 편이 됐습니다/.exec(result.headline);
          if (m > 0) {
            expect(Number(match?.[1])).toBe(m);
            // 조건 문구는 조건을 뺀 기준 표에서 참가자 목표 방향으로 넘어온 임원이 설득된 임원 안에
            // 있을 때만 쓴다(Codex 35차 P2-2 → 46차 P2: 방향·교집합).
            const toward = membersChangedByConditionsToward(sc, motion, side === 'FOR' ? 'YES' : 'NO').filter((id) =>
              result.tally.persuaded.includes(id),
            );
            expect(result.headline).toContain(toward.length > 0 ? '발언과 조건' : '발언으로');
          } else {
            expect(match).toBeNull();
            expect(result.headline).toContain('이번엔 임원의 입장을 바꾸지 못했습니다');
          }
        }
      }
    }
  });

  it('참가자 반대·조건 없음(안건①): 현황판처럼 CAIO(미정→반대) 한 명을 설득한 것으로 제목에도 나온다', () => {
    const stances = { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' } as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
    const session = { ...createInitialSession(0, 's'), followUpAnswered: true, mode: 'scripted' as const };
    const result = buildPersuasionResult(aiApprovalScenario, session, stances, {
      participantVote: 'NO', participantStance: 'AGAINST', conditionCount: 0, finalConditionIds: [],
    });
    expect(result.tally.persuaded).toEqual(['CAIO']);
    expect(result.headline).toBe('이사님의 발언으로 임원 1명이 이사님 편이 됐습니다');
  });

  it('live: 첫 입장과 달리 이사님 편이 된 임원 수를 인과(조건) 없이 말한다', () => {
    const session = {
      ...createInitialSession(0, 's'),
      mode: 'live' as const,
      transcript: { ...createInitialSession(0, 's').transcript, statements: [stmt('CEO', 'FOR'), stmt('CFO', 'AGAINST'), stmt('CAIO', 'UNDECIDED'), stmt('CISO', 'AGAINST')] },
    };
    const stances = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'AGAINST' } as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
    const result = buildPersuasionResult(aiApprovalScenario, session, stances, {
      participantVote: 'YES', participantStance: 'FOR', conditionCount: 2, finalConditionIds: ['LIMIT', 'LOG'],
    });
    expect(result.tally.persuaded).toEqual(['CFO', 'CAIO']);
    expect(result.headline).toBe('이사님의 발언으로 임원 2명이 이사님 편이 됐습니다');
    expect(result.headline).not.toContain('조건');
  });

  it('Codex 35차 P2-2: 참가자 반대 + REVIEW만 확정이면 CAIO는 조건 없이도 NO라 "조건"을 말하지 않는다', () => {
    const motion: Motion = {
      id: 'm', scenarioId: aiApprovalScenario.id, kind: 'amended', conditionIds: ['REVIEW'],
      baseConditionIds: [], effectiveConditionIds: ['REVIEW'], executionMode: 'DEFAULT',
      frozenAt: 0, text: aiApprovalScenario.originalMotion.text, hash: 'h',
    };
    const stances = { CEO: 'FOR', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' } as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
    const session = { ...createInitialSession(0, 's'), followUpAnswered: true, mode: 'scripted' as const };
    const result = buildPersuasionResult(aiApprovalScenario, session, stances, {
      participantVote: 'NO', participantStance: 'AGAINST', conditionCount: 1,
      finalConditionIds: ['REVIEW'], finalMotion: motion,
    });
    expect(result.headline).toBe('이사님의 발언으로 임원 1명이 이사님 편이 됐습니다');
  });

  it('Codex 46차 P2: 참가자 반대 + LIMIT+REVIEW면 CFO는 조건으로 찬성(반대편)이 되고 CAIO는 조건 없이도 NO라 "조건"을 말하지 않는다', () => {
    const motion: Motion = {
      id: 'm', scenarioId: aiApprovalScenario.id, kind: 'amended', conditionIds: ['LIMIT', 'REVIEW'],
      baseConditionIds: [], effectiveConditionIds: ['LIMIT', 'REVIEW'], executionMode: 'DEFAULT',
      frozenAt: 0, text: aiApprovalScenario.originalMotion.text, hash: 'h',
    };
    const stances = { CEO: 'FOR', CFO: 'FOR', CAIO: 'AGAINST', CISO: 'AGAINST' } as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
    const session = { ...createInitialSession(0, 's'), followUpAnswered: true, mode: 'scripted' as const };
    const result = buildPersuasionResult(aiApprovalScenario, session, stances, {
      participantVote: 'NO', participantStance: 'AGAINST', conditionCount: 2,
      finalConditionIds: ['LIMIT', 'REVIEW'], finalMotion: motion,
    });
    // 방향을 따지지 않는 countVotesChangedByConditions는 CFO 때문에 1이지만, 참가자(반대) 쪽으로 넘어온 임원은 없다.
    expect(countVotesChangedByConditions(aiApprovalScenario, motion)).toBeGreaterThan(0);
    expect(membersChangedByConditionsToward(aiApprovalScenario, motion, 'NO')).toEqual([]);
    expect(result.headline).toBe(`이사님의 발언으로 임원 ${result.tally.persuaded.length}명이 이사님 편이 됐습니다`);
  });

  it('Codex 35차 P2-3: 찬성 발언 뒤 반대 표를 던지면 다음 조건 추천도 반대 목표를 쓴다', () => {
    const stances = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'FOR' } as Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', Stance>;
    const session = { ...createInitialSession(0, 's'), followUpAnswered: true, mode: 'scripted' as const };
    const result = buildPersuasionResult(aiApprovalScenario, session, stances, {
      participantVote: 'NO', participantStance: 'FOR', conditionCount: 1,
      finalConditionIds: ['LOG'],
    });
    expect(result.tally.target).toBe('AGAINST');
    const againstLabel = nextTrySuggestionLabel(aiApprovalScenario, ['LOG'], 'AGAINST', stances);
    const forLabel = nextTrySuggestionLabel(aiApprovalScenario, ['LOG'], 'FOR', stances);
    expect(againstLabel).not.toBe(forLabel);
    expect(result.headline).toBe(
      againstLabel
        ? `이번엔 임원의 입장을 바꾸지 못했습니다 — 다음엔 '${againstLabel}' 조건을 붙여 보세요`
        : '이번엔 임원의 입장을 바꾸지 못했습니다',
    );
  });
});
