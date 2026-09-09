// 표결 엔진이 쓰는 데이터 형태. CLAUDE_IMPLEMENTATION.md 6장 인터페이스를 그대로 옮기되
// 이 카드(T04)에서는 표결 평가·집계에 필요한 타입만 추가한다.
// T06에서 세션 상태(Session)와 관련 타입을 추가한다.

import type { ExecMemberId, Vote } from '../content/types';
import type { DraftState } from './draft';

export type MemberId = ExecMemberId | 'PARTICIPANT';

export interface Motion {
  id: string;
  scenarioId: string;
  kind: 'original' | 'amended';
  conditionIds: string[];
  baseConditionIds: string[];
  effectiveConditionIds: string[];
  executionMode: string;
  frozenAt: number;
}

export interface Ballot {
  memberId: MemberId;
  motionId: string;
  vote: Vote;
  confirmedAt: number | null;
}

/** DISCUSS/REACTIONS 단계에서 참가자가 전달한 의견 한 건의 기록. */
export interface Opinion {
  id: string;
  originalText: string;
  selectedPhraseIds: string[];
  confirmedConditionIds: string[];
  createdAt: number;
}

export type SessionStage =
  | 'ATTRACT'
  | 'SELECT'
  | 'BRIEFING'
  | 'OPINIONS'
  | 'DISCUSS'
  | 'REACTIONS'
  | 'MOTION'
  | 'VOTE'
  | 'RESULT';

export type SessionOutcome = 'PASS' | 'HOLD' | 'REJECT' | null;

/** 참가자가 아직 확정하지 않고 라디오만 선택한 값. 확정 전에는 표로 집계하지 않는다. */
export type PendingVote = Exclude<Vote, 'UNCAST'>;

export interface Session {
  stage: SessionStage;
  sessionId: string;
  scenarioId: string | null;
  startedAt: number | null;
  deadline: number | null;
  lastActivityAt: number;
  draft: DraftState;
  opinions: Opinion[];
  followUpUsed: boolean;
  assistantActions: string[];
  finalMotion: Motion | null;
  ballots: Ballot[];
  outcome: SessionOutcome;
  expiredWithoutMotion: boolean;
  /** CONFIRM_VOTE 전 참가자가 고른 값. 확정 전이므로 ballots에는 반영하지 않는다. */
  pendingVote: PendingVote | null;
  /** 직전 reduce 호출에서 잘못된 단계의 액션을 무시했을 때 남기는 경고. 매 호출마다 새로 채워진다. */
  warnings: string[];
}
