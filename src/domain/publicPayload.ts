// 관람 뷰(P1)로 내보낼 수 있는 공개 payload를 P0에서부터 순수 함수로 고정한다.
// CLAUDE_IMPLEMENTATION.md 3장 "공개 payload" 두 문단: 세션ID·revision·stage·공개
// 안건명·사전 승인된 임원 의견/반응 ID·참가자가 확인한 조건의 사전 작성 라벨·최종
// 확정 집계·결론만 허용한다. 발언 원문·draft·AI 초안·원문을 인용한 임원 문장은
// 화면에서 감추는 것이 아니라 이 함수가 애초에 만들지 않는다.

import { collectConfirmedConditionIds } from '../components/opinionConditions';
import type { Scenario } from '../content/types';
import type { Session, SessionOutcome, SessionStage } from './types';
import { tally, type TallyResult } from './voting';

export type ParticipantStatus = 'discussing' | 'voting' | 'done';

export interface PublicPayload {
  sessionId: string;
  revision: number;
  stage: SessionStage;
  scenarioTitle: string | null;
  memberOpinionIds: string[];
  reactionIds: string[];
  confirmedConditionLabels: string[];
  tally: TallyResult | null;
  outcome: SessionOutcome;
  participantStatus: ParticipantStatus;
}

const STAGE_ORDER: readonly SessionStage[] = [
  'ATTRACT',
  'SELECT',
  'BRIEFING',
  'OPINIONS',
  'DISCUSS',
  'REACTIONS',
  'MOTION',
  'VOTE',
  'RESULT',
];

function stageIndex(stage: SessionStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** BRIEFING 단계 이상 진행되었을 때만 사전 승인된 임원 의견 ID를 공개한다. */
function selectMemberOpinionIds(session: Session, scenario: Scenario | null): string[] {
  if (!scenario || stageIndex(session.stage) < stageIndex('BRIEFING')) {
    return [];
  }
  return scenario.initialOpinions.map((opinion) => `${scenario.id}-member-opinion-${opinion.memberId}`);
}

/**
 * 참가자가 확정한 조건과 맞물려 실제로 등장한 임원 반응만 ID로 공개한다.
 * 참가자가 아직 확정하지 않은 조건, 원문 인용은 포함하지 않는다.
 */
function selectReactionIds(session: Session, scenario: Scenario | null): string[] {
  if (!scenario) {
    return [];
  }
  const confirmedIds = collectConfirmedConditionIds(session.opinions);
  return scenario.reactions
    .filter((reaction) => reaction.conditionId !== 'none' && confirmedIds.includes(reaction.conditionId))
    .map((reaction) => `${scenario.id}-reaction-${reaction.conditionId}`);
}

/** 최종 안건이 고정된 뒤에만 확정된 조건의 사전 작성 라벨을 공개한다. */
function selectConfirmedConditionLabels(session: Session, scenario: Scenario | null): string[] {
  if (!scenario || !session.finalMotion) {
    return [];
  }
  const labelById = new Map(scenario.conditions.map((condition) => [condition.id, condition.label]));
  return session.finalMotion.effectiveConditionIds
    .map((id) => labelById.get(id))
    .filter((label): label is string => Boolean(label));
}

function selectParticipantStatus(stage: SessionStage): ParticipantStatus {
  if (stage === 'RESULT') {
    return 'done';
  }
  if (stage === 'VOTE') {
    return 'voting';
  }
  return 'discussing';
}

/**
 * 세션·시나리오에서 관람 뷰로 내보내도 되는 값만 골라낸다.
 * scenario는 session.scenarioId가 가리키는 시나리오를 호출자가 넘겨야 한다.
 */
export function selectPublic(session: Session, scenario: Scenario | null, revision: number): PublicPayload {
  const matchedScenario = scenario && scenario.id === session.scenarioId ? scenario : null;
  const isResult = session.stage === 'RESULT';
  return {
    sessionId: session.sessionId,
    revision,
    stage: session.stage,
    scenarioTitle: matchedScenario ? matchedScenario.title : null,
    memberOpinionIds: selectMemberOpinionIds(session, matchedScenario),
    reactionIds: selectReactionIds(session, matchedScenario),
    confirmedConditionLabels: selectConfirmedConditionLabels(session, matchedScenario),
    tally: isResult ? tally(session.ballots) : null,
    outcome: isResult ? session.outcome : null,
    participantStatus: selectParticipantStatus(session.stage),
  };
}
