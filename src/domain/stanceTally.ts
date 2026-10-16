// 무대 위 찬반 집계(T131): 임원 4명을 찬성·기울음·반대·고민 중으로 나눠 센다. 기울음(T118,
// 첫 반응 뒤 답하면 확정)은 확정 입장과 섞지 않고 방향과 관계없이 따로 센다 — 기울음 임원은
// 찬성·반대·고민 중 어디에도 더하지 않으므로 네 칸의 합은 항상 4다.

import type { ExecMemberId } from '../content/types';
import type { LeaningMap } from './stance';
import type { Stance } from './types';
import { EXEC_MEMBER_ORDER } from './voting';

export interface StanceTally {
  for: number;
  leaning: number;
  against: number;
  undecided: number;
}

/** counted를 주면 그 임원만 센다 — live에서 아직 의견이 없거나 응답이 실패한 임원의 자리표시 UNDECIDED를
 * "고민 중"으로 세지 않기 위해서다(PR #21 Codex P2). */
export function stanceTally(
  stances: Record<ExecMemberId, Stance>,
  leaning: LeaningMap = {},
  counted?: ReadonlySet<ExecMemberId>,
): StanceTally {
  const tally: StanceTally = { for: 0, leaning: 0, against: 0, undecided: 0 };
  for (const memberId of EXEC_MEMBER_ORDER) {
    if (counted && !counted.has(memberId)) continue;
    if (leaning[memberId] !== undefined) {
      tally.leaning += 1;
    } else if (stances[memberId] === 'FOR') {
      tally.for += 1;
    } else if (stances[memberId] === 'AGAINST') {
      tally.against += 1;
    } else {
      tally.undecided += 1;
    }
  }
  return tally;
}
