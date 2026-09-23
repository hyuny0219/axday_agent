import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { createInitialSession, reduce } from '../../src/domain/session';
import { selectPublic } from '../../src/domain/publicPayload';
import type { Session } from '../../src/domain/types';

const scenario = anonBoardScenario;
const T0 = 1_700_000_000_000;

const MARKER_ORIGINAL_TEXT = 'MARKER_원문_절대_전송_금지_XYZ';
const MARKER_DRAFT_TEXT = 'MARKER_초안_절대_전송_금지_XYZ';

/** ATTRACT부터 각 단계까지 정상 경로로 진행한 세션을 만드는 헬퍼(session.test.ts와 동일한 경로). */
function sessionAtDiscuss(now = T0): Session {
  let session = createInitialSession(now);
  session = reduce(session, { type: 'START' }, now);
  session = reduce(session, { type: 'SELECT_SCENARIO', scenarioId: scenario.id }, now);
  session = reduce(session, { type: 'NEXT_STAGE' }, now);
  session = reduce(session, { type: 'NEXT_STAGE' }, now);
  return session;
}

function sessionAtReactions(now = T0, confirmedConditionIds: string[] = []): Session {
  const session = sessionAtDiscuss(now);
  return reduce(
    session,
    {
      type: 'SUBMIT_OPINION',
      originalText: MARKER_ORIGINAL_TEXT,
      selectedPhraseIds: ['P1'],
      confirmedConditionIds,
    },
    now,
  );
}

function sessionAtVote(now = T0, confirmedConditionIds: string[] = ['PILOT']): Session {
  let session = reduce(sessionAtReactions(now, confirmedConditionIds), { type: 'KEEP_PREVIOUS' }, now);
  session = reduce(session, { type: 'FREEZE_MOTION', scenario, confirmedConditionIds }, now);
  return session;
}

function sessionAtResult(now = T0): Session {
  const session = reduce(sessionAtVote(now), { type: 'SELECT_VOTE', vote: 'YES' }, now);
  return reduce(session, { type: 'CONFIRM_VOTE' }, now);
}

/** 값을 깊이 탐색해 모든 문자열(리프 값)만 모은다. */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, acc);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, acc);
    }
  }
  return acc;
}

describe('selectPublic', () => {
  it('원문·초안·미확정 표 값은 어느 필드에도 포함하지 않는다', () => {
    const session: Session = {
      ...sessionAtReactions(T0, ['PILOT']),
      draft: { selectedPhraseIds: ['P1'], draftText: MARKER_DRAFT_TEXT, dirty: true },
    };
    const payload = selectPublic(session, scenario, 1);
    const serialized = JSON.stringify(payload);
    const strings = collectStrings(payload);

    expect(serialized).not.toContain(MARKER_ORIGINAL_TEXT);
    expect(serialized).not.toContain(MARKER_DRAFT_TEXT);
    expect(strings.some((s) => s.includes(MARKER_ORIGINAL_TEXT))).toBe(false);
    expect(strings.some((s) => s.includes(MARKER_DRAFT_TEXT))).toBe(false);
  });

  it('VOTE 단계에서 SELECT_VOTE만 한 상태는 표결 결과나 선택값을 노출하지 않는다', () => {
    const session = reduce(sessionAtVote(), { type: 'SELECT_VOTE', vote: 'YES' }, T0);
    expect(session.pendingVote).toBe('YES');

    const payload = selectPublic(session, scenario, 3);
    expect(payload.tally).toBeNull();
    expect(payload.outcome).toBeNull();
    expect(payload.participantStatus).toBe('voting');
    expect(JSON.stringify(payload)).not.toContain('"pendingVote"');
  });

  it('RESULT 전에는 tally·outcome이 없다', () => {
    const stages: Session[] = [
      createInitialSession(T0),
      sessionAtDiscuss(),
      sessionAtReactions(),
      sessionAtVote(),
    ];
    for (const session of stages) {
      const payload = selectPublic(session, scenario, 1);
      expect(payload.tally).toBeNull();
      expect(payload.outcome).toBeNull();
    }
  });

  it('RESULT에서는 확정 집계와 결론을 공개한다', () => {
    const session = sessionAtResult();
    expect(session.stage).toBe('RESULT');

    const payload = selectPublic(session, scenario, 5);
    expect(payload.stage).toBe('RESULT');
    expect(payload.participantStatus).toBe('done');
    expect(payload.outcome).toBe(session.outcome);
    expect(payload.tally).not.toBeNull();
    expect(payload.tally?.outcome).toBe(session.outcome);
    expect(
      payload.tally
        ? payload.tally.counts.YES + payload.tally.counts.NO + payload.tally.counts.HOLD + payload.tally.counts.UNCAST
        : 0,
    ).toBe(5);
  });

  it('BRIEFING 이전에는 임원 의견 ID를 공개하지 않고, 그 이후에는 공개한다', () => {
    const atSelect = reduce(createInitialSession(T0), { type: 'START' }, T0);
    expect(atSelect.stage).toBe('SELECT');
    expect(selectPublic(atSelect, scenario, 1).memberOpinionIds).toEqual([]);

    const atDiscuss = sessionAtDiscuss();
    const payload = selectPublic(atDiscuss, scenario, 1);
    expect(payload.memberOpinionIds).toHaveLength(scenario.initialOpinions.length);
    expect(payload.memberOpinionIds).toEqual(
      scenario.initialOpinions.map((o) => `${scenario.id}-member-opinion-${o.memberId}`),
    );
  });

  it('확정된 조건에 대응하는 임원 반응 ID만 공개한다', () => {
    const withoutOpinion = sessionAtDiscuss();
    expect(selectPublic(withoutOpinion, scenario, 1).reactionIds).toEqual([]);

    const withConfirmedCondition = sessionAtReactions(T0, ['PILOT']);
    const payload = selectPublic(withConfirmedCondition, scenario, 1);
    expect(payload.reactionIds).toEqual([`${scenario.id}-reaction-PILOT`]);
  });

  it('최종 안건 고정 이후에만 확정 조건 라벨을 공개한다', () => {
    const atMotion = reduce(sessionAtReactions(T0, ['PILOT']), { type: 'KEEP_PREVIOUS' }, T0);
    expect(selectPublic(atMotion, scenario, 1).confirmedConditionLabels).toEqual([]);

    const votedSession = sessionAtVote(T0, ['PILOT']);
    const payload = selectPublic(votedSession, scenario, 1);
    const pilotCondition = scenario.conditions.find((c) => c.id === 'PILOT');
    expect(payload.confirmedConditionLabels).toEqual([pilotCondition?.label]);
  });

  it('scenario가 세션의 scenarioId와 다르면 시나리오 관련 필드를 비운다', () => {
    const session = sessionAtDiscuss();
    const otherScenario = { ...scenario, id: 'other-scenario' };
    const payload = selectPublic(session, otherScenario, 1);
    expect(payload.scenarioTitle).toBeNull();
    expect(payload.memberOpinionIds).toEqual([]);
  });

  it('sessionId와 revision을 그대로 전달한다', () => {
    const session = sessionAtDiscuss();
    const payload = selectPublic(session, scenario, 42);
    expect(payload.sessionId).toBe(session.sessionId);
    expect(payload.revision).toBe(42);
  });
});
