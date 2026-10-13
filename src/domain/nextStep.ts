// "다음 할 일" 점선(T113)의 규칙. 화면마다 지금 눌러야 할 것 하나를 고르고(한 번 누른 것은
// 빠진다), 그 점선을 언제부터 보여 줄지(들어온 뒤 6초 동안 아무것도 안 눌렀을 때)만 정한다.
// 그리는 일은 components/parts/focusRing.ts와 styles/screens/focus.css가 맡는다.
// 코치(T104)와 같은 원칙이다 — 안내만 하고 버튼 활성/비활성 규칙은 건드리지 않는다.

/** 화면(또는 단계)에 들어온 뒤 아무것도 누르지 않고 이 시간이 지나면 점선을 시작한다. */
export const FOCUS_DELAY_MS = 6000;

/** 위에서부터 보아 처음으로 "아직 안 한" 항목의 키. 모두 끝났으면 null. */
export function firstPending<K extends string>(
  steps: ReadonlyArray<readonly [key: K, pending: boolean]>,
): K | null {
  for (const [key, pending] of steps) {
    if (pending) {
      return key;
    }
  }
  return null;
}

/** 점선을 지금 켜도 되는지. 꺼져 있으면 항상 false, 한 번이라도 눌렀으면 지연 없이 true. */
export function isFocusArmed(input: { enabled: boolean; interacted: boolean; idleMs: number }): boolean {
  if (!input.enabled) {
    return false;
  }
  return input.interacted || input.idleMs >= FOCUS_DELAY_MS;
}

/** `?focus=off`로 시작하면 점선을 끈다(운영 메뉴 토글은 두지 않는다). */
export function focusDisabledBySearch(search: string): boolean {
  return new URLSearchParams(search).get('focus') === 'off';
}

// ---- 화면별 "다음 할 일" 매핑 -------------------------------------------------------------

export type IntroStep = 'start';
export type BriefingStep = 'evidence' | 'next';
export type OpinionsStep = 'next';
export type DiscussStep = 'side' | 'phrase' | 'assistant' | 'submit';
export type ReactionsListenStep = 'advance';
export type ReactionsAnswerStep = 'side' | 'option' | 'submit';
export type MotionStep = 'freeze';
export type VoteStep = 'choice' | 'confirm';

export function introNextStep(): IntroStep {
  return 'start';
}

/** BRIEFING: 근거 자료를 열어 보기 → 의견 듣기. 잠긴 버튼에는 붙이지 않는다. */
export function briefingNextStep(input: { evidenceSeen: boolean }): BriefingStep {
  return input.evidenceSeen ? 'next' : 'evidence';
}

/** OPINIONS: 의견이 다 나와 버튼이 열렸을 때만. */
export function opinionsNextStep(input: { locked: boolean }): OpinionsStep | null {
  return input.locked ? null : 'next';
}

/** DISCUSS: 입장 → 추천 문구(글이 아직 없을 때) → AI 비서실장(한 가지도 안 썼을 때) → 의견 전달. */
export function discussNextStep(input: {
  sideChosen: boolean;
  hasDraft: boolean;
  assistantUsed: boolean;
  canSubmit: boolean;
}): DiscussStep | null {
  return firstPending<DiscussStep>([
    ['side', !input.sideChosen],
    ['phrase', !input.hasDraft],
    ['assistant', !input.assistantUsed],
    ['submit', input.canSubmit],
  ]);
}

/** REACTIONS 1/2(반응 듣기): 버튼이 열렸을 때만 "답하러 가기". */
export function reactionsListenNextStep(input: { locked: boolean }): ReactionsListenStep | null {
  return input.locked ? null : 'advance';
}

/** REACTIONS 2/2(다시 답하기): 입장 → 추천 답변(글이 아직 없을 때) → 답변 전달. */
export function reactionsAnswerNextStep(input: {
  sideChosen: boolean;
  hasAnswer: boolean;
  canSubmit: boolean;
}): ReactionsAnswerStep | null {
  return firstPending<ReactionsAnswerStep>([
    ['side', !input.sideChosen],
    ['option', !input.hasAnswer],
    ['submit', input.canSubmit],
  ]);
}

/** MOTION: 열려 있을 때만 "이 안건으로 표결". */
export function motionNextStep(input: { locked: boolean }): MotionStep | null {
  return input.locked ? null : 'freeze';
}

/** VOTE: 표를 고르기 전에는 두 도장 묶음, 고른 뒤에는 확정 버튼. 확정을 누른 뒤에는 없다. */
export function voteNextStep(input: { picked: boolean; submitted: boolean }): VoteStep | null {
  if (input.submitted) {
    return null;
  }
  return input.picked ? 'confirm' : 'choice';
}
