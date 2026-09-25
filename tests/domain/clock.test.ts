import { describe, expect, it } from 'vitest';
import { fakeClock } from '../../src/domain/clock';

const T0 = 1_700_000_000_000;

describe('systemClock/fakeClock', () => {
  it('fakeClock은 advance한 만큼만 now()가 바뀐다', () => {
    const clock = fakeClock(T0);
    expect(clock.now()).toBe(T0);
    clock.advance(1_000);
    expect(clock.now()).toBe(T0 + 1_000);
  });
});
