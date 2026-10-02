// 회의록 패널이 그릴 항목을 계산하는 순수 함수 검증(DESIGN_SPEC.md v1.0 7절, T41).
// scripted 전 단계 항목 순서·내용, live pending/failed가 뒤 라운드 후에도 남는지,
// (창 고정 visibleWindow는 2026-09-28 사용자 결정으로 제거됐다 — 전체 항목을 스크롤로 보여준다.)

import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Session, SessionMode, Statement } from '../../src/domain/types';
import {
  buildMinutes,
  formatElapsed,
  TIME_UNKNOWN,
  upsertRoundLogEntry,
  type MinutesEntry,
  type RoundLogEntry,
} from '../../src/components/minutes';

const scenario = anonBoardScenario;
const T0 = 1_700_000_000_000;

function selectScenario(mode: SessionMode, now = T0): Session {
  let session = createInitialSession(now);
  session = reduce(session, { type: 'START' }, now);
  session = reduce(session, { type: 'SET_MODE', mode }, now);
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, now);
  return session;
}

function ids(entries: MinutesEntry[]): string[] {
  return entries.map((entry) => entry.id);
}

describe('buildMinutes(scripted)', () => {
  it('BRIEFING에서는 의장 브리핑 한 줄만 보인다', () => {
    const session = selectScenario('scripted');
    const entries = buildMinutes(session, scenario, []);
    expect(ids(entries)).toEqual(['chair-briefing']);
    expect(entries[0]).toMatchObject({ speaker: 'CEO', kind: 'speech', text: scenario.chairBriefing.situation });
  });

  it('OPINIONS 단계에서는 임원 첫 의견 4건이 더해진다', () => {
    let session = selectScenario('scripted');
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // BRIEFING -> OPINIONS
    const entries = buildMinutes(session, scenario, []);
    expect(ids(entries)).toEqual([
      'chair-briefing',
      'opinion-CEO',
      'opinion-CFO',
      'opinion-CAIO',
      'opinion-CISO',
    ]);
    expect(entries.every((entry) => entry.kind === 'speech')).toBe(true);
  });

  it('scripted 전 단계를 거치면 순서대로 8개 항목 묶음이 쌓이고 반응 없는 임원은 "기존 의견 유지"다', () => {
    let session = selectScenario('scripted');
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> OPINIONS
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> DISCUSS
    session = reduce(
      session,
      {
        type: 'SUBMIT_OPINION',
        originalText: '작은 범위로 먼저 시작합시다.',
        selectedPhraseIds: ['P1'],
        confirmedConditionIds: ['PILOT'],
      },
      T0,
    ); // -> REACTIONS
    session = reduce(
      session,
      {
        type: 'SUBMIT_FOLLOWUP',
        originalText: '출처와 기준일을 표시하고 담당자가 확인한 뒤 공유합시다.',
        selectedPhraseIds: [],
        confirmedConditionIds: ['PILOT', 'SCREEN'],
      },
      T0,
    ); // -> MOTION

    const entries = buildMinutes(session, scenario, []);
    expect(ids(entries)).toEqual([
      'chair-briefing',
      'opinion-CEO',
      'opinion-CFO',
      'opinion-CAIO',
      'opinion-CISO',
      'my-opinion',
      'reaction-CEO',
      'reaction-CFO',
      'reaction-CAIO',
      'reaction-CISO',
      'caio-question',
      'my-followup',
      'chair-motion',
    ]);

    // PILOT 조건을 확정했으므로 CFO는 실제 반응 문구, 조건과 무관한 CISO는
    // "기존 의견 유지"다(scenario.reactions에 PILOT용 CISO 반응이 없다).
    const cfoReaction = entries.find((entry) => entry.id === 'reaction-CFO');
    const cisoReaction = entries.find((entry) => entry.id === 'reaction-CISO');
    expect(cfoReaction?.text).toContain('처리 공수');
    expect(cisoReaction?.text).toBe('기존 의견 유지');

    const myOpinion = entries.find((entry) => entry.id === 'my-opinion');
    expect(myOpinion).toMatchObject({ speaker: 'PARTICIPANT', kind: 'mine' });

    const myFollowup = entries.find((entry) => entry.id === 'my-followup');
    expect(myFollowup?.text).toBe('출처와 기준일을 표시하고 담당자가 확인한 뒤 공유합시다.');

    const chairMotion = entries.find((entry) => entry.id === 'chair-motion');
    expect(chairMotion).toMatchObject({ speaker: 'CEO', kind: 'speech', text: '이 조건으로 안건을 고정합니다' });
  });

  it('KEEP_PREVIOUS 경로에서는 내 답이 "앞서 전달한 의견을 유지"다', () => {
    let session = selectScenario('scripted');
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

    const entries = buildMinutes(session, scenario, []);
    const myFollowup = entries.find((entry) => entry.id === 'my-followup');
    expect(myFollowup?.text).toBe('앞서 전달한 의견을 유지');
    // scripted는 후속 라운드가 없으므로 followup-* 항목이 없다.
    expect(entries.some((entry) => entry.id.startsWith('followup-'))).toBe(false);
  });
});

function statementFor(roleId: Statement['roleId'], stage: Statement['stage'], text: string): Statement {
  return {
    id: `${roleId}-${stage}`,
    roleId,
    stage,
    text,
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'live',
    createdAt: T0,
  };
}

describe('buildMinutes(live) — roundLog는 뒤 라운드가 roleStatus를 덮어써도 남는다', () => {
  it('OPINIONS에서 실패한 임원은 REACTIONS 라운드가 진행 중이어도 "응답 없음"으로 남는다', () => {
    let session = selectScenario('live');
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> OPINIONS

    // OPINIONS 라운드: CAIO만 실패, 나머지는 응답.
    session = {
      ...session,
      roleStatus: { CEO: 'answered', CFO: 'answered', CAIO: 'failed', CISO: 'answered' },
      transcript: {
        revision: 1,
        statements: [
          statementFor('CEO', 'OPINIONS', 'CEO의 초기 의견입니다.'),
          statementFor('CFO', 'OPINIONS', 'CFO의 초기 의견입니다.'),
          statementFor('CISO', 'OPINIONS', 'CISO의 초기 의견입니다.'),
        ],
      },
    };
    let roundLog: RoundLogEntry[] = [];
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'OPINIONS', roleId: 'CEO', status: 'answered' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'OPINIONS', roleId: 'CFO', status: 'answered' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'OPINIONS', roleId: 'CAIO', status: 'failed' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'OPINIONS', roleId: 'CISO', status: 'answered' });

    const beforeReactions = buildMinutes(session, scenario, roundLog);
    expect(beforeReactions.find((entry) => entry.id === 'opinion-CAIO')).toMatchObject({
      kind: 'failed',
      text: '응답 없음',
    });
    expect(beforeReactions.find((entry) => entry.id === 'opinion-CEO')).toMatchObject({
      kind: 'speech',
      text: 'CEO의 초기 의견입니다.',
    });

    // 참가자 의견 전달로 REACTIONS 진입. 새 라운드는 4명 모두 pending으로 되돌리지만
    // (runner.ts가 SET_ROLE_STATUS 'pending'을 먼저 쏜다) OPINIONS 항목은 그대로다.
    session = {
      ...session,
      stage: 'REACTIONS',
      opinions: [
        {
          id: 'op-1',
          originalText: '검토했습니다. 한 게시판에서 시범하는 데 동의합니다.',
          selectedPhraseIds: [],
          confirmedConditionIds: [],
          createdAt: T0,
        },
      ],
      roleStatus: { CEO: 'pending', CFO: 'pending', CAIO: 'pending', CISO: 'pending' },
    };
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'REACTIONS', roleId: 'CEO', status: 'pending' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'REACTIONS', roleId: 'CFO', status: 'pending' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'REACTIONS', roleId: 'CAIO', status: 'pending' });
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'REACTIONS', roleId: 'CISO', status: 'pending' });

    const duringReactions = buildMinutes(session, scenario, roundLog);
    // OPINIONS 라운드의 CAIO 항목은 그대로 "응답 없음"이다.
    expect(duringReactions.find((entry) => entry.id === 'opinion-CAIO')).toMatchObject({
      kind: 'failed',
      text: '응답 없음',
    });
    // REACTIONS 라운드는 아직 진행 중이므로 판단 중(점 세 개)으로 보인다.
    expect(duringReactions.find((entry) => entry.id === 'reaction-CAIO')).toMatchObject({
      kind: 'pending',
      text: '',
    });
  });

  it('roundLog에 기록이 없는 라운드는 판단 중으로 본다', () => {
    let session = selectScenario('live');
    session = reduce(session, { type: 'NEXT_STAGE' }, T0);
    const entries = buildMinutes(session, scenario, []);
    const ceoOpinion = entries.find((entry) => entry.id === 'opinion-CEO');
    expect(ceoOpinion).toMatchObject({ kind: 'pending', text: '' });
  });
});

describe('upsertRoundLogEntry', () => {
  it('같은 (stage, roleId)는 자리 그대로 덮어쓰고, 다른 조합은 더한다', () => {
    let log: RoundLogEntry[] = [];
    log = upsertRoundLogEntry(log, { stage: 'OPINIONS', roleId: 'CEO', status: 'pending' });
    log = upsertRoundLogEntry(log, { stage: 'OPINIONS', roleId: 'CFO', status: 'pending' });
    log = upsertRoundLogEntry(log, { stage: 'OPINIONS', roleId: 'CEO', status: 'answered' });

    expect(log).toEqual([
      { stage: 'OPINIONS', roleId: 'CEO', status: 'answered' },
      { stage: 'OPINIONS', roleId: 'CFO', status: 'pending' },
    ]);
  });
});

// T77: 시안 TRANSCRIPT "[mm:ss] 역할" 타임스탬프 — 세션 시작(startedAt) 기준 경과 시간이며,
// 실측되지 않은 각본 문구·아직 응답하지 않은 역할은 지어내지 않고 TIME_UNKNOWN("--:--")이다.
describe('formatElapsed', () => {
  it('시작 시각과 발생 시각이 모두 있으면 mm:ss로 돌려준다', () => {
    expect(formatElapsed(T0, T0 + 9_000)).toBe('00:09');
    expect(formatElapsed(T0, T0 + 65_000)).toBe('01:05');
  });

  it('시작 시각이나 발생 시각 중 하나라도 없으면 TIME_UNKNOWN이다', () => {
    expect(formatElapsed(null, T0)).toBe(TIME_UNKNOWN);
    expect(formatElapsed(T0, undefined)).toBe(TIME_UNKNOWN);
  });
});

describe('buildMinutes — 타임스탬프(T77)', () => {
  it('scripted 각본 항목(의장 브리핑 등)은 도착 시각이 없어 TIME_UNKNOWN이다', () => {
    const session = selectScenario('scripted');
    const entries = buildMinutes(session, scenario, []);
    expect(entries[0]).toMatchObject({ id: 'chair-briefing', timeLabel: TIME_UNKNOWN });
  });

  it('live 응답 발언은 세션 시작 기준 경과 시간을, 아직 응답하지 않은 역할은 TIME_UNKNOWN을 보여준다', () => {
    let session = selectScenario('live'); // startedAt = T0
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> OPINIONS
    session = {
      ...session,
      roleStatus: { CEO: 'answered', CFO: 'pending', CAIO: 'pending', CISO: 'pending' },
      transcript: {
        revision: 1,
        statements: [{ ...statementFor('CEO', 'OPINIONS', '발언입니다.'), createdAt: T0 + 9_000 }],
      },
    };
    let roundLog: RoundLogEntry[] = [];
    roundLog = upsertRoundLogEntry(roundLog, { stage: 'OPINIONS', roleId: 'CEO', status: 'answered' });

    const entries = buildMinutes(session, scenario, roundLog);
    expect(entries.find((entry) => entry.id === 'opinion-CEO')).toMatchObject({ timeLabel: '00:09' });
    expect(entries.find((entry) => entry.id === 'opinion-CFO')).toMatchObject({ timeLabel: TIME_UNKNOWN });
  });

  it('내("나") 발언은 opinions[].createdAt 기준으로 경과 시간을 보여준다', () => {
    let session = selectScenario('scripted'); // startedAt = T0
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> OPINIONS
    session = reduce(session, { type: 'NEXT_STAGE' }, T0); // -> DISCUSS
    session = reduce(
      session,
      {
        type: 'SUBMIT_OPINION',
        originalText: '작은 범위로 먼저 시작합시다.',
        selectedPhraseIds: ['P1'],
        confirmedConditionIds: [],
      },
      T0 + 20_000,
    );

    const entries = buildMinutes(session, scenario, []);
    expect(entries.find((entry) => entry.id === 'my-opinion')).toMatchObject({
      speaker: 'PARTICIPANT',
      timeLabel: '00:20',
    });
  });
});
