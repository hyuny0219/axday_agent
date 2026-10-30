// 자동 진행 표시 문구(T144). 규칙은 domain/autoPlay.ts, 여기는 화면에 보이는 한국어만 둔다.

export const AUTO_BAR_LABEL = '● AI 비서실장 진행 중';
export const AUTO_PILL_PREFIX = 'CLICK 눌러서';

/** 참가자 차례에 누를 버튼 이름(알약 문구는 `CLICK 눌러서 …`). */
export const AUTO_CLICK_LABELS = {
  'briefing-next': '의견 듣기',
  'opinions-next': '내 의견 쓰러 가기',
  'motion-freeze': '이 안건으로 표결',
  'vote-stamps': '찬성이나 반대 도장 찍기',
  'vote-confirm': '표결 확정',
  'result-finish': '마무리',
} as const;

export type AutoClickKey = keyof typeof AUTO_CLICK_LABELS;
