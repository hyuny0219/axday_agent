// 임원 카드 맨 위 색 머리띠(T131 B안). 왼쪽에 큰 판정 글자, 가운데 변화 칩, 오른쪽에 임원
// 이름(제목 h3)을 둔다. 기울음(T118)은 빗금 띠 + "찬성 쪽?"으로 확정과 다르게 보인다.
// 판정 글자는 exec-mood-label-* testid 하나로 읽히고(색만으로 구분하지 않는다), 입장이
// 바뀐 순간에만 한 번 뒤집힌다(useChangeFlip).

import type { ReactNode } from 'react';
import type { ExecMemberId } from '../../content/types';
import type { Stance } from '../../domain/types';
import { stanceVerdict } from '../stanceDisplay';
import { useChangeFlip } from '../useChangeFlip';
import '../../styles/screens/stanceBand.css';

export interface StanceBandProps {
  roleId: ExecMemberId;
  stance: Stance;
  leaningTo?: 'FOR' | 'AGAINST';
  /** "유지"·"반대 → 찬성"·"반대 → 찬성 · 답하면 확정" 같은 변화 칩. 없으면 그리지 않는다. */
  chip?: string;
  chipTestId?: string;
  /** 임원 이름 제목(h3). 호출부가 카드 종류별 클래스를 붙여 넘긴다. */
  heading: ReactNode;
  /** 지난 화면 보기(T126) 중에는 뒤집지 않는다. */
  readOnly?: boolean;
}

export function StanceBand({ roleId, stance, leaningTo, chip, chipTestId, heading, readOnly = false }: StanceBandProps) {
  const verdict = stanceVerdict(stance, leaningTo);
  const flips = useChangeFlip(verdict.text, readOnly);
  return (
    <div
      key={flips}
      className={`stance-band stance-band--${verdict.tone}${verdict.leaning ? ' stance-band--leaning' : ''}${
        flips > 0 ? ' stance-band--flip' : ''
      }`}
      data-testid={`stance-band-${roleId}`}
    >
      <span className="stance-band__verdict" data-testid={`exec-mood-label-${roleId}`}>
        {verdict.text}
      </span>
      {chip && (
        <span className="stance-band__chip" data-testid={chipTestId}>
          {chip}
        </span>
      )}
      {heading}
    </div>
  );
}
