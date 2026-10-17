// REACTIONS "넘어가기" 앞 확인 팝업(T142)의 체크리스트 규칙. 참가자가 누르는 체크박스가 아니라
// 화면 상태로 자동 표시한다. 넘어간 뒤 임원 입장이 어떻게 되는지는 말하지 않는다 — 여기서는
// "답하기 전에 해 볼 일을 해 봤는가"만 판정한다.

export type SkipCheckId = 'question' | 'options' | 'assistant';
export type SkipCheckState = 'done' | 'todo';
/** 상태가 없는 항목(① 질문)은 체크 표시 대신 중립 표식만 쓴다. */
export type SkipCheckItemState = SkipCheckState | 'neutral';

export interface SkipCheckInput {
  /** 이번 REACTIONS에서 2/2(다시 답하기) 화면에 들어간 적이 있는가. */
  answerVisited: boolean;
  /** 이번 REACTIONS에서 AI 비서실장을 써서 결과를 받았는가(실패 안내를 본 경우도 써 본 것으로 센다). */
  assistantUsed: boolean;
}

export interface SkipCheckItem {
  id: SkipCheckId;
  state: SkipCheckItemState;
  /** 선택 항목은 안 해도 넘어갈 수 있다. */
  optional: boolean;
}

/**
 * ① 추가 질문은 읽었는지 화면이 알 수 없으므로 ✓/○ 없이 중립 표식('neutral')과 질문 원문만 보여 준다.
 * ② 추천 답변은 2/2 화면에서만 보이므로 들어간 적이 있어야 완료다.
 * ③ AI 비서실장은 선택이다.
 */
export function skipChecklist(input: SkipCheckInput): SkipCheckItem[] {
  return [
    { id: 'question', state: 'neutral', optional: false },
    { id: 'options', state: input.answerVisited ? 'done' : 'todo', optional: false },
    { id: 'assistant', state: input.assistantUsed ? 'done' : 'todo', optional: true },
  ];
}
