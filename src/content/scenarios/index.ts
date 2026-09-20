// 안건 ①②③ 레지스트리. ②만 active이고 ①③은 콘텐츠 확정 전 자리표시(preparing)다.

import type { Scenario } from '../types';
import { aiAssistantScenario } from './aiAssistant';

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
    briefingIssues: [],
    previewConditionIds: [],
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
    resultCopy: { pass: '', hold: '', reject: '', sixMonthsLater: { pass: '', hold: '', reject: '' } },
    remainingTasks: [],
    baseConditionIds: [],
    status: 'preparing',
  };
}

export const scenarios: Scenario[] = [
  preparingPlaceholder('data-openness', '안건 ① (준비 중)'),
  aiAssistantScenario,
  preparingPlaceholder('prevention', '안건 ③ (준비 중)'),
];

export { aiAssistantScenario };
