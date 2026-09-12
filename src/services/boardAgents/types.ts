// 임원 에이전트 어댑터 인터페이스(AGENT_BOARDROOM_SPEC.md 3·6장). scripted.ts(사전 구성)와
// live.ts(서버 모델 호출)가 같은 계약을 구현해, orchestrator/runner.ts가 어느 쪽이든 동일하게
// 다룰 수 있게 한다. 이 파일은 계약만 정의하며 실제 모델을 부르지 않는다.
//
// 각 메서드는 임원 4명(CEO/CFO_CAIO/CIO/CISO) 각각에 대한 결과를 한 번에 돌려준다(병렬 호출,
// 재시도 없음). 개별 임원 실패는 그 역할만 status:'failed'로 두고 나머지에 영향을 주지 않는다
// (AGENT_BOARDROOM_SPEC.md 6장 "각 임원 호출은 병렬"). Statement.createdAt·Ballot.confirmedAt은
// 어댑터가 채우지 않는다 — runner.ts가 주입된 Clock으로 dispatch 직전에 덮어써 시간의 유일한
// 출처를 지킨다.

import type { ExecMemberId, Scenario } from '../../content/types';
import type { Ballot, Session, Statement } from '../../domain/types';

/** 세션 시작 전 고정한 진행 방식과 같은 값. 어댑터 선택은 이 값이 아니라 호출부(runner를
 * 주입하는 쪽)의 책임이다 — scripted.ts/live.ts 각각 자기 소스로 이 필드를 채워 돌려준다. */
export type BoardAgentsSource = 'scripted' | 'live';

export interface BoardAgentsContext {
  sessionId: string;
  requestId: string;
  /** 호출 시점의 세션 snapshot. 늦게 도착한 응답을 호출부가 최신 세션과 비교해 버릴 수 있도록
   * 그대로 보존한다(호출 중간에 세션이 바뀌어도 이 값 자체는 바뀌지 않는다). */
  session: Session;
  scenario: Scenario;
  /** 이 라운드에 허용된 최대 대기 시간(ms). 어댑터는 min(8000, budgetMs)를 넘겨 기다리지 않는다. */
  budgetMs: number;
  signal: AbortSignal;
}

export interface StatementOutcome {
  roleId: ExecMemberId;
  status: 'answered' | 'failed';
  /** status가 'answered'일 때만 있다. createdAt은 placeholder이며 runner.ts가 덮어쓴다. */
  statement?: Statement;
  /** status가 'failed'일 때 UI/roleStatus 기록에 쓰는 짧은 사유. */
  failReason?: string;
}

export interface BallotOutcome {
  roleId: ExecMemberId;
  status: 'answered' | 'failed';
  /** status가 'answered'일 때만 있다. confirmedAt은 placeholder이며 runner.ts가 덮어쓴다. */
  ballot?: Ballot;
  failReason?: string;
}

export interface BoardAgentsAdapter {
  /** OPINIONS 단계: 자료·역할 기준으로 임원 4명의 초기 의견을 한 번 받는다. */
  initialOpinions(ctx: BoardAgentsContext): Promise<StatementOutcome[]>;
  /** REACTIONS 단계: 참가자 발언과 동료 발언을 반영한 반응을 한 번 받는다. */
  reactions(ctx: BoardAgentsContext): Promise<StatementOutcome[]>;
  /** FOLLOWUP 단계: 후속 보완(최대 1회)을 한 번 받는다. */
  followUp(ctx: BoardAgentsContext): Promise<StatementOutcome[]>;
  /** VOTE 단계: 고정된 최종안(ctx.session.finalMotion)에 대한 최종 표를 한 번 받는다. */
  finalVotes(ctx: BoardAgentsContext): Promise<BallotOutcome[]>;
}
