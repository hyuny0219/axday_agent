// 비실사 이니셜 아바타. 사진 대신 CSS만으로 그린 원형 배지이며, 토론·결과 화면에서
// 같은 memberId는 항상 같은 색상·이니셜을 쓴다(DESIGN_SPEC.md 1장 "아바타 기준은
// result.png의 비실사 이니셜·아이콘", 6장 "비실사 5인 아바타는 토론과 결과에 동일한
// 인물 매핑을 사용한다"). 순수 표시용이며 클릭·상태를 갖지 않는다.

import type { MemberId } from '../../domain/types';
import '../../styles/avatar.css';

const AVATAR_INITIALS: Record<MemberId, string> = {
  CEO: 'CEO',
  CFO: 'CFO',
  CAIO: 'CAIO',
  CISO: 'CISO',
  PARTICIPANT: '나',
};

export interface AvatarProps {
  memberId: MemberId;
  size?: 'sm' | 'md';
}

/** memberId → 색·이니셜이 고정된 CSS 원형 아바타(실사 이미지 없음). */
export function Avatar({ memberId, size = 'md' }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${memberId.toLowerCase()} avatar--${size}`}
      aria-hidden="true"
    >
      {AVATAR_INITIALS[memberId]}
    </span>
  );
}
