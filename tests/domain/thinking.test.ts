// 임원 "…" 뜸 들이기 시간(T148, 함께 고민하고 한 번에 공개).
import { describe, expect, it } from 'vitest';
import { GROUP_THINK_MS, thinkingRevealTimes } from '../../src/domain/thinking';

describe('thinking', () => {
  it('모든 발언이 함께 고민한 뒤 같은 순간에 뜬다', () => {
    expect(thinkingRevealTimes(4)).toEqual([GROUP_THINK_MS, GROUP_THINK_MS, GROUP_THINK_MS, GROUP_THINK_MS]);
    expect(thinkingRevealTimes(0)).toEqual([]);
  });
});
