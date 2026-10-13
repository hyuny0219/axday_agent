// 진행 도우미(화면 사용법 안내, T103·T104)의 표시 규칙. 코치는 흐름을 끌고 가지 않는다 —
// 화면에 들어오면 그 화면을 어떻게 쓰는지 한 번 알려 주고 끝이다. 여기서는 "지금 화면에서
// 말풍선을 보여 줄지"만 순수 함수로 정한다. 문구는 content/coach.ts, 그리기는
// components/parts/Coach.tsx가 맡는다.

import type { Session } from './types';

/** 안내가 있는 화면 수(BRIEFING·OPINIONS·DISCUSS·REACTIONS 1/2·VOTE·RESULT). */
export const COACH_TOTAL = 6;

/** 화면 번호 1~6. `Session.coachDismissed`에 이 번호로 "이미 본 화면"을 기록한다. */
export type CoachScreenNumber = 1 | 2 | 3 | 4 | 5 | 6;

/** 코치가 판단에 쓰는 화면 상태. 세션에 없는 것만 화면이 알려 준다. */
export interface CoachUi {
  /** REACTIONS: 반응 듣기(listen) 또는 다시 답하기(answer). 다시 답하기에는 안내가 없다. */
  reactionsStep: 'listen' | 'answer';
}

export const EMPTY_COACH_UI: CoachUi = { reactionsStep: 'listen' };

/** 지금 화면의 안내 번호. 안내가 없는 화면(ATTRACT·INTRO·SELECT·MOTION, 다시 답하기)은 null. */
export function coachScreenOf(session: Session, ui: CoachUi): CoachScreenNumber | null {
  switch (session.stage) {
    case 'BRIEFING':
      return 1;
    case 'OPINIONS':
      return 2;
    case 'DISCUSS':
      return 3;
    case 'REACTIONS':
      return ui.reactionsStep === 'listen' ? 4 : null;
    case 'VOTE':
      return 5;
    case 'RESULT':
      return 6;
    default:
      return null;
  }
}

/** 지금 보여 줄 안내 번호. 꺼져 있거나 이 화면 안내를 이미 봤으면 null. */
export function coachStep(session: Session, ui: CoachUi): CoachScreenNumber | null {
  if (!session.coachEnabled) {
    return null;
  }
  const screen = coachScreenOf(session, ui);
  if (screen === null || session.coachDismissed.includes(screen)) {
    return null;
  }
  return screen;
}
