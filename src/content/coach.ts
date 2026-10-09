// 진행 도우미(화면 사용법 안내, T103·T104) 문구. 화면마다 말풍선 하나, 제목 한 줄과 2~4줄.
// 제목의 핵심 말(`keys`)은 화면의 `.key-term` 강조로 그려진다. 새 문구는 쉬운 말만 쓴다
// (server/prompts/plainLanguage.ts FORBIDDEN_WORDS 0건, tests/components/Coach.test.tsx).

export interface CoachScreenCopy {
  /** 화면 번호 1~6(domain/coach.ts CoachScreenNumber). */
  step: number;
  title: string;
  /** title 안에서 강조할 말(글자가 그대로 일치할 때만). */
  keys: readonly string[];
  /** 안내 줄. 둘 이상이면 번호 목록으로 그린다. */
  lines: readonly string[];
  /** live(실제 모델) 세션에서 대신 보여 줄 줄 — scripted 전용 요소(전환 배지)를 말하지 않는다. */
  linesLive?: readonly string[];
}

export const COACH_SCREENS: readonly CoachScreenCopy[] = [
  {
    step: 1,
    title: '상황을 읽고 자료를 열어 보세요',
    keys: ['상황', '자료'],
    lines: [
      '상황·제안·미정 세 줄을 읽습니다.',
      "'근거 자료 보기'로 자료 4장을 봅니다.",
      "그다음 '의견 듣기'가 열립니다.",
    ],
  },
  {
    step: 2,
    title: '임원 네 명의 말을 읽어 보세요',
    keys: ['임원 네 명'],
    lines: ["누가 찬성·반대·고민 중인지 보세요.", "다 읽으면 '내 의견 쓰러 가기'를 누릅니다."],
  },
  {
    step: 3,
    title: '내 의견은 이렇게 씁니다',
    keys: ['내 의견'],
    lines: [
      '찬성·반대를 고릅니다.',
      '추천 문구를 여러 개 담거나 직접 씁니다.',
      'AI 비서실장을 열어 한 가지 이상 써 봅니다(셋 다 써도 좋아요).',
      '의견 전달을 누릅니다.',
    ],
  },
  {
    step: 4,
    title: '임원들이 답했습니다',
    keys: ['임원들이 답했습니다'],
    lines: [
      '입장이 바뀐 임원을 확인하세요.',
      '고민 중인 임원은 답해야 찬성으로 바뀝니다.',
      '답하러 가거나 그냥 넘어갈 수 있습니다.',
    ],
    // live에는 전환 배지가 없다(LiveStatementCards는 지금 입장만 보여 준다) — 바뀐 임원을 찾으라고
    // 말하지 않는다(PR #20 Codex 36차 검토 P2).
    linesLive: [
      '카드마다 지금 입장(찬성·반대·고민 중)을 확인하세요.',
      '고민 중인 임원은 답해야 입장을 정합니다.',
      '답하러 가거나 그냥 넘어갈 수 있습니다.',
    ],
  },
  {
    step: 5,
    title: '마지막 표결입니다',
    keys: ['표결'],
    lines: ['찬성·반대 도장 중 하나를 고르고 확정합니다.', '같은 표가 3석 이상이면 성공 도장, 아니면 실패 도장입니다.'],
  },
  {
    step: 6,
    title: '결과를 확인하세요',
    keys: ['결과'],
    lines: ['제목 줄과 도장, 임원별 판단을 봅니다.', '회의 기록 전체도 볼 수 있습니다.'],
  },
];

export const COACH_ACK_LABEL = '알겠어요 ▶';
/** 아이콘으로 다시 연 말풍선의 버튼. */
export const COACH_CLOSE_LABEL = '닫기 ▶';
export const COACH_ICON_TEXT = '안내';
export const COACH_ICON_ARIA = '안내 다시 보기, 끌어서 옮길 수 있음';

export function coachCopy(step: number, mode: 'scripted' | 'live' = 'scripted'): CoachScreenCopy {
  const found = COACH_SCREENS.find((item) => item.step === step);
  if (!found) {
    throw new Error(`알 수 없는 코치 화면: ${step}`);
  }
  if (mode === 'live' && found.linesLive) {
    return { ...found, lines: found.linesLive };
  }
  return found;
}
