// T131: 무대 집계 — 기울음은 방향과 관계없이 따로 세고 네 칸의 합은 항상 4다.
import { describe, expect, it } from 'vitest';
import { stanceTally } from '../../src/domain/stanceTally';

describe('stanceTally', () => {
  it('확정 입장만 있으면 찬성·반대·고민 중으로 센다', () => {
    expect(stanceTally({ CEO: 'FOR', CFO: 'AGAINST', CAIO: 'UNDECIDED', CISO: 'AGAINST' })).toEqual({
      for: 1,
      leaning: 0,
      against: 2,
      undecided: 1,
    });
  });

  it('기울음 임원은 입장 칸에 더하지 않고 방향과 관계없이 기울음으로 센다', () => {
    const tally = stanceTally(
      { CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'AGAINST', CISO: 'AGAINST' },
      { CFO: 'FOR', CAIO: 'FOR' },
    );
    expect(tally).toEqual({ for: 1, leaning: 2, against: 1, undecided: 0 });
    expect(tally.for + tally.leaning + tally.against + tally.undecided).toBe(4);
  });
});
