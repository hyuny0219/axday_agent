// 임원 역할 코드 → 화면 표기용 한국어 라벨. docs/SCENARIO_AI_ASSISTANT.md의 임원 순서
// (CEO / CFO / CAIO / CISO)를 그대로 따른다.

import type { ExecMemberId } from '../content/types';

export const MEMBER_LABELS: Record<ExecMemberId, string> = {
  CEO: '대표이사(CEO)',
  CFO: '재무책임임원(CFO)',
  CAIO: 'AI책임임원(CAIO)',
  CISO: '정보보호책임임원(CISO)',
};
