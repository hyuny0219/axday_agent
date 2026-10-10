// T110(두 단계 설득): 1차 반응에서 "고민 중"에 머무는 임원의 반응 문구(pendingText·pendingBubble)가
// 모든 경우에 준비되어 있고, 쉬운 말 기준을 지키는지 확인한다. 조건 조합마다 직접 계산하므로
// 새 조건·규칙이 늘어나도 문구가 빠지면 이 테스트가 잡는다.

import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import { BUBBLE_MAX_LENGTH } from '../../src/components/bubbleText';
import { reactionBodyText, reactionBubble, reactionsFor } from '../../src/components/reactionsFor';
import { findConflicts } from '../../src/domain/conditions';
import { membersAwaitingAnswer } from '../../src/domain/stance';
import type { Opinion } from '../../src/domain/types';
import {
  MAX_SENTENCE_CHARS,
  findForbiddenWords,
  sentenceCharLengths,
} from '../../server/prompts/plainLanguage';

function subsets(ids: string[]): string[][] {
  const result: string[][] = [[]];
  for (const id of ids) for (const existing of [...result]) result.push([...existing, id]);
  return result;
}

function opinion(confirmedConditionIds: string[], stance: 'FOR' | 'AGAINST'): Opinion {
  return { id: 'o', originalText: '의견', selectedPhraseIds: [], confirmedConditionIds, stance, createdAt: 0 };
}

describe.each([
  ['aiApproval', aiApprovalScenario],
  ['experienceFirst', experienceFirstScenario],
])('%s 고민 중 반응 문구(T110)', (_name, scenario) => {
  it('답을 기다리는 임원마다 pendingText·pendingBubble이 있는 반응이 있다(찬성·반대 입장, 모든 허용 조건 조합)', () => {
    let checked = 0;
    for (const stance of ['FOR', 'AGAINST'] as const) {
      for (const ids of subsets(scenario.conditions.map((c) => c.id))) {
        if (findConflicts(scenario, ids).length > 0) continue;
        const awaiting = membersAwaitingAnswer(scenario, {
          stage: 'REACTIONS',
          opinions: [opinion(ids, stance)],
          followUpUsed: false,
          followUpAnswered: false,
        });
        for (const memberId of awaiting) {
          const reactions = reactionsFor(scenario, memberId, ids);
          const label = `${stance} [${ids.join(',')}] ${memberId}`;
          expect(reactions.some((r) => r.pendingText), label).toBe(true);
          expect(reactionBodyText(reactions, true), label).not.toBe(reactionBodyText(reactions, false));
          expect(reactionBubble(reactions, true), label).toBe(reactions.find((r) => r.pendingBubble)?.pendingBubble);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('pendingText는 금지 어휘와 영문이 없고 문장이 길지 않다', () => {
    for (const reaction of scenario.reactions) {
      if (!reaction.pendingText) continue;
      expect(findForbiddenWords(reaction.pendingText), reaction.pendingText).toEqual([]);
      expect(/[A-Za-z]/.test(reaction.pendingText), reaction.pendingText).toBe(false);
      for (const length of sentenceCharLengths(reaction.pendingText)) {
        expect(length, reaction.pendingText).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
      }
    }
  });

  it('pendingBubble은 pendingText와 짝으로 있고 18자 이하, 금지어·영문이 없다', () => {
    for (const reaction of scenario.reactions) {
      expect(Boolean(reaction.pendingBubble), `${reaction.conditionId}/${reaction.memberId}`).toBe(
        Boolean(reaction.pendingText),
      );
      if (!reaction.pendingBubble) continue;
      expect(reaction.pendingBubble.length).toBeLessThanOrEqual(BUBBLE_MAX_LENGTH);
      expect(findForbiddenWords(reaction.pendingBubble)).toEqual([]);
      expect(/[A-Za-z]/.test(reaction.pendingBubble)).toBe(false);
    }
  });
});
