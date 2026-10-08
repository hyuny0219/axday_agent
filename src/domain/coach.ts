// 진행 도우미(튜토리얼 코치, T103)의 단계 계산. 화면 문구·위치가 아니라 "지금 몇 번째
// 단계를 보여 줄지"와 "그 단계가 끝났는지"만 순수 함수로 정한다. 문구는 content/coach.ts,
// 그리기는 components/parts/Coach.tsx가 맡는다.

import type { Session } from './types';

export const COACH_TOTAL = 9;

export type CoachStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 코치가 판단에 쓰는 화면 상태. 세션에 없는 것(자료 팝업 열림 등)은 화면이 알려 준다. */
export interface CoachUi {
  /** BRIEFING: 근거 자료를 한 번 열어 닫았는가. */
  evidenceSeen: boolean;
  /** 근거 자료 팝업이 지금 열려 있는가(열려 있는 동안 1단계 말풍선은 숨긴다). */
  evidenceOpen: boolean;
  /** DISCUSS: 고른 입장. */
  side: 'FOR' | 'AGAINST' | null;
  /** DISCUSS: 입장·문구가 갖춰져 비서실장을 열 수 있는가. */
  draftReady: boolean;
  /** DISCUSS: 비서실장 기능을 한 번씩 써 본 개수(0~3). */
  assistantUsedCount: number;
  /** DISCUSS: 의견 전달 버튼이 열려 있는가(문구 준비 + 비서실장 세 가지). */
  canSubmit: boolean;
  /** DISCUSS: 비서실장 팝업이 열려 있는가. */
  assistantOpen: boolean;
  /** REACTIONS: 반응 듣기(listen) 또는 다시 답하기(answer). */
  reactionsStep: 'listen' | 'answer';
}

export const EMPTY_COACH_UI: CoachUi = {
  evidenceSeen: false,
  evidenceOpen: false,
  side: null,
  draftReady: false,
  assistantUsedCount: 0,
  canSubmit: false,
  assistantOpen: false,
  reactionsStep: 'listen',
};

export const ASSISTANT_FEATURE_TOTAL = 3;

/** 읽기만 하는 단계(말풍선에 "알겠어요 ▶"가 붙고, 그것을 눌러야 끝난다). */
export const COACH_READ_STEPS: readonly CoachStepNumber[] = [2, 7, 9];

export function isReadStep(step: number): boolean {
  return COACH_READ_STEPS.includes(step as CoachStepNumber);
}

/** 화면(stage)마다 거치는 단계 번호, 앞에서부터 차례로. */
export function coachStepsOf(session: Session, ui: CoachUi): readonly CoachStepNumber[] {
  switch (session.stage) {
    case 'BRIEFING':
      return [1];
    case 'OPINIONS':
      return [2];
    case 'DISCUSS':
      return [3, 4, 5, 6];
    case 'REACTIONS':
      // 다시 답하기(2/2)에는 코치가 없다.
      return ui.reactionsStep === 'listen' ? [7] : [];
    case 'VOTE':
      return [8];
    case 'RESULT':
      return [9];
    default:
      return [];
  }
}

/** 이 단계가 이미 끝난 상태인가(읽기 단계는 눌러서 끝나므로 항상 false). */
export function isCoachStepComplete(step: CoachStepNumber, session: Session, ui: CoachUi): boolean {
  switch (step) {
    case 1:
      return ui.evidenceSeen && !ui.evidenceOpen;
    case 3:
      return ui.side !== null;
    case 4:
      return ui.draftReady;
    case 5:
      return ui.assistantUsedCount >= ASSISTANT_FEATURE_TOTAL && !ui.assistantOpen;
    case 8:
      return session.ballots.some((ballot) => ballot.memberId === 'PARTICIPANT');
    default:
      return false;
  }
}

export interface CoachStepState {
  step: CoachStepNumber;
  /** true면 이미 끝난 단계라 보여 주지 않고 dismissed에만 기록하면 된다. */
  done: boolean;
}

/**
 * 지금 화면에서 보여 줄 코치 단계. 코치가 꺼져 있거나 이 화면의 단계를 모두 보았으면 null.
 * 앞 단계가 끝나지 않았으면 뒤 단계는 나오지 않고(순서대로), 끝난 단계는 done:true로
 * 돌려줘 호출부가 dismissed에 기록한 뒤 다음 단계로 넘어가게 한다.
 */
export function coachStep(session: Session, ui: CoachUi): CoachStepState | null {
  if (!session.coachEnabled) {
    return null;
  }
  for (const step of coachStepsOf(session, ui)) {
    if (session.coachDismissed.includes(step)) {
      continue;
    }
    // 6단계는 전달 버튼이 열려 있을 때만 나온다. 문구를 지워 닫히면 4단계로 돌아간다.
    if (step === 6 && !ui.canSubmit) {
      return ui.draftReady ? null : { step: 4, done: false };
    }
    // 단계 4·5·6은 앞 단계가 끝난 것을 전제로 한다. 입장을 바꾸거나 문구를 지워
    // 조건이 뒤로 물러나도(예: 4단계 뒤 draftReady=false) 이미 기록된 단계는 건너뛴다.
    return { step, done: isCoachStepComplete(step, session, ui) };
  }
  return null;
}

/**
 * 단계별 스포트라이트 대상(`data-coach` 값). 단계 안에서 대상이 바뀌는 5·8단계는 화면
 * 상태로 고른다.
 */
export function coachTarget(step: CoachStepNumber, session: Session, ui: CoachUi): string {
  switch (step) {
    case 1:
      return 'evidence-open';
    case 2:
      return 'opinion-cards';
    case 3:
      return 'side-select';
    case 4:
      return 'phrase-list';
    case 5:
      if (!ui.assistantOpen) {
        return 'assistant-toggle';
      }
      return ui.assistantUsedCount >= ASSISTANT_FEATURE_TOTAL ? 'assistant-close' : 'assistant-next';
    case 6:
      return 'submit-opinion';
    case 7:
      return 'reaction-cards';
    case 8:
      return session.pendingVote === null ? 'vote-stamps' : 'vote-confirm';
    case 9:
      return 'result-title';
  }
}

/** 팝업(비서실장) 안에서 보여 주는 단계인가 — 어둡기·z-index가 달라진다. */
export function isCoachInDialog(step: CoachStepNumber, ui: CoachUi): boolean {
  return step === 5 && ui.assistantOpen;
}
