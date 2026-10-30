// 임원 "…" 뜸 들이기 시간(T148).
import { describe, expect, it } from 'vitest';
import { THINK_MAX_MS, THINK_MIN_MS, thinkingDurationMs, thinkingRevealTimes } from '../../src/domain/thinking';

describe('thinking', () => {
  it('뜸 시간은 1.2~2.4초 안이고 임원마다 조금씩 다르다', () => {
    const durations = Array.from({ length: 5 }, (_, index) => thinkingDurationMs(index));
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(THINK_MIN_MS);
      expect(ms).toBeLessThanOrEqual(THINK_MAX_MS);
    }
    expect(new Set(durations).size).toBeGreaterThan(2);
  });

  it('공개 시각은 앞 발언 뒤 뜸 시간만큼씩 차례로 늘어난다', () => {
    const times = thinkingRevealTimes(4);
    expect(times).toHaveLength(4);
    expect(times[0]).toBe(thinkingDurationMs(0));
    times.forEach((at, index) => {
      if (index > 0) expect(at - times[index - 1]!).toBe(thinkingDurationMs(index));
    });
  });
});
