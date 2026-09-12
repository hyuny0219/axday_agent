// 임원 역할 코드 → 화면 표기용 한국어 라벨. docs/SCENARIO_AI_ASSISTANT.md의 임원 순서
// (CEO / CFO·CAIO / CIO / CISO)를 그대로 따른다.

import type { ExecMemberId } from '../content/types';

export const MEMBER_LABELS: Record<ExecMemberId, string> = {
  CEO: '대표이사(CEO)',
  CFO_CAIO: '재무·AI책임임원(CFO·CAIO)',
  CIO: '정보책임임원(CIO)',
  CISO: '정보보호책임임원(CISO)',
};
