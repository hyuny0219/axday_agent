// 지난 화면 보기(T126, 2026-10-12 사용자 지시 "뒤로, 앞으로 버튼으로 조작이 가능하면 좋겠어").
// '◀ 이전'·'다음 ▶'은 세션을 되돌리지 않는다. 세션은 그대로 두고, 화면만 그 단계에 있던 때의
// 모습(스냅숏)으로 읽기 전용 렌더한다. 이 파일은 순수 함수만 둔다 — 어느 화면들을 오갈 수 있는지,
// 지난 화면의 스냅숏을 어떻게 만드는지. 표결·봉인·세션 규칙은 건드리지 않는다.
//
// 화면 목록은 BRIEFING부터다(SELECT 이전으로는 가지 않는다 — 안건 바꾸기는 운영 메뉴 '새 체험').
// REACTIONS는 '반응 듣기'와 '다시 답하기' 두 화면이다(T89). VOTE는 지금 화면일 때만 있고 지난 화면으로
// 되돌아보는 대상은 아니다(RESULT에서는 버튼이 숨고, VOTE 다음은 바로 RESULT다).

import { EXEC_MEMBER_ORDER } from './voting';
import type { RoleStatus, Session, SessionStage, StatementStage } from './types';

export type ViewPage =
  | 'BRIEFING'
  | 'OPINIONS'
  | 'DISCUSS'
  | 'REACTIONS_LISTEN'
  | 'REACTIONS_ANSWER'
  | 'MOTION';

/** 지금 화면이 될 수 있는 값(VOTE 포함). */
export type PageId = ViewPage | 'VOTE';

const PAGE_ORDER: readonly PageId[] = [
  'BRIEFING',
  'OPINIONS',
  'DISCUSS',
  'REACTIONS_LISTEN',
  'REACTIONS_ANSWER',
  'MOTION',
  'VOTE',
];

export interface PageSessionInput {
  stage: SessionStage;
  opinions: readonly unknown[];
}

/** 지금 보고 있는 실제 화면. 이전·다음 버튼이 없는 단계(ATTRACT·INTRO·SELECT·RESULT)는 null. */
export function currentPageOf(
  session: PageSessionInput,
  reactionsStep: 'listen' | 'answer',
): PageId | null {
  switch (session.stage) {
    case 'BRIEFING':
    case 'OPINIONS':
    case 'DISCUSS':
    case 'MOTION':
    case 'VOTE':
      return session.stage;
    case 'REACTIONS':
      return reactionsStep === 'answer' ? 'REACTIONS_ANSWER' : 'REACTIONS_LISTEN';
    default:
      return null;
  }
}

/** 처음부터 지금 화면까지 지나온 화면들. '다시 답하기' 화면은 실제로 답을 전달했을 때(의견 2건 이상)
 * 또는 지금 그 화면일 때만 낀다 — '답하지 않고 넘어가기'로 건너뛴 경우는 지나온 화면이 아니다. */
export function pagesUpTo(current: PageId, opinionCount: number): PageId[] {
  const currentIndex = PAGE_ORDER.indexOf(current);
  return PAGE_ORDER.slice(0, currentIndex + 1).filter(
    (page) => page !== 'REACTIONS_ANSWER' || page === current || opinionCount >= 2,
  );
}

/** '◀ 이전'이 갈 화면. 더 갈 곳이 없으면 null. */
export function prevPageOf(current: PageId, viewing: ViewPage | null, opinionCount: number): ViewPage | null {
  const pages = pagesUpTo(current, opinionCount);
  const index = pages.indexOf(viewing ?? current);
  const target = index > 0 ? pages[index - 1] : undefined;
  return target === undefined || target === 'VOTE' ? null : target;
}

/** '다음 ▶'이 갈 곳. 지금 화면에 닿으면 'CURRENT'(보기 모드 종료). 보기 모드가 아니면 null(비활성). */
export function nextPageOf(
  current: PageId,
  viewing: ViewPage | null,
  opinionCount: number,
): ViewPage | 'CURRENT' | null {
  if (viewing === null) {
    return null;
  }
  const pages = pagesUpTo(current, opinionCount);
  const target = pages[pages.indexOf(viewing) + 1];
  if (target === undefined || target === current) {
    return 'CURRENT';
  }
  return target === 'VOTE' ? 'CURRENT' : target;
}

/** 그 화면을 보던 시점에 보이던 발언 단계. 이후 라운드의 발언은 섞이지 않는다(봉인 유지). */
const VISIBLE_STATEMENT_STAGES: Record<ViewPage, readonly StatementStage[]> = {
  BRIEFING: [],
  OPINIONS: ['OPINIONS'],
  DISCUSS: ['OPINIONS'],
  REACTIONS_LISTEN: ['OPINIONS', 'REACTIONS'],
  REACTIONS_ANSWER: ['OPINIONS', 'REACTIONS'],
  MOTION: ['OPINIONS', 'REACTIONS', 'FOLLOWUP'],
};

/** live에서 그 화면이 보여 주는 라운드(임원 응답 상태를 읽을 단계). */
const ROUND_OF_PAGE: Partial<Record<ViewPage, StatementStage>> = {
  OPINIONS: 'OPINIONS',
  REACTIONS_LISTEN: 'REACTIONS',
  REACTIONS_ANSWER: 'REACTIONS',
  MOTION: 'FOLLOWUP',
};

export interface RoundLogLike {
  stage: StatementStage;
  roleId: string;
  status: RoleStatus;
}

/** page 화면을 보던 때의 세션 모습. 원본 세션은 바꾸지 않는다(새 객체). 의견은 그 시점까지 전달한
 * 것만, 발언은 그 시점까지 나온 라운드만, 임원 응답 상태는 그 라운드 기록으로 되돌린다. */
export function snapshotAt(session: Session, page: ViewPage, roundLog: readonly RoundLogLike[]): Session {
  const stages = VISIBLE_STATEMENT_STAGES[page];
  const statements = session.transcript.statements.filter((statement) => stages.includes(statement.stage));
  const opinionCount =
    page === 'MOTION' ? session.opinions.length : page.startsWith('REACTIONS') ? 1 : 0;
  const opinions = session.opinions.slice(0, opinionCount);

  const round = ROUND_OF_PAGE[page];
  let roleStatus = session.roleStatus;
  if (session.mode === 'live') {
    const next = { ...session.roleStatus };
    for (const roleId of EXEC_MEMBER_ORDER) {
      if (round === undefined || (page === 'MOTION' && session.opinions.length < 2)) {
        next[roleId] = 'idle';
      } else if (statements.some((statement) => statement.stage === round && statement.roleId === roleId)) {
        next[roleId] = 'answered';
      } else {
        const logged = roundLog.find((entry) => entry.stage === round && entry.roleId === roleId);
        next[roleId] = logged?.status === 'answered' ? 'answered' : 'failed';
      }
    }
    roleStatus = next;
  }

  const inReactions = page === 'REACTIONS_LISTEN' || page === 'REACTIONS_ANSWER';
  return {
    ...session,
    stage: inReactions ? 'REACTIONS' : page,
    opinions,
    transcript: { ...session.transcript, statements },
    roleStatus,
    followUpUsed: page === 'MOTION' ? session.followUpUsed : false,
    followUpAnswered: page === 'MOTION' ? session.followUpAnswered : false,
    followUpStance: page === 'MOTION' ? session.followUpStance : null,
    finalMotion: null,
    ballots: [],
    pendingVote: null,
    execBallotsPending: false,
  };
}
