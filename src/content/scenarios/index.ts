// 안건 ①②③ 레지스트리. ②만 active이고 ①③은 콘텐츠 확정 전 자리표시(preparing)다.
// 안건 ②는 2026-09-23에 '사내 게시판 익명제'(anonBoard)로 교체했다. 이전 안건
// (aiAssistant.ts)은 되돌릴 수 있게 파일로 남겨 두되 레지스트리에서는 뺀다(T53).

import type { Scenario } from '../types';
import { anonBoardScenario } from './anonBoard';

function preparingPlaceholder(id: string, title: string): Scenario {
  return {
    id,
    title,
    selectLine: title,
    subtitle: '준비 중인 안건입니다.',
    incident: { caseLabel: '', headline: title, hook: '준비 중인 안건입니다.' },
    originalMotion: { id: `${id}-original`, text: '준비 중인 안건입니다.' },
    evidence: [],
    briefingSummary: { text: '준비 중인 안건입니다.', evidenceIds: [] },
    chairBriefing: {
      situation: '준비 중인 안건입니다.',
      question: '준비 중인 안건입니다.',
      role: '준비 중인 안건입니다.',
    },
    motionBreakdown: { proposal: '준비 중인 안건입니다.', undecidedItems: [] },
    initialOpinions: [],
    phrases: [],
    conditions: [],
    conflicts: [],
    reactions: [],
    followUp: { question: '준비 중인 안건입니다.', askedBy: 'CAIO', options: [] },
    voteRules: {
      CEO: [{ when: { always: true }, vote: 'HOLD' }],
      CFO: [{ when: { always: true }, vote: 'HOLD' }],
      CAIO: [{ when: { always: true }, vote: 'HOLD' }],
      CISO: [{ when: { always: true }, vote: 'HOLD' }],
    },
    resultCopy: { pass: '', hold: '', reject: '', sixMonthsLater: { pass: '', passOriginal: '', hold: '', reject: '' } },
    remainingTasks: [],
    baseConditionIds: [],
    status: 'preparing',
  };
}

export const scenarios: Scenario[] = [
  preparingPlaceholder('data-openness', '안건 ① (준비 중)'),
  anonBoardScenario,
  preparingPlaceholder('prevention', '안건 ③ (준비 중)'),
];

export { anonBoardScenario };
