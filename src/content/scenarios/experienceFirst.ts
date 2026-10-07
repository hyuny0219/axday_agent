// 안건 ② — 중요한 의사결정은 데이터보다 경험이 더 중요하다 (docs/SCENARIO_EXPERIENCE_FIRST.md
// v2 그대로 옮김, 2026-10-02 사용자 승인). 본 시나리오의 수치·대사·의결 규칙은 체험용
// 가상 설정이며 실제 삼성화재 자료가 아니다. 이 안건은 "무엇을 도입할까"가 아니라
// "중요한 의사결정에서 무엇을 먼저 믿을까"를 묻는 가치 명제라, 조건은 "경험을 우선할
// 때 지킬 약속"으로 둔다. 구조는 이전 안건(anonBoard.ts)과 같다 — 조건 5개, 상충 1쌍,
// 표결 규칙 12행.

import type { Scenario } from '../types';

export const experienceFirstScenario: Scenario = {
  id: 'experience-first',
  title: '데이터보다 경험이 중요할까',
  selectLine: '데이터보다 경험이 중요할까',
  subtitle:
    '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다. "중요한 의사결정"의 기준, 경험을 우선할 때 데이터는 어떻게 쓰나, 판단이 틀렸을 때 되짚는 방법은 미정이다.',
  incident: {
    caseLabel: '사건 02',
    headline: '데이터는 반대, 베테랑은 찬성',
    hook: '지난 2년 주요 결정 중 데이터와 경험이 갈린 7건에서, 경험이 맞은 경우 4건, 데이터가 맞은 경우 3건이다.',
  },
  originalMotion: {
    id: 'experience-first-original',
    text: '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다. 기준·데이터 활용·되짚기 방법은 미정이다.',
  },
  evidence: [
    {
      id: 'E1',
      title: '지난 2년 주요 결정 복기',
      content:
        '주요 결정 18건 중 데이터 예측과 베테랑 판단이 갈린 7건. 결과적으로 경험이 맞은 경우 4건, 데이터가 맞은 경우 3건.',
      insight: '갈린 7건에서 경험 4 : 데이터 3. 한쪽이 늘 맞지는 않았다.',
      relatedMemberIds: ['CEO'],
    },
    {
      id: 'E2',
      title: '신규 사업 예측 보고',
      content: '데이터 모델은 최근 3년 자료로 학습됐고, 전례 없는 상황(신시장·규제 변화)에서는 오차가 2배로 커졌다.',
      insight: '데이터는 전례 없는 상황에 약하다. 어디까지 믿을지 범위가 필요하다.',
      relatedMemberIds: ['CAIO'],
    },
    {
      id: 'E3',
      title: '베테랑 인터뷰 메모',
      content: '경험자 5명 중 4명이 "판단 근거를 말로 설명하기 어렵다"고 답했다. 판단은 빨랐지만 기록은 남지 않았다.',
      insight: '경험은 빠르지만 설명과 기록이 없다. 되짚을 수 없다.',
      relatedMemberIds: ['CISO'],
    },
    {
      id: 'E4',
      title: '실패 사례 메모',
      content:
        '데이터가 명확히 경고했는데 경험을 따라 진행해 손실이 난 사례 1건. 반대로 데이터만 믿고 현장 경고를 놓친 사례 1건.',
      insight: '양쪽 실패가 모두 있다. 문제는 "어느 쪽"이 아니라 "어떻게 합치나"다.',
      relatedMemberIds: ['CFO'],
    },
  ],
  briefingSummary: {
    text:
      '지난 2년 주요 결정 중 갈린 7건은 경험 4건·데이터 3건으로 어느 쪽도 늘 맞지 않았습니다(지난 2년 주요 결정 복기). 데이터는 전례 없는 상황에서 오차가 2배로 커집니다(신규 사업 예측 보고). 경험자는 판단 근거를 설명하기 어렵다고 답해 기록이 남지 않습니다(베테랑 인터뷰 메모). 데이터 경고를 무시해 손실이 난 사례와 데이터만 믿어 경고를 놓친 사례가 모두 있습니다(실패 사례 메모).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  chairBriefing: {
    situation: '중요한 의사결정마다 데이터 분석과 베테랑의 판단이 엇갈리고, 그때마다 누구 말을 따를지 정하는 규칙이 없습니다.',
    question: '중요한 의사결정, 데이터보다 경험일까요?',
    role: '의견을 내고, 필요한 조건도 직접 제안할 수 있습니다. 마지막에는 한 표를 던집니다.',
  },
  motionBreakdown: {
    proposal: '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다.',
    // resolvedBy(T84): aiApproval.ts 주석과 같은 규칙.
    undecidedItems: [
      { text: '"중요한 의사결정"의 기준', resolvedBy: 'SCOPE' },
      // 데이터 경고 시 멈춤(DATA_VETO)으로도, 경험 절대 우선(EXP_ONLY — 데이터를 따르지 않기로)으로도 해소.
      { text: '경험을 우선할 때 데이터는 어떻게 쓰나', resolvedBy: ['DATA_VETO', 'EXP_ONLY'] },
      { text: '판단이 틀렸을 때 되짚는 방법', resolvedBy: 'REVIEW' },
    ],
  },
  initialOpinions: [
    {
      memberId: 'CEO',
      text: '지난 2년 주요 결정 복기를 보면 어느 쪽도 늘 맞지는 않았습니다. 그래도 조직의 방향은 사람이 잡아야죠. 데이터를 살피되 경험을 앞세웁시다.',
      evidenceIds: ['E1'],
      openingStance: 'FOR',
    },
    {
      memberId: 'CFO',
      text: '실패 사례 메모에 데이터 경고를 무시했다가 손실을 본 건이 있습니다. 경험에 무게를 싣더라도, 숫자가 경고할 때 멈출 수 없다면 반대입니다.',
      evidenceIds: ['E4'],
      openingStance: 'AGAINST',
    },
    {
      memberId: 'CAIO',
      text: '신규 사업 예측 보고를 보니 전례 없는 상황에서 모델 오차가 커졌습니다. 모델이 약한 상황에 한정한다면 경험을 앞세우는 것도 검토할 만합니다.',
      evidenceIds: ['E2'],
      openingStance: 'UNDECIDED',
    },
    {
      memberId: 'CISO',
      text: '베테랑 인터뷰 메모를 보니 판단은 빨랐는데 기록이 없네요. 나중에 무슨 근거로 결정했는지 어떻게 확인하죠? 근거를 남기지 않는다면 반대입니다.',
      evidenceIds: ['E3'],
      openingStance: 'AGAINST',
    },
  ],
  phrases: [
    { id: 'P1', text: '전례 없는 상황에 한정해 경험을 우선합시다.', conditionId: 'SCOPE', side: 'FOR' },
    {
      id: 'P2',
      text: '경험으로 결정할 때는 판단 근거를 기록합시다.',
      conditionId: 'RECORD',
      side: 'FOR',
    },
    {
      id: 'P3',
      text: '데이터 경고 시 결정을 잠시 멈추고 재검토합시다.',
      conditionId: 'DATA_VETO',
      side: 'FOR',
    },
    {
      id: 'P4',
      text: '결정 결과를 복기해 다음 판단 기준으로 삼읍시다.',
      conditionId: 'REVIEW',
      side: 'FOR',
    },
    {
      id: 'P5',
      text: '최종 결정은 언제나 경험 판단을 따르도록 합시다.',
      conditionId: 'EXP_ONLY',
      side: 'FOR',
    },
    {
      id: 'P6',
      text: '경험을 먼저 믿어야 할 이유를 더 설명해 주십시오.',
      conditionId: null,
      tag: 'request',
      side: 'BOTH',
    },
    // 반대 쪽 추천 문구(T87, aiApproval.ts N1~N4와 같은 근거). N1~N3은 "이 조건이
    // 보장되지 않는 한 반대한다"는 뜻이라 그 조건과 연결했고, N4는 경험 우선 원칙
    // 자체에 대한 순수 반대라 조건과 연결하지 않는다.
    {
      id: 'N1',
      text: '데이터가 분명히 경고하는데도 멈추지 않는다면 경험 우선에 반대합니다.',
      conditionId: 'DATA_VETO',
      side: 'AGAINST',
    },
    {
      id: 'N2',
      text: '판단 근거를 기록하지 않는 경험 우선에는 반대합니다.',
      conditionId: 'RECORD',
      side: 'AGAINST',
    },
    {
      id: 'N3',
      text: '결정을 복기해 되짚는 절차 없이는 경험 우선에 반대합니다.',
      conditionId: 'REVIEW',
      side: 'AGAINST',
    },
    {
      id: 'N4',
      text: '중요한 결정은 숫자로 확인해야 한다고 생각해 경험을 우선하는 것 자체에 반대합니다.',
      conditionId: null,
      side: 'AGAINST',
    },
  ],
  // PR #13 Codex 4차 검토: REVIEW의 '복기' 단독 키워드가 정보성 질문에도 걸리던
  // 문제(1차 검토 P1)를 SCOPE·RECORD·DATA_VETO·EXP_ONLY에서도 전수 점검했다 — 이전에는
  // "이미 2단어 이상 복합구라 괜찮다"고 판단했지만("전례 없는 상황"·"판단 근거"·
  // "경고 시"·"언제나 경험"·"절대 우선"), 명사·시점구만 있고 동사·어간이 없으면 역시
  // "~이란 무엇입니까"·"~는 어떻게 받습니까" 같은 질문에 걸린다. 모든 조건의 모든
  // 키워드를 약속형 어구로 좁혔다(docs/SCENARIO_EXPERIENCE_FIRST.md에 같은 근거 기록,
  // tests/content/experienceFirst.test.ts에 조건별 정보성 질문 음성 케이스 추가).
  conditions: [
    {
      id: 'SCOPE',
      label: '전례 없는 상황 한정',
      // "전례 없는 상황이란 무엇입니까?"는 제외하고 "~상황에 한정해/한정합시다"만 잡는다.
      keywords: ['상황에 한정'],
    },
    {
      id: 'RECORD',
      label: '판단 근거 기록',
      // "판단 근거는 어디에 있습니까?"는 제외한다.
      keywords: ['판단 근거를 기록'],
    },
    {
      id: 'DATA_VETO',
      label: '데이터 경고 시 멈춤',
      // "데이터 경고는 어떻게 받습니까?"는 제외하고 "경고 시 … 잠시 멈추고"처럼 경고와
      // 멈춤을 한 어구로 묶어야 "경고 시 조치는 무엇입니까?" 같은 질문도 함께 피한다.
      keywords: ['경고 시 결정을 잠시 멈추'],
    },
    {
      id: 'REVIEW',
      label: '결정 결과 복기',
      // '복기' 한 단어만 두면 "복기는 누가 합니까?" 같은 정보성 질문에도 걸려 묻지도 않은
      // 조건이 확정으로 제안된다(PR #13 Codex 1차 검토 P1, ai-approval의 OWNER '책임자'와
      // 같은 문제). P4 문구의 약속형 어구로 좁힌다.
      keywords: ['결정 결과를 복기'],
    },
    {
      id: 'EXP_ONLY',
      label: '경험 판단 절대 우선',
      // "경험 판단이란 무엇입니까?"는 제외한다. '절대 우선'도 "절대 우선으로"까지 묶어
      // "절대 우선이 무엇을 뜻합니까?" 같은 질문을 피한다.
      keywords: ['언제나 경험 판단', '절대 우선으로'],
    },
  ],
  conflicts: [['DATA_VETO', 'EXP_ONLY']],
  reactions: [
    {
      conditionId: 'SCOPE',
      memberId: 'CAIO',
      text: '전례 없는 상황으로 범위를 좁히면 모델이 약한 지점에서만 경험을 앞세우는 셈이 됩니다. 범위를 어떻게 가르시겠습니까?',
    },
    {
      conditionId: 'RECORD',
      memberId: 'CISO',
      text: '판단 근거를 기록해 두면 나중에 그 결정을 되짚을 수 있습니다. 기록 양식부터 정하겠습니다.',
    },
    {
      conditionId: 'DATA_VETO',
      memberId: 'CFO',
      text: '데이터가 경고할 때 멈추는 절차를 두면 숫자를 무시하는 일은 없겠습니다.',
    },
    {
      conditionId: 'REVIEW',
      memberId: 'CISO',
      text: '복기까지 더하면 기록과 함께 판단 기준을 계속 다듬을 수 있겠습니다.',
    },
    {
      conditionId: 'EXP_ONLY',
      memberId: 'CFO',
      text: '경험 판단을 절대 우선으로 두면 데이터가 분명히 경고해도 멈출 방법이 없습니다.',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 기록했습니다. 다른 확인 조건이 없다면 현재 안건으로 판단하겠습니다.',
    },
  ],
  followUp: {
    question: '데이터가 분명히 경고해도 경험을 따르시겠습니까, 잠시 멈추시겠습니까?',
    askedBy: 'CFO',
    options: [
      {
        text: '데이터 경고 시 결정을 잠시 멈추고 재검토합시다.',
        proposeConditionId: 'DATA_VETO',
      },
      {
        text: '최종 결정은 언제나 경험 판단을 따르도록 합시다.',
        proposeConditionId: 'EXP_ONLY',
      },
      {
        text: '앞서 전달한 의견을 유지하겠습니다.',
        proposeConditionId: null,
        keepPrevious: true,
      },
    ],
  },
  // T85 #14: 번역투 문장을 사람이 회의에서 말하듯 다시 썼다(의미·판단 순서는 그대로,
  // 숫자·퍼센트는 쓰지 않는다 — NUMERIC_COPY_PATTERN).
  voteRules: {
    CEO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 절대 우선으로 두면 데이터를 아예 버리는 셈이라 반대합니다',
      },
      { when: { always: true }, vote: 'YES', reason: '책임지는 사람이 판단을 앞세우는 방향이라 찬성합니다' },
    ],
    CFO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 절대 우선으로 두면 숫자가 경고해도 무시하게 돼 반대합니다',
      },
      {
        when: { has: 'DATA_VETO' },
        vote: 'YES',
        reason: '데이터가 경고하면 멈춘다니 그러면 찬성합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '데이터가 경고할 때 멈추는 절차가 없으면 찬성할 수 없어 반대합니다',
      },
    ],
    CAIO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 절대 우선으로 두면 데이터가 쓰일 자리가 없어 반대합니다',
      },
      {
        when: { has: 'SCOPE' },
        vote: 'YES',
        reason: '전례 없는 상황으로 범위를 좁힌다니 그러면 찬성합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '범위를 좁히지 않으면 반대합니다',
      },
    ],
    CISO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 절대 우선으로 두면 설명 없는 결정만 늘어 반대합니다',
      },
      {
        when: { all: [{ has: 'RECORD' }, { has: 'REVIEW' }] },
        vote: 'YES',
        reason: '판단 근거를 남기고 나중에 복기도 한다니 그러면 찬성합니다',
      },
      {
        when: { has: 'RECORD' },
        vote: 'NO',
        reason: '판단 근거는 남기지만 나중에 복기하는 절차가 없어 반대합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '판단 근거조차 남기지 않으면 반대합니다',
      },
    ],
  },
  resultCopy: {
    pass: '수정안이 승인되었습니다. 운영 전에 확인할 조건도 함께 기록했습니다.',
    reject: '이번 안건은 부결되었습니다. 주요 우려와 이사님의 의견을 기록했습니다.',
    sixMonthsLater: {
      pass: '중요한 의사결정에서 경험이 먼저 발언합니다. 이사회가 붙인 조건이 기록·멈춤·복기의 기준이 되었습니다.',
      passOriginal: '중요한 의사결정은 경험이 이끕니다. 데이터를 어디까지 볼지는 결정하면서 정해야 합니다.',
      reject: '결정 규칙은 그대로입니다. 이사님이 남긴 우려가 다음 안건의 출발점이 되었습니다.',
    },
  },
  remainingTasks: [
    { text: '"중요한 의사결정"의 기준', resolvedBy: 'SCOPE' },
    { text: '판단 근거 기록 양식', resolvedBy: 'RECORD' },
    { text: '복기 주기', resolvedBy: 'REVIEW' },
  ],
  baseConditionIds: [],
  status: 'active',
};
