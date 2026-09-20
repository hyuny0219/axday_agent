// 세션 상태 전이. CLAUDE_IMPLEMENTATION.md 3장 상태표와 "시간 만료·리셋" 절을 그대로
// 따르는 순수 reducer. 시계·무입력 판정(언제 EXPIRE/IDLE_RESET을 보낼지)은 이 파일의
// 책임이 아니다(T07). 이 파일은 주어진 action을 받아 상태를 결정적으로 바꿀 뿐이다.

import type { ExecMemberId, Scenario } from '../content/types';
import { findConflicts } from './conditions';
import type { AssistantActionEvent } from './assistantLog';
import { encodeAssistantLogEntry } from './assistantLog';
import { EMPTY_DRAFT_STATE } from './draft';
import { freezeMotion, freezeOriginal } from './motion';
import type {
  Ballot,
  Opinion,
  PendingVote,
  RoleStatus,
  Session,
  SessionMode,
  Statement,
  StatementStage,
} from './types';
import {
  EXEC_MEMBER_ORDER,
  castParticipant,
  decideBoard,
  fillMissingBallots,
  tally,
} from './voting';

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
  | { type: 'IDLE_RESET'; nextSessionId: string }
  | { type: 'OPERATOR_RESET'; nextSessionId: string }
  | { type: 'MARK_SUMMARY_SHOWN' }
  | { type: 'RECORD_ASSISTANT_ACTION'; entry: AssistantActionEvent }
  | { type: 'SET_MODE'; mode: SessionMode }
  | {
      type: 'APPEND_STATEMENTS';
      stage: StatementStage;
      statements: Statement[];
      baseRevision: number;
    }
  | { type: 'SET_ROLE_STATUS'; roleId: ExecMemberId; status: RoleStatus }
  | { type: 'RECORD_EXEC_BALLOT'; ballot: Ballot }
  | { type: 'MARK_EXEC_UNAVAILABLE'; roleId: ExecMemberId; reason: string }
  | { type: 'FINALIZE_RESULT' };

const IDLE_ROLE_STATUS: Record<ExecMemberId, RoleStatus> = {
  CEO: 'idle',
  CFO: 'idle',
  CAIO: 'idle',
  CISO: 'idle',
};

const PENDING_ROLE_STATUS: Record<ExecMemberId, RoleStatus> = {
  CEO: 'pending',
  CFO: 'pending',
  CAIO: 'pending',
  CISO: 'pending',
};

/** 새 sessionId. reducer 밖(dispatch하는 쪽)에서만 부른다 — reducer는 난수를 만들지 않는다. */
export function newSessionId(): string {
  return crypto.randomUUID();
}

/** 새 세션(참가자 이전 값 없음)을 만든다. ATTRACT에서 시작하고 기본 모드는 scripted다.
 * sessionId를 넘기지 않으면 새로 만든다(앱 초기화용). reducer는 항상 액션에 실린 ID를 넘긴다. */
export function createInitialSession(now: number, sessionId: string = newSessionId()): Session {
  return {
    stage: 'ATTRACT',
    sessionId,
    mode: 'scripted',
    scenarioId: null,
    startedAt: null,
    deadline: null,
    lastActivityAt: now,
    draft: EMPTY_DRAFT_STATE,
    opinions: [],
    followUpUsed: false,
    assistantActions: [],
    transcript: { revision: 0, statements: [] },
    roleStatus: { ...IDLE_ROLE_STATUS },
    execBallotsPending: false,
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

const EXPIRE_REASON = '시간 만료로 응답을 받지 못했습니다.';
const FINALIZE_TIMEOUT_REASON = '응답 시간 안에 표를 받지 못했습니다.';

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
      // 화면에서 막더라도 엔진에서 다시 검사한다: 병합된 확정 조건 집합에 충돌쌍이
      // 남아 있으면 고정을 거부하고 경고만 남긴다(구현 지시서 4장 "충돌 조건은 동시
      // 확정할 수 없도록 한다").
      if (findConflicts(action.scenario, action.confirmedConditionIds).length > 0) {
        return ignore(session, '충돌하는 조건이 함께 있어 최종 안건을 고정할 수 없습니다.');
      }
      const finalMotion = freezeMotion(action.scenario, action.confirmedConditionIds, now);
      // live 모드는 임원표를 비워 두고 roleStatus를 pending으로 둔다: 실제 모델 호출은
      // 이 리듀서 밖(서비스 계층)에서 RECORD_EXEC_BALLOT/MARK_EXEC_UNAVAILABLE로 채운다.
      // 실패한 역할을 몰래 scripted 표로 바꾸지 않는다(AGENT_BOARDROOM_SPEC.md 6장).
      if (session.mode === 'live') {
        return withNoWarnings({
          ...session,
          stage: 'VOTE',
          finalMotion,
          ballots: [],
          roleStatus: { ...PENDING_ROLE_STATUS },
          execBallotsPending: true,
          lastActivityAt: now,
        });
      }
      const ballots = decideBoard(action.scenario, finalMotion);
      return withNoWarnings({
        ...session,
        stage: 'VOTE',
        finalMotion,
        ballots,
        execBallotsPending: false,
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
      const withParticipant = withConfirmedAtNow(
        castParticipant(session.ballots, session.finalMotion, session.pendingVote, session.mode),
        now,
      );
      const execBallotCount = withParticipant.filter((b) => b.memberId !== 'PARTICIPANT').length;
      // live에서는 참가자표만 기록한다. 4표가 모두 이미 있으면 즉시 집계하고, 아니면
      // VOTE에 머물며 FINALIZE_RESULT(늦어도 8초/deadline 안)를 기다린다.
      if (execBallotCount < EXEC_MEMBER_ORDER.length) {
        return withNoWarnings({
          ...session,
          ballots: withParticipant,
          pendingVote: null,
          lastActivityAt: now,
        });
      }
      return withNoWarnings({
        ...session,
        stage: 'RESULT',
        ballots: withParticipant,
        outcome: tally(withParticipant).outcome,
        pendingVote: null,
        execBallotsPending: false,
        lastActivityAt: now,
      });
    }

    case 'EXPIRE': {
      if (session.stage === 'ATTRACT' || session.stage === 'RESULT') {
        return ignore(session, '만료는 진행 중인 세션에만 적용됩니다.');
      }
      if (session.finalMotion) {
        const ballots = fillMissingBallots(
          session.ballots,
          session.finalMotion,
          now,
          EXPIRE_REASON,
        );
        return withNoWarnings({
          ...session,
          stage: 'RESULT',
          ballots,
          outcome: tally(ballots).outcome,
          pendingVote: null,
          execBallotsPending: false,
          lastActivityAt: now,
        });
      }
      const finalMotion = freezeOriginal(action.scenario, now);
      // scripted는 규칙대로 임원표를 채우고, live는 호출이 없었으므로 그대로
      // UNCAST로 채운다(실패한 역할을 몰래 scripted 표로 바꾸지 않는다).
      const boardBallots = session.mode === 'live' ? [] : decideBoard(action.scenario, finalMotion);
      const ballots = fillMissingBallots(boardBallots, finalMotion, now, EXPIRE_REASON);
      return withNoWarnings({
        ...session,
        stage: 'RESULT',
        finalMotion,
        ballots,
        outcome: tally(ballots).outcome,
        expiredWithoutMotion: true,
        pendingVote: null,
        execBallotsPending: false,
        lastActivityAt: now,
      });
    }

    case 'IDLE_RESET':
    case 'OPERATOR_RESET': {
      // 새 sessionId는 액션에 실려 온다. 같은 (session, action, now)를 두 번 reduce해도 같은
      // 결과가 나오도록 reducer 안에서 난수를 만들지 않는다.
      return createInitialSession(now, action.nextSessionId);
    }

    case 'MARK_SUMMARY_SHOWN': {
      // 지시서 5장: BRIEFING에서 자동 정리 카드가 실제 렌더되면 세션당 한 번 기록한다.
      // 자동 표시는 참가자 활동이 아니므로 lastActivityAt을 갱신하지 않는다.
      if (session.stage !== 'BRIEFING') {
        return ignore(session, '자료 정리 표시 기록은 BRIEFING 단계에서만 가능합니다.');
      }
      if (session.assistantActions.includes('SUMMARY_SHOWN')) {
        return ignore(session, '자료 정리 표시는 세션당 한 번만 기록합니다.');
      }
      return withNoWarnings({
        ...session,
        assistantActions: [...session.assistantActions, 'SUMMARY_SHOWN'],
      });
    }

    case 'RECORD_ASSISTANT_ACTION': {
      if (session.stage !== 'DISCUSS' && session.stage !== 'REACTIONS') {
        return ignore(session, 'AI 비서실장 기록은 DISCUSS·REACTIONS 단계에서만 가능합니다.');
      }
      // requestedAt은 여기(reduce)에 주입된 now에서만 나온다 — AssistantPanel이 자체
      // 시계를 만들지 않는다(시간의 유일한 출처는 Clock).
      return withNoWarnings({
        ...session,
        assistantActions: [...session.assistantActions, encodeAssistantLogEntry(action.entry, now)],
        lastActivityAt: now,
      });
    }

    case 'SET_MODE': {
      // 세션 시작 전(ATTRACT/SELECT)에만 live/scripted를 고정한다(지시서 6장
      // "세션 시작 전에 live/scripted 모드를 고정하고 화면에 표시한다").
      if (session.stage !== 'ATTRACT' && session.stage !== 'SELECT') {
        return ignore(session, '진행 방식 설정은 ATTRACT·SELECT 단계에서만 가능합니다.');
      }
      return withNoWarnings({ ...session, mode: action.mode, lastActivityAt: now });
    }

    case 'APPEND_STATEMENTS': {
      // revision 불일치(동시에 다른 라운드가 먼저 반영됨 등)는 조용히 무시하고 경고만
      // 남긴다. action.stage는 호출자가 붙이는 태그일 뿐 검증하지 않지만, 이미 끝난 세션
      // (RESULT)이나 시작 전 세션에는 늦게 온 발언을 붙이지 않는다.
      if (session.stage === 'RESULT' || session.stage === 'ATTRACT' || session.stage === 'SELECT') {
        return ignore(session, '진행 중이 아닌 세션에는 발언을 반영하지 않습니다.');
      }
      if (action.baseRevision !== session.transcript.revision) {
        return ignore(session, '회의 기록 revision이 일치하지 않아 발언을 반영할 수 없습니다.');
      }
      return withNoWarnings({
        ...session,
        transcript: {
          revision: session.transcript.revision + 1,
          statements: [...session.transcript.statements, ...action.statements],
        },
        // 모델 응답 도착은 참가자 활동이 아니므로 lastActivityAt(무입력 시계)을 건드리지 않는다.
      });
    }

    case 'SET_ROLE_STATUS': {
      return withNoWarnings({
        ...session,
        roleStatus: { ...session.roleStatus, [action.roleId]: action.status },
      });
    }

    case 'RECORD_EXEC_BALLOT': {
      if (!session.finalMotion) {
        return ignore(session, '최종 안건이 없어 임원 표를 기록할 수 없습니다.');
      }
      if (session.stage === 'RESULT') {
        return ignore(session, '이미 결과가 확정되어 임원 표를 반영할 수 없습니다.');
      }
      const { ballot } = action;
      if (!EXEC_MEMBER_ORDER.includes(ballot.memberId as ExecMemberId)) {
        return ignore(session, '임원이 아닌 역할의 표는 반영할 수 없습니다.');
      }
      if (ballot.motionHash !== session.finalMotion.hash) {
        return ignore(session, '안건 해시가 일치하지 않는 임원 표는 반영할 수 없습니다.');
      }
      if (session.ballots.some((b) => b.memberId === ballot.memberId)) {
        return ignore(session, '이미 기록된 역할의 표는 중복으로 반영할 수 없습니다.');
      }
      const ballots = [...session.ballots, ballot];
      const execBallotCount = ballots.filter((b) => b.memberId !== 'PARTICIPANT').length;
      return withNoWarnings({
        ...session,
        ballots,
        roleStatus: { ...session.roleStatus, [ballot.memberId as ExecMemberId]: 'answered' },
        execBallotsPending: execBallotCount < EXEC_MEMBER_ORDER.length,
        // 임원 표 도착은 참가자 활동이 아니므로 lastActivityAt을 갱신하지 않는다.
      });
    }

    case 'MARK_EXEC_UNAVAILABLE': {
      if (session.stage === 'RESULT') {
        return ignore(session, '이미 결과가 확정되어 역할 상태를 바꿀 수 없습니다.');
      }
      if (session.stage === 'VOTE' && session.finalMotion) {
        if (session.ballots.some((b) => b.memberId === action.roleId)) {
          return ignore(session, '이미 기록된 역할의 표는 다시 바꿀 수 없습니다.');
        }
        const ballot: Ballot = {
          memberId: action.roleId,
          motionId: session.finalMotion.id,
          motionHash: session.finalMotion.hash,
          vote: 'UNCAST',
          source: 'unavailable',
          unavailableReason: action.reason,
          confirmedAt: now,
        };
        const ballots = [...session.ballots, ballot];
        const execBallotCount = ballots.filter((b) => b.memberId !== 'PARTICIPANT').length;
        return withNoWarnings({
          ...session,
          ballots,
          roleStatus: { ...session.roleStatus, [action.roleId]: 'failed' },
          execBallotsPending: execBallotCount < EXEC_MEMBER_ORDER.length,
        });
      }
      return withNoWarnings({
        ...session,
        roleStatus: { ...session.roleStatus, [action.roleId]: 'failed' },
      });
    }

    case 'FINALIZE_RESULT': {
      // 참가자 확정과 함께 기다리다 8초 또는 deadline을 넘기면 호출자가 이 액션을
      // 보낸다. 미도착 임원은 UNCAST+사유로 채우고 그 자리에서 집계를 확정한다.
      if (session.stage !== 'VOTE') {
        return ignore(session, '결과 확정은 VOTE 단계에서만 가능합니다.');
      }
      if (!session.finalMotion) {
        return ignore(session, '확정할 최종 안건이 없어 결과를 확정할 수 없습니다.');
      }
      const ballots = fillMissingBallots(
        session.ballots,
        session.finalMotion,
        now,
        FINALIZE_TIMEOUT_REASON,
      );
      return withNoWarnings({
        ...session,
        stage: 'RESULT',
        ballots,
        outcome: tally(ballots).outcome,
        pendingVote: null,
        execBallotsPending: false,
        lastActivityAt: now,
      });
    }

    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
