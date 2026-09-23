// 표결 엔진이 쓰는 데이터 형태. CLAUDE_IMPLEMENTATION.md 6장 인터페이스를 그대로 옮기되
// 이 카드(T04)에서는 표결 평가·집계에 필요한 타입만 추가한다.
// T06에서 세션 상태(Session)와 관련 타입을 추가한다.
// T26에서 live 모드에 필요한 회의 기록(Transcript)·역할 상태·표 메타데이터를 더한다
// (AGENT_BOARDROOM_SPEC.md 3·5·6장). scripted 동작과 기존 필드 의미는 그대로 둔다.

import type { ExecMemberId, Vote } from '../content/types';
import type { DraftState } from './draft';

export type MemberId = ExecMemberId | 'PARTICIPANT';

/** 세션 시작 전에 고정하는 진행 방식. live는 서버 모델 호출, scripted는 사전 구성 규칙이다. */
export type SessionMode = 'live' | 'scripted';

export interface Motion {
  id: string;
  scenarioId: string;
  kind: 'original' | 'amended';
  conditionIds: string[];
  baseConditionIds: string[];
  effectiveConditionIds: string[];
  executionMode: string;
  frozenAt: number;
  /** 최종안 본문. 조건은 effectiveConditionIds로 별도 표현하므로 여기서는 안건 원문만 담는다. */
  text: string;
  /** id·text·effectiveConditionIds·executionMode를 결정적으로 해시한 값(motion.ts). */
  hash: string;
}

/** RECORD_EXEC_BALLOT·MARK_EXEC_UNAVAILABLE·FINALIZE_RESULT가 채우는 표 출처. */
export type BallotSource = 'live' | 'scripted' | 'unavailable';

export interface Ballot {
  memberId: MemberId;
  motionId: string;
  vote: Vote;
  confirmedAt: number | null;
  /** 이 표가 어떻게 만들어졌는지(실시간 모델 호출/사전 구성 규칙/미도착 자동 채움). */
  source: BallotSource;
  /** 표가 참조한 안건의 해시. 다른 motionHash의 표는 재사용하지 않는다. */
  motionHash: string;
  /** 임원 표의 짧은 판단 근거(160자 이내, 서버가 검증). */
  reason?: string;
  /** 표결 시점에도 남아 있던 우려 사항. */
  remainingConcerns?: string[];
  modelId?: string;
  promptVersion?: string;
  requestId?: string;
  /** source가 'unavailable'일 때 UNCAST 사유(예: 응답 지연·오류). */
  unavailableReason?: string;
}

export type StatementStage = 'OPINIONS' | 'REACTIONS' | 'FOLLOWUP';

/** live 모드에서 임원 에이전트 한 명이 낸 발언 한 건. 참가자 원문/AI 초안과는 별개다. */
export interface Statement {
  id: string;
  roleId: ExecMemberId;
  stage: StatementStage;
  text: string;
  evidenceIds: string[];
  referencedStatementIds: string[];
  concerns: string[];
  suggestedConditionIds: string[];
  source: 'live' | 'scripted';
  createdAt: number;
}

/** 세션 전체의 회의 기록. revision은 낙관적 동시성 검사에 쓴다(불일치 시 무시). */
export interface Transcript {
  revision: number;
  statements: Statement[];
}

/** 임원 한 명의 현재 라운드 응답 상태. idle은 아직 호출 전, pending은 호출 중이다. */
export type RoleStatus = 'idle' | 'pending' | 'answered' | 'failed';

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
  /** 세션 시작 전 SET_MODE로 고정하는 진행 방식(기본 scripted). 시작 후에는 바꾸지 않는다. */
  mode: SessionMode;
  scenarioId: string | null;
  startedAt: number | null;
  draft: DraftState;
  opinions: Opinion[];
  followUpUsed: boolean;
  assistantActions: string[];
  /** live 모드 회의 기록. scripted 모드에서는 비어 있는 채로 둔다. */
  transcript: Transcript;
  /** 임원별 현재 라운드 응답 상태. */
  roleStatus: Record<ExecMemberId, RoleStatus>;
  /** VOTE 단계에서 아직 도착하지 않은 임원 표가 있으면 true(live 모드 전용). */
  execBallotsPending: boolean;
  finalMotion: Motion | null;
  ballots: Ballot[];
  outcome: SessionOutcome;
  expiredWithoutMotion: boolean;
  /** CONFIRM_VOTE 전 참가자가 고른 값. 확정 전이므로 ballots에는 반영하지 않는다. */
  pendingVote: PendingVote | null;
  /** 직전 reduce 호출에서 잘못된 단계의 액션을 무시했을 때 남기는 경고. 매 호출마다 새로 채워진다. */
  warnings: string[];
}
