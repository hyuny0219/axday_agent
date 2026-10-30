// 자동 진행 표시 문구(T144). 규칙은 domain/autoPlay.ts, 여기는 화면에 보이는 한국어만 둔다.

export const AUTO_BAR_LABEL = '● AI 비서실장 진행 중';
export const AUTO_PILL_PREFIX = 'CLICK 눌러서';

/** 참가자 차례에 누를 버튼 이름(알약 문구는 `CLICK 눌러서 …`). */
export const AUTO_CLICK_LABELS = {
  'briefing-next': '의견 듣기',
  'opinions-next': '내 의견 쓰러 가기',
  'motion-freeze': '이 안건으로 표결',
  'discuss-side': '찬성이나 반대 고르기',
  'assistant-compare': '① 조건 추천',
  'assistant-refine': '② 내 발언 정리',
  'assistant-apply': '내 발언에 적용',
  'assistant-open': 'AI 비서실장 열기',
  'discuss-submit': '의견 전달',
  'reactions-advance': '답하러 가기',
  'reactions-submit': '답변 전달',
  'vote-stamps': '찬성이나 반대 도장 찍기',
  'vote-confirm': '표결 확정',
  'result-finish': '마무리',
} as const;

export type AutoClickKey = keyof typeof AUTO_CLICK_LABELS;

/** DISCUSS 진행 목록(T147: 비서실장은 ① 조건 추천 · ② 내 발언 정리, 누르는 차례는 참가자). */
export const AUTO_DISCUSS_STEP_LABELS = {
  phrases: '추천 문구 담기',
  open: 'AI 비서실장 열기',
  compare: '① 조건 추천',
  refine: '② 내 발언 정리',
  apply: '내 발언에 적용',
} as const;
