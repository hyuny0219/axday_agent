// 자동 진행 표시 문구(T144). 규칙은 domain/autoPlay.ts, 여기는 화면에 보이는 한국어만 둔다.

export const AUTO_BAR_LABEL = '● AI 비서실장 진행 중';
export const AUTO_PILL_PREFIX = 'CLICK 눌러서';

/** 참가자 차례에 누를 버튼 이름(알약 문구는 `CLICK 눌러서 …`). */
export const AUTO_CLICK_LABELS = {
  'briefing-next': '의견 듣기',
  'opinions-next': '내 의견 쓰러 가기',
  'motion-freeze': '이 안건으로 표결',
  'discuss-side': '찬성이나 반대 고르기',
  'assistant-refine': '발언 정리',
  'discuss-submit': '의견 전달',
  'reactions-advance': '답하러 가기',
  'reactions-submit': '답변 전달',
  'vote-stamps': '찬성이나 반대 도장 찍기',
  'vote-confirm': '표결 확정',
  'result-finish': '마무리',
} as const;

export type AutoClickKey = keyof typeof AUTO_CLICK_LABELS;

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
  refine: '발언 정리가 담은 문구를 자연스러운 발언으로 다듬어 내 발언에 넣었습니다.',
} as const;

/** 결과 화면 개표 자막(2026-10-30). */
export const autoVerdictCaption = (memberId: string, vote: 'YES' | 'NO' | 'UNCAST', same: boolean, sameSeats: number): string => {
  if (vote === 'UNCAST') return `${memberId}는 표를 내지 못했습니다.`;
  const word = vote === 'YES' ? '찬성' : '반대';
  return same
    ? `${memberId}는 ${word}입니다. 이사님과 같은 표, 지금 ${sameSeats}석입니다.`
    : `${memberId}는 ${word}입니다. 이사님과 다른 표입니다.`;
};
export const autoReportCaption = (earned: boolean, sameSeats: number): string =>
  earned
    ? `개표가 끝났습니다. 같은 표 ${sameSeats}석으로 성공 도장을 받았습니다. 결과 보고서를 확인해 보세요.`
    : `개표가 끝났습니다. 같은 표 ${sameSeats}석이라 실패 도장입니다. 결과 보고서를 확인해 보세요.`;
