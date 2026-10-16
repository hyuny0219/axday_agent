// 찬반 강조(T131)의 표시 값: 카드 머리띠와 무대 명패가 같은 판정 글자·색 이름을 쓰도록
// 한 곳에서 정한다. 색만으로 구분하지 않으므로 글자는 항상 함께 돌려준다.

import type { LeaningMap } from '../domain/stance';
import { stanceTally } from '../domain/stanceTally';
import type { StanceTally } from '../domain/stanceTally';
import type { ExecMemberId } from '../content/types';
import type { Stance } from '../domain/types';
import { SHORT_STANCE_LABEL } from './moodLabel';

export type StanceTone = 'for' | 'against' | 'undecided';

export interface StanceVerdict {
  tone: StanceTone;
  /** 큰 글자 판정 — 확정은 "찬성"·"반대"·"고민 중", 기울음은 "찬성 쪽?"·"반대 쪽?". */
  text: string;
  leaning: boolean;
}

const TONE: Record<Stance, StanceTone> = { FOR: 'for', AGAINST: 'against', UNDECIDED: 'undecided' };

export function stanceVerdict(stance: Stance, leaningTo?: 'FOR' | 'AGAINST'): StanceVerdict {
  if (leaningTo) {
    return { tone: TONE[leaningTo], text: `${SHORT_STANCE_LABEL[leaningTo]} 쪽?`, leaning: true };
  }
  return { tone: TONE[stance], text: SHORT_STANCE_LABEL[stance], leaning: false };
}

/** 기울음 카드의 변화 칩("반대 → 찬성 · 답하면 확정"). 지난 "답변하면 확정됩니다" 문구를 대신한다. */
export function leaningChipText(from: Stance, to: 'FOR' | 'AGAINST'): string {
  return `${SHORT_STANCE_LABEL[from]} → ${SHORT_STANCE_LABEL[to]} · 답하면 확정`;
}

export interface TallyPart {
  key: 'for' | 'leaning' | 'against' | 'undecided';
  label: string;
  count: number;
}

const TALLY_LABEL: Record<TallyPart['key'], string> = {
  for: '찬성',
  leaning: '기울음',
  against: '반대',
  undecided: '고민 중',
};

/** 집계 한 줄의 조각들("찬성 1 · 기울음 2 · 반대 1"). 0인 항목은 생략한다. */
export function tallyParts(
  stances: Record<ExecMemberId, Stance>,
  leaning: LeaningMap = {},
  counted?: ReadonlySet<ExecMemberId>,
): TallyPart[] {
  const tally: StanceTally = stanceTally(stances, leaning, counted);
  const keys: TallyPart['key'][] = ['for', 'leaning', 'against', 'undecided'];
  return keys.filter((key) => tally[key] > 0).map((key) => ({ key, label: TALLY_LABEL[key], count: tally[key] }));
}
