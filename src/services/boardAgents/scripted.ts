// 사전 구성(scripted) 임원 에이전트 어댑터(AGENT_BOARDROOM_SPEC.md 1장 "scripted 모드는
// 개발·리허설·장애 대안"). 실제 모델을 부르지 않고 시나리오 데이터(initialOpinions·reactions)에서
// 발언을 만들고, 최종 표는 기존 결정적 표결 엔진(decideBoard)을 그대로 쓴다. 새로운 사실·수치는
// 만들지 않고 이미 시나리오에 있는 문장만 옮긴다.
//
// 모든 메서드는 Promise.resolve() 이후(마이크로태스크)에 값을 만든다 — 호출 시점에 미리 계산해
// 늦게 취소된 값이 새지 않게 하고, signal이 이미 abort된 요청은 즉시 거절한다.

import type { ExecMemberId } from '../../content/types';
import type { Statement, StatementStage } from '../../domain/types';
import { EXEC_MEMBER_ORDER, decideBoard } from '../../domain/voting';
import type {
  BallotOutcome,
  BoardAgentsAdapter,
  BoardAgentsContext,
  StatementOutcome,
} from './types';

const NO_SCRIPTED_CONTENT = '이 안건에는 사전 구성된 임원 발언이 없습니다.';
const NO_FINAL_MOTION = '고정된 최종 안건이 없어 표결할 수 없습니다.';

/** build()를 마이크로태스크 뒤에 실행한다. 이미 abort된 signal은 즉시 거절하고, build() 실행
 * 직전에도 한 번 더 확인해 그 사이 취소된 요청이 값을 만들지 않게 한다. */
function resolveIfActive<T>(build: () => T, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
  }
  return Promise.resolve().then(() => {
    if (signal.aborted) {
      throw new DOMException('요청이 취소되었습니다.', 'AbortError');
    }
    return build();
  });
}

/** 지금까지 참가자가 확정한 조건 ID 전체(DISCUSS·REACTIONS 두 라운드에 걸쳐 누적될 수 있다). */
function confirmedConditionIds(ctx: BoardAgentsContext): Set<string> {
  return new Set(ctx.session.opinions.flatMap((opinion) => opinion.confirmedConditionIds));
}

function buildStatement(
  roleId: ExecMemberId,
  stage: StatementStage,
  text: string,
  evidenceIds: string[],
): Statement {
  return {
    // id는 세션·단계·역할로만 결정하고, createdAt은 placeholder(0)로 둔다 — runner.ts가
    // dispatch 직전 주입된 Clock으로 덮어쓴다(시간의 유일한 출처를 지킨다).
    id: `scripted-${stage}-${roleId}`,
    roleId,
    stage,
    text,
    evidenceIds,
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds: [],
    source: 'scripted',
    createdAt: 0,
  };
}

/** 시나리오 initialOpinions에서 역할별 발언을 그대로 옮긴다. 항목이 없는 역할은 failed로
 * 남긴다(예: 콘텐츠 확정 전 준비 중 안건). */
function buildInitialOpinions(ctx: BoardAgentsContext): StatementOutcome[] {
  return EXEC_MEMBER_ORDER.map((roleId) => {
    const opinion = ctx.scenario.initialOpinions.find((item) => item.memberId === roleId);
    if (!opinion) {
      return { roleId, status: 'failed', failReason: NO_SCRIPTED_CONTENT };
    }
    return {
      roleId,
      status: 'answered',
      statement: buildStatement(roleId, 'OPINIONS', opinion.text, opinion.evidenceIds),
    };
  });
}

/** 시나리오 reactions에서 역할별 발언을 고른다. 참가자가 확정한 조건과 짝지어진 반응을
 * 우선하고, 없으면 그 역할의 첫 반응으로 대신한다. 둘 다 없으면 failed로 남긴다. */
function buildReactionStatements(ctx: BoardAgentsContext, stage: StatementStage): StatementOutcome[] {
  const confirmed = confirmedConditionIds(ctx);
  return EXEC_MEMBER_ORDER.map((roleId) => {
    const roleReactions = ctx.scenario.reactions.filter((reaction) => reaction.memberId === roleId);
    const matched = roleReactions.find((reaction) => confirmed.has(reaction.conditionId));
    const reaction = matched ?? roleReactions[0];
    if (!reaction) {
      return { roleId, status: 'failed', failReason: NO_SCRIPTED_CONTENT };
    }
    return {
      roleId,
      status: 'answered',
      statement: buildStatement(roleId, stage, reaction.text, []),
    };
  });
}

function buildFinalVotes(ctx: BoardAgentsContext): BallotOutcome[] {
  const motion = ctx.session.finalMotion;
  if (!motion) {
    return EXEC_MEMBER_ORDER.map((roleId) => ({ roleId, status: 'failed', failReason: NO_FINAL_MOTION }));
  }
  return decideBoard(ctx.scenario, motion).map((ballot) => ({
    roleId: ballot.memberId as ExecMemberId,
    status: 'answered',
    ballot,
  }));
}

/** 사전 구성 임원 에이전트 어댑터를 만든다. 네트워크 호출 없이 시나리오 데이터와 결정적
 * 표결 규칙만 쓴다. */
export function createScriptedBoardAgentsAdapter(): BoardAgentsAdapter {
  return {
    initialOpinions(ctx) {
      return resolveIfActive(() => buildInitialOpinions(ctx), ctx.signal);
    },
    reactions(ctx) {
      return resolveIfActive(() => buildReactionStatements(ctx, 'REACTIONS'), ctx.signal);
    },
    followUp(ctx) {
      return resolveIfActive(() => buildReactionStatements(ctx, 'FOLLOWUP'), ctx.signal);
    },
    finalVotes(ctx) {
      return resolveIfActive(() => buildFinalVotes(ctx), ctx.signal);
    },
  };
}

export const scriptedBoardAgentsAdapter: BoardAgentsAdapter = createScriptedBoardAgentsAdapter();
