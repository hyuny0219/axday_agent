// T102: 무대 말풍선 한 구절(bubble)은 임원 발언마다 채워져 있고, 18자 이하이며,
// 금지어·영문이 없어야 한다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario as aiApproval } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario as experienceFirst } from '../../src/content/scenarios/experienceFirst';
import { BUBBLE_MAX_LENGTH } from '../../src/components/bubbleText';
import { findForbiddenWords } from '../../server/prompts/plainLanguage';

describe.each([
  ['aiApproval', aiApproval],
  ['experienceFirst', experienceFirst],
])('%s 말풍선 한 구절', (_name, scenario) => {
  const lines = [
    ...scenario.initialOpinions.map((o) => ({ id: `의견 ${o.memberId}`, bubble: o.bubble })),
    ...scenario.reactions.map((r) => ({ id: `반응 ${r.conditionId}/${r.memberId}`, bubble: r.bubble })),
  ];

  it('모든 임원 의견·반응에 bubble이 있다', () => {
    expect(lines.filter((l) => !l.bubble).map((l) => l.id)).toEqual([]);
  });

  it('길이 18자 이하', () => {
    for (const l of lines) {
      expect(l.bubble?.length ?? 0, l.id).toBeLessThanOrEqual(BUBBLE_MAX_LENGTH);
    }
  });

  it('금지어와 영문이 없다', () => {
    for (const l of lines) {
      expect(findForbiddenWords(l.bubble ?? ''), l.id).toEqual([]);
      expect(/[A-Za-z]/.test(l.bubble ?? ''), l.id).toBe(false);
    }
  });
});
