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

/** OPINIONS 자막(T148): 비서실장이 임원마다 짚어 주는 완결된 한 문장. 각 initialOpinions.text와 뜻이 같다. */
export const AUTO_OPINION_CAPTIONS: Record<string, Record<'CEO' | 'CFO' | 'CAIO' | 'CISO', string>> = {
  'ai-approval': {
    CEO: 'CEO는 담당자가 없으면 일이 멈추니, 범위를 정해 AI에게 맡겨 보자고 합니다.',
    CFO: 'CFO는 금액 한도와 다시 확인하는 절차가 있으면 따를 수 있다고 합니다.',
    CAIO: 'CAIO는 승인 이유를 남기는 장치부터 만들고, 그게 되는지 보고 정하겠다고 합니다.',
    CISO: 'CISO는 기록과 책임질 사람부터 정해야 한다며 반대합니다.',
  },
  'experience-first': {
    CEO: 'CEO는 데이터도 보되 방향은 사람이 잡아야 하니 경험을 앞세우자고 합니다.',
    CFO: 'CFO는 숫자가 경고할 때 멈출 수 있다면 따를 수 있다고 합니다.',
    CAIO: 'CAIO는 데이터가 약한 상황으로 범위를 좁히면 경험을 앞세워도 괜찮다고 봅니다.',
    CISO: 'CISO는 판단 근거를 기록으로 남기지 않으면 반대한다고 합니다.',
  },
};

/** 자막 문장 틀(조건 라벨·문구 원문을 끼운다). */
export const autoPhraseCaption = (conditionLabel: string, text: string): string =>
  `'${conditionLabel}' 조건이 붙는 문구를 담습니다: ${text}`;
export const autoFollowUpCaption = (text: string): string => `추가 질문에는 이렇게 답합니다: ${text}`;
export const autoConditionCaption = (conditionLabel: string): string =>
  `'${conditionLabel}' 조건이 안건에 반영됩니다.`;
export const AUTO_NO_CONDITION_CAPTION = '붙은 조건이 없어 처음 안 그대로 표결합니다.';
export const AUTO_EXPLAIN_CAPTIONS = {
  compare: '① 조건 추천은 어떤 임원이 어떤 조건에 움직이는지 알려 줍니다.',
  refine: '② 내 발언 정리는 쓴 발언을 또렷하게 다듬은 초안을 보여 주니, 마음에 들면 내 발언에 적용하세요.',
} as const;
