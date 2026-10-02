// 안건 레지스트리(T70, docs/design/mockups/S1_Select.html 시안대로 카드 2장만 둔다).
// 활성 카드는 사내 게시판 익명제(anonBoard) 하나이고, 나머지 한 자리는 콘텐츠
// 확정 전 자리표시(preparing)다. 두 번째 준비 중 안건(옛 'prevention', 시안③)은
// 시안이 카드 2장만 보여주므로 레지스트리에서 뺐다 — id는 되돌릴 수 있게 남겨
// 두지 않고 코드에서만 제거했다(파일 자체는 지우지 않는다, 아래 주석 참고).
// 안건 ②는 2026-09-23에 '사내 게시판 익명제'(anonBoard)로 교체했다. 이전 안건
// (aiAssistant.ts)은 되돌릴 수 있게 파일로 남겨 두되 레지스트리에서는 뺀다(T53).

import type { Scenario } from '../types';
import { anonBoardScenario } from './anonBoard';

/** 준비 중 카드 한 장. SelectScreen은 카드 제목에 headline이 아니라
 * chairBriefing.question을 쓰므로(T70, 시안 카드 제목은 "안건 질문 한 줄"),
 * title 인자를 question에 그대로 넣는다 — 시안의 준비 중 카드 본문 "다음 안건"도
 * 질문이 아니라 상태 문구지만, 준비 중 카드는 질문 자리에 그 문구를 그대로 보여주는
 * 것으로 충분하다(준비 중이라 실제 질문이 없다). */
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
      question: title,
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
      CEO: [{ when: { always: true }, vote: 'NO' }],
      CFO: [{ when: { always: true }, vote: 'NO' }],
      CAIO: [{ when: { always: true }, vote: 'NO' }],
      CISO: [{ when: { always: true }, vote: 'NO' }],
    },
    resultCopy: { pass: '', reject: '', sixMonthsLater: { pass: '', passOriginal: '', reject: '' } },
    remainingTasks: [],
    baseConditionIds: [],
    status: 'preparing',
  };
}

export const scenarios: Scenario[] = [
  preparingPlaceholder('data-openness', '다음 안건'),
  anonBoardScenario,
];

export { anonBoardScenario };
