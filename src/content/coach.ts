// 진행 도우미(튜토리얼 코치, T103) 문구. 9단계 표(docs/TASKS.md T103)를 그대로 옮겼다.
// 제목의 핵심 말(`keys`)은 화면의 `.key-term` 강조로 그려진다. 새 문구는 쉬운 말만 쓴다
// (server/prompts/plainLanguage.ts FORBIDDEN_WORDS 0건, tests/components/Coach.test.tsx).

export type CoachPlacement = 'right' | 'left' | 'below' | 'above';

export interface CoachStepCopy {
  step: number;
  title: string;
  /** title 안에서 강조할 말(글자가 그대로 일치할 때만). */
  keys: readonly string[];
  body: string;
  /** live(실제 모델) 세션에서 대신 보여 줄 제목·강조·보조 문장 — scripted 전용 요소(전환 배지·'이사님 조건으로
   * 바뀜' 줄·조건 인과)를 말하지 않는다. 없으면 scripted 문구를 그대로 쓴다. */
  titleLive?: string;
  keysLive?: readonly string[];
  bodyLive?: string;
  placement: CoachPlacement;
}

export const COACH_STEPS: readonly CoachStepCopy[] = [
  {
    step: 1,
    title: '먼저 근거 자료 4장을 열어 보세요',
    keys: ['근거 자료 4장'],
    body: '임원들은 이 자료를 보고 말합니다. 닫으면 "의견 듣기"가 열립니다.',
    placement: 'left',
  },
  {
    step: 2,
    title: '임원 네 명의 말을 읽어 보세요',
    keys: ['임원 네 명'],
    body: '누가 찬성·반대인지, 왜 그런지가 다음 단계의 재료입니다.',
    placement: 'left',
  },
  {
    step: 3,
    title: '찬성인지 반대인지 먼저 고르세요',
    keys: ['찬성', '반대'],
    body: '고른 쪽의 추천 문구가 나옵니다.',
    placement: 'left',
  },
  {
    step: 4,
    title: '마음에 드는 추천 문구를 눌러 담으세요',
    keys: ['추천 문구'],
    body: '여러 개 가능하고, 직접 고쳐 써도 됩니다.',
    placement: 'left',
  },
  {
    step: 5,
    title: 'AI 비서실장을 열어 세 가지를 한 번씩 써 보세요',
    keys: ['AI 비서실장'],
    body: '한눈에 보기, 조건 추천, 발언 정리를 차례로 눌러 보세요.',
    placement: 'above',
  },
  {
    step: 6,
    title: '이제 의견 전달을 누르세요',
    keys: ['의견 전달'],
    body: '전달하면 임원들이 이사님 말에 답합니다.',
    placement: 'above',
  },
  {
    step: 7,
    title: '이사님 말에 임원들이 답했습니다',
    keys: ['임원들이 답했습니다'],
    body: '반대 → 찬성 배지는 이사님 조건으로 움직인 임원입니다. 답해도 되고 넘어가도 됩니다.',
    // live에서는 전환 배지가 없고(LiveStatementCards는 지금 입장만 보여 준다) 입장 변화가 조건
    // 때문이라고 단정할 수도 없다(PR #20 Codex 36차 검토 P2).
    bodyLive: '카드마다 지금 입장(찬성·반대·고민 중)을 확인해 보세요. 답해도 되고 넘어가도 됩니다.',
    placement: 'left',
  },
  {
    step: 8,
    title: '찬성·반대 도장 중 하나를 고르고 확정하세요',
    keys: ['찬성', '반대'],
    body: '같은 표가 3석 이상이면 설득 도장을 받습니다.',
    placement: 'left',
  },
  {
    step: 9,
    title: '이사님의 조건이 임원을 움직였는지 보세요',
    keys: ['조건이 임원을 움직였는지'],
    body: '"이사님 조건으로 바뀜" 줄이 설득한 임원입니다.',
    // live 결과에는 '이사님 조건으로 바뀜' 줄이 없고 조건이 원인이라고 판정할 수도 없다 —
    // 첫 의견과 최종 표의 변화만 말한다(PR #20 Codex 37차 검토 P2).
    titleLive: '임원 입장이 어떻게 바뀌었는지 보세요',
    keysLive: ['어떻게 바뀌었는지'],
    // 제목은 '이사님 편이 된 임원 수'(buildPersuasionResult, 첫 의견과 다른 모든 표가 아님) — 안내도 그 뜻으로
    // 말한다(PR #20 Codex 38차 검토 P2).
    bodyLive: '제목 한 줄이 이사님 편이 된 임원 수입니다. 임원별 판단에서 임원마다 지금 표를 확인하세요.',
    placement: 'below',
  },
];

/** 5단계에서 비서실장 팝업이 열려 있을 때의 문구(팝업 안 안내). */
export function assistantDialogCopy(used: number, total: number): { title: string; keys: readonly string[]; body: string } {
  if (used >= total) {
    return {
      title: '모두 써 봤습니다. 닫기를 누르세요',
      keys: ['닫기'],
      body: `세 가지 ${used}/${total} 완료`,
    };
  }
  return {
    title: '세 가지를 한 번씩 눌러 보세요',
    keys: ['한 번씩'],
    body: `지금 ${used}/${total} · 밝게 보이는 버튼부터 차례로 누르세요`,
  };
}

export const COACH_SKIP_LABEL = '건너뛰기';
export const COACH_ACK_LABEL = '알겠어요 ▶';
export const COACH_FINAL_ACK_LABEL = '안내 끝';

export function coachAckLabel(step: number): string {
  return step === 9 ? COACH_FINAL_ACK_LABEL : COACH_ACK_LABEL;
}

export function coachCopy(step: number, mode: 'scripted' | 'live' = 'scripted'): CoachStepCopy {
  const found = COACH_STEPS.find((item) => item.step === step);
  if (!found) {
    throw new Error(`알 수 없는 코치 단계: ${step}`);
  }
  if (mode === 'live' && (found.bodyLive || found.titleLive)) {
    return {
      ...found,
      title: found.titleLive ?? found.title,
      keys: found.keysLive ?? (found.titleLive ? [] : found.keys),
      body: found.bodyLive ?? found.body,
    };
  }
  return found;
}
