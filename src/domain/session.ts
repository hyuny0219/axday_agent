// 세션 상태 전이. CLAUDE_IMPLEMENTATION.md 3장 상태표와 "시간 만료·리셋" 절을 그대로
// 따르는 순수 reducer. 시계·무입력 판정(언제 EXPIRE/IDLE_RESET을 보낼지)은 이 파일의
// 책임이 아니다(T07). 이 파일은 주어진 action을 받아 상태를 결정적으로 바꿀 뿐이다.

import type { Scenario } from '../content/types';
import { EMPTY_DRAFT_STATE } from './draft';
import { freezeMotion, freezeOriginal } from './motion';
import type { Ballot, Opinion, PendingVote, Session } from './types';
import { castParticipant, decideBoard, tally } from './voting';

export const SESSION_DURATION_MS = 240_000;

export type SessionAction =
  | { type: 'START' }
  | { type: 'SELECT_SCENARIO'; scenarioId: string }
  | { type: 'NEXT_STAGE' }
  | {
      type: 'SUBMIT_OPINION';
      originalText: string;
      selectedPhraseIds: string[];
      confirmedConditionIds: string[];
    }
  | {
      type: 'SUBMIT_FOLLOWUP';
      originalText: string;
      selectedPhraseIds: string[];
      confirmedConditionIds: string[];
    }
  | { type: 'KEEP_PREVIOUS' }
  | { type: 'FREEZE_MOTION'; scenario: Scenario; confirmedConditionIds: string[] }
  | { type: 'SELECT_VOTE'; vote: PendingVote }
  | { type: 'CONFIRM_VOTE' }
  | { type: 'EXPIRE'; scenario: Scenario }
  | { type: 'IDLE_RESET' }
  | { type: 'OPERATOR_RESET' }
  | { type: 'MARK_SUMMARY_SHOWN' }
  | { type: 'RECORD_ASSISTANT_ACTION'; label: string };

function createSessionId(): string {
  return crypto.randomUUID();
}

/** 새 세션(참가자 이전 값 없음)을 만든다. ATTRACT에서 시작한다. */
export function createInitialSession(now: number): Session {
  return {
    stage: 'ATTRACT',
    sessionId: createSessionId(),
    scenarioId: null,
    startedAt: null,
    deadline: null,
    lastActivityAt: now,
    draft: EMPTY_DRAFT_STATE,
    opinions: [],
    followUpUsed: false,
    assistantActions: [],
    finalMotion: null,
    ballots: [],
    outcome: null,
    expiredWithoutMotion: false,
    pendingVote: null,
    warnings: [],
  };
}

function ignore(session: Session, warning: string): Session {
  return { ...session, warnings: [warning] };
}

function withNoWarnings<T extends Session>(session: T): T {
  return { ...session, warnings: [] };
}

/**
 * castParticipant가 내부에서 Date.now()로 채우는 confirmedAt을 reducer의 `now` 인자로
 * 덮어써 순수성을 보장한다(동일 입력에 대해 항상 동일한 출력을 내도록 함).
 */
function withConfirmedAtNow(ballots: Ballot[], now: number): Ballot[] {
  return ballots.map((b) => (b.memberId === 'PARTICIPANT' ? { ...b, confirmedAt: now } : b));
}

/** 참가자 표가 아직 없으면 UNCAST로 채워 5석을 완성한다. */
function ensureParticipantUncast(ballots: Ballot[], motionId: string, now: number): Ballot[] {
  if (ballots.some((b) => b.memberId === 'PARTICIPANT')) {
    return ballots;
  }
  return withConfirmedAtNow(castParticipant(ballots, motionId, 'UNCAST'), now);
}

/**
 * 세션 상태 전이를 순수하게 계산한다. 잘못된 단계의 액션은 상태를 바꾸지 않고
 * `warnings`에 한 줄만 남긴다(직전 호출의 warnings는 매번 새로 비운다).
 */
export function reduce(session: Session, action: SessionAction, now: number): Session {
  switch (action.type) {
    case 'START': {
      if (session.stage !== 'ATTRACT') {
        return ignore(session, '체험 시작은 ATTRACT 단계에서만 가능합니다.');
      }
      return withNoWarnings({ ...session, stage: 'SELECT', lastActivityAt: now });
    }

    case 'SELECT_SCENARIO': {
      if (session.stage !== 'SELECT') {
        return ignore(session, '안건 선택은 SELECT 단계에서만 가능합니다.');
      }
      return withNoWarnings({
        ...session,
        stage: 'BRIEFING',
        scenarioId: action.scenarioId,
        startedAt: now,
        deadline: now + SESSION_DURATION_MS,
        lastActivityAt: now,
      });
    }

    case 'NEXT_STAGE': {
      if (session.stage === 'BRIEFING') {
        return withNoWarnings({ ...session, stage: 'OPINIONS', lastActivityAt: now });
      }
      if (session.stage === 'OPINIONS') {
        return withNoWarnings({ ...session, stage: 'DISCUSS', lastActivityAt: now });
      }
      return ignore(session, '이 단계에서는 다음 단계로 넘어갈 수 없습니다.');
    }

    case 'SUBMIT_OPINION': {
      if (session.stage !== 'DISCUSS') {
        return ignore(session, '의견 전달은 DISCUSS 단계에서만 가능합니다.');
      }
      const opinion: Opinion = {
        id: `${session.sessionId}-opinion-${session.opinions.length + 1}`,
        originalText: action.originalText,
        selectedPhraseIds: [...action.selectedPhraseIds],
        confirmedConditionIds: [...action.confirmedConditionIds],
        createdAt: now,
      };
      return withNoWarnings({
        ...session,
        stage: 'REACTIONS',
        opinions: [...session.opinions, opinion],
        draft: EMPTY_DRAFT_STATE,
        lastActivityAt: now,
      });
    }

    case 'SUBMIT_FOLLOWUP': {
      if (session.stage !== 'REACTIONS' || session.followUpUsed) {
        return ignore(session, '후속 의견 전달은 REACTIONS 단계에서 한 번만 가능합니다.');
      }
      const opinion: Opinion = {
        id: `${session.sessionId}-opinion-${session.opinions.length + 1}`,
        originalText: action.originalText,
        selectedPhraseIds: [...action.selectedPhraseIds],
        confirmedConditionIds: [...action.confirmedConditionIds],
        createdAt: now,
      };
      return withNoWarnings({
        ...session,
        stage: 'MOTION',
        opinions: [...session.opinions, opinion],
        draft: EMPTY_DRAFT_STATE,
        followUpUsed: true,
        lastActivityAt: now,
      });
    }

    case 'KEEP_PREVIOUS': {
      if (session.stage !== 'REACTIONS' || session.followUpUsed) {
        return ignore(session, '이 의견으로 마무리는 REACTIONS 단계에서 한 번만 가능합니다.');
      }
      return withNoWarnings({
        ...session,
        stage: 'MOTION',
        followUpUsed: true,
        lastActivityAt: now,
      });
    }

    case 'FREEZE_MOTION': {
      if (session.stage !== 'MOTION' || session.finalMotion !== null) {
        return ignore(session, '최종 안건 고정은 MOTION 단계에서 한 번만 가능합니다.');
      }
      const finalMotion = freezeMotion(action.scenario, action.confirmedConditionIds, now);
      const ballots = decideBoard(action.scenario, finalMotion);
      return withNoWarnings({
        ...session,
        stage: 'VOTE',
        finalMotion,
        ballots,
        lastActivityAt: now,
      });
    }

    case 'SELECT_VOTE': {
      if (session.stage !== 'VOTE') {
        return ignore(session, '표 선택은 VOTE 단계에서만 가능합니다.');
      }
      return withNoWarnings({ ...session, pendingVote: action.vote, lastActivityAt: now });
    }

    case 'CONFIRM_VOTE': {
      if (session.stage !== 'VOTE') {
        return ignore(session, '표결 확정은 VOTE 단계에서만 가능합니다.');
      }
      if (!session.finalMotion) {
        return ignore(session, '확정할 최종 안건이 없어 표결을 확정할 수 없습니다.');
      }
      if (session.ballots.some((b) => b.memberId === 'PARTICIPANT')) {
        return ignore(session, '이미 확정된 표는 다시 확정할 수 없습니다.');
      }
      if (session.pendingVote === null) {
        return ignore(session, '선택한 표가 없어 확정할 수 없습니다.');
      }
      const ballots = withConfirmedAtNow(
        castParticipant(session.ballots, session.finalMotion.id, session.pendingVote),
        now,
      );
      return withNoWarnings({
        ...session,
        stage: 'RESULT',
        ballots,
        outcome: tally(ballots).outcome,
        pendingVote: null,
        lastActivityAt: now,
      });
    }

    case 'EXPIRE': {
      if (session.stage === 'ATTRACT' || session.stage === 'RESULT') {
        return ignore(session, '만료는 진행 중인 세션에만 적용됩니다.');
      }
      if (session.finalMotion) {
        const ballots = ensureParticipantUncast(session.ballots, session.finalMotion.id, now);
        return withNoWarnings({
          ...session,
          stage: 'RESULT',
          ballots,
          outcome: tally(ballots).outcome,
          pendingVote: null,
          lastActivityAt: now,
        });
      }
      const finalMotion = freezeOriginal(action.scenario, now);
      const boardBallots = decideBoard(action.scenario, finalMotion);
      const ballots = ensureParticipantUncast(boardBallots, finalMotion.id, now);
      return withNoWarnings({
        ...session,
        stage: 'RESULT',
        finalMotion,
        ballots,
        outcome: tally(ballots).outcome,
        expiredWithoutMotion: true,
        pendingVote: null,
        lastActivityAt: now,
      });
    }

    case 'IDLE_RESET':
    case 'OPERATOR_RESET': {
      return createInitialSession(now);
    }

    case 'MARK_SUMMARY_SHOWN': {
      if (session.stage !== 'RESULT') {
        return ignore(session, '자료 정리 표시는 RESULT 단계에서만 가능합니다.');
      }
      return withNoWarnings({
        ...session,
        assistantActions: [...session.assistantActions, 'SUMMARY_SHOWN'],
        lastActivityAt: now,
      });
    }

    case 'RECORD_ASSISTANT_ACTION': {
      if (session.stage !== 'DISCUSS' && session.stage !== 'REACTIONS') {
        return ignore(session, 'AI 비서실장 기록은 DISCUSS·REACTIONS 단계에서만 가능합니다.');
      }
      return withNoWarnings({
        ...session,
        assistantActions: [...session.assistantActions, action.label],
        lastActivityAt: now,
      });
    }

    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
