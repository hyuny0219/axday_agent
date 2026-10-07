// 무대 표정 배지(StageBand, aria-hidden)의 접근 가능한 대응 텍스트(T63). 임원 카드의
// 상태 칩 옆에 이 문구를 그대로 붙인다 — 무대는 장식이라 스크린리더가 읽지 못하므로
// 같은 값을 본문에도 텍스트로 남겨 둔다(색만으로 구분하지 않는 규칙과 같은 이유).

import type { Stance } from '../domain/types';

export const STANCE_LABEL: Record<Stance, string> = {
  FOR: '찬성 쪽',
  AGAINST: '반대 쪽',
  UNDECIDED: '미정',
};

/** STANCE_LABEL보다 짧은 입장 라벨(T96) — "반대 → 찬성"·설득 현황판처럼 좁은 자리에
 * 전후 입장을 나란히 보여줄 때 "쪽"을 뺀다. */
export const SHORT_STANCE_LABEL: Record<Stance, string> = {
  FOR: '찬성',
  AGAINST: '반대',
  UNDECIDED: '미정',
};
