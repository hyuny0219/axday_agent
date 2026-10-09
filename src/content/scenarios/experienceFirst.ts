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
  // T94(2026-10-08 사용자 지시 "상황·제안·미정 문장도 같은 톤으로"): hook을 중학생이 한
  // 번에 읽을 문장으로 다시 썼다(의미는 그대로, 숫자는 하나만 남겼다). headline은 이미
  // 짧고 쉬워 그대로 둔다.
  incident: {
    caseLabel: '안건 02',
    headline: '데이터는 반대, 베테랑은 찬성',
    hook: '지난 2년 동안 데이터와 베테랑의 생각이 자주 갈렸다.',
  },
  originalMotion: {
    id: 'experience-first-original',
    text: '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다. 기준·데이터 활용·되짚기 방법은 미정이다.',
  },
  // T93(2026-10-07 사용자 지시 "자료 카드도 동일하게 쉬운 말로"): title은 그대로 두고
  // insight·content만 중학생이 한 번에 읽을 문장으로 다시 썼다. 의미·수치 방향은 바꾸지
  // 않는다. server/scenario-data.ts의 같은 content도 함께 갱신한다.
  evidence: [
    {
      id: 'E1',
      title: '지난 2년 주요 결정 돌아보기',
      content:
        '지난 2년간 큰 결정 18번 중 7번은 데이터와 베테랑의 생각이 달랐습니다. 그 7번 중' +
        ' 경험이 4번, 데이터가 3번 맞았습니다.',
      insight: '생각이 갈린 일곱 번 중 경험이 네 번, 데이터가 세 번 맞았습니다. 한쪽만 늘' +
        ' 맞지는 않았습니다.',
      relatedMemberIds: ['CEO'],
    },
    {
      id: 'E2',
      title: '신규 사업 예측 보고',
      content:
        '데이터 모델은 지난 3년 자료로 배웠습니다. 새 시장이나 법 변화 같은 처음 겪는 일에는' +
        ' 틀림이 두 배로 커집니다.',
      insight: '데이터는 처음 겪는 일에는 약합니다. 어디까지 믿을지 선을 정해야 합니다.',
      relatedMemberIds: ['CAIO'],
    },
    {
      id: 'E3',
      title: '베테랑 인터뷰 메모',
      content:
        '경험 많은 다섯 명 중 네 명이 판단 이유를 말로 설명하기 어렵다고 했습니다. 판단은' +
        ' 빨랐지만 기록은 남지 않았습니다.',
      insight: '경험은 빠르지만 왜 그런지 설명과 기록이 없습니다. 나중에 다시 확인할 수' +
        ' 없습니다.',
      relatedMemberIds: ['CISO'],
    },
    {
      id: 'E4',
      title: '실패 사례 메모',
      content:
        '데이터가 위험하다고 했는데 경험을 따라 진행해 손해 본 일이 한 번 있습니다.' +
        ' 데이터만 믿고 현장 경고를 놓친 일도 한 번 있습니다.',
      insight: '두 쪽 다 실패한 적이 있습니다. "어느 쪽이 맞냐"가 아니라 "어떻게 같이' +
        ' 쓰냐"가 문제입니다.',
      relatedMemberIds: ['CFO'],
    },
  ],
  briefingSummary: {
    text:
      '지난 2년 주요 결정 중 갈린 7건은 경험 4건·데이터 3건으로 어느 쪽도 늘 맞지 않았습니다(지난 2년 주요 결정 돌아보기). 데이터는 처음 겪는 상황에서 오차가 2배로 커집니다(신규 사업 예측 보고). 경험자는 판단 근거를 설명하기 어렵다고 답해 기록이 남지 않습니다(베테랑 인터뷰 메모). 데이터 경고를 무시해 손실이 난 사례와 데이터만 믿어 경고를 놓친 사례가 모두 있습니다(실패 사례 메모).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  // T94: situation을 두 문장으로 나눠 다시 썼다(의미는 그대로, question·role은 그대로).
  chairBriefing: {
    situation: '중요한 의사결정마다 데이터와 베테랑의 생각이 다릅니다. 그때 누구 말을 따를지 정한 규칙이 없습니다.',
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
  // T93: 중학생이 한 번에 읽을 쉬운 말로 다시 썼다(문장 25자 안팎·발언당 2~3문장, 의미·
  // 판단 분기·참조 자료는 그대로).
  initialOpinions: [
    {
      memberId: 'CEO',
      text: '지난 2년을 보면 어느 쪽도 늘 맞지는 않았습니다. 그래도 방향은 사람이 잡아야 합니다. 데이터도 보되 경험을 앞세웁시다.',
      bubble: '방향은 사람이 잡아야 합니다',
      evidenceIds: ['E1'],
      openingStance: 'FOR',
    },
    {
      memberId: 'CFO',
      text: '데이터가 위험하다고 알렸는데 무시해서 손해를 본 적이 있습니다. 경험을 중요하게 보더라도, 숫자가 경고할 때 멈추지 못하면 반대합니다.',
      bubble: '숫자 경고에 멈춰야 합니다',
      evidenceIds: ['E4'],
      openingStance: 'AGAINST',
    },
    {
      memberId: 'CAIO',
      text: '예측 보고를 보니 처음 겪는 상황에서는 데이터가 자주 틀렸습니다. 데이터가 약한 상황으로 범위를 좁힌다면, 경험을 앞세워도 괜찮다고 봅니다.',
      bubble: '범위를 좁히면 괜찮습니다',
      evidenceIds: ['E2'],
      openingStance: 'UNDECIDED',
    },
    {
      memberId: 'CISO',
      text: '인터뷰 메모를 보니 판단은 빨랐지만 기록이 없었습니다. 나중에 무엇을 보고 결정했는지 어떻게 확인하나요? 근거를 남기지 않으면 반대합니다.',
      bubble: '근거를 남겨야 합니다',
      evidenceIds: ['E3'],
      openingStance: 'AGAINST',
    },
  ],
  phrases: [
    { id: 'P1', text: '처음 겪는 상황에서만 경험을 우선합시다.', conditionId: 'SCOPE', side: 'FOR' },
    {
      id: 'P2',
      text: '경험으로 결정할 때는 판단 근거를 기록합시다.',
      conditionId: 'RECORD',
      side: 'FOR',
    },
    {
      id: 'P3',
      text: '데이터가 경고하면 결정을 잠시 멈추고 다시 봅시다.',
      conditionId: 'DATA_VETO',
      side: 'FOR',
    },
    {
      id: 'P4',
      text: '결정 결과를 돌아보고 다음 판단 기준으로 삼읍시다.',
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
      text: '결정을 돌아보는 절차 없이는 경험 우선에 반대합니다.',
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
      label: '처음 겪는 상황에서만',
      // "전례 없는 상황이란 무엇입니까?"는 제외하고 "~상황에 한정해/한정합시다"만 잡는다.
      keywords: ['상황에서만 경험을 우선'],
    },
    {
      id: 'RECORD',
      label: '판단 근거 기록',
      // "판단 근거는 어디에 있습니까?"는 제외한다.
      keywords: ['판단 근거를 기록'],
    },
    {
      id: 'DATA_VETO',
      label: '데이터가 경고하면 멈춤',
      // "데이터 경고는 어떻게 받습니까?"는 제외하고 "경고 시 … 잠시 멈추고"처럼 경고와
      // 멈춤을 한 어구로 묶어야 "경고 시 조치는 무엇입니까?" 같은 질문도 함께 피한다.
      keywords: ['경고하면 결정을 잠시 멈추'],
    },
    {
      id: 'REVIEW',
      label: '결정 결과 돌아보기',
      // '복기' 한 단어만 두면 "복기는 누가 합니까?" 같은 정보성 질문에도 걸려 묻지도 않은
      // 조건이 확정으로 제안된다(PR #13 Codex 1차 검토 P1, ai-approval의 OWNER '책임자'와
      // 같은 문제). P4 문구의 약속형 어구로 좁힌다.
      keywords: ['결정 결과를 돌아보'],
    },
    {
      id: 'EXP_ONLY',
      label: '언제나 경험 먼저',
      // "경험 판단이란 무엇입니까?"는 제외한다. '절대 우선'도 "절대 우선으로"까지 묶어
      // "절대 우선이 무엇을 뜻합니까?" 같은 질문을 피한다.
      keywords: ['언제나 경험 판단'],
    },
  ],
  conflicts: [['DATA_VETO', 'EXP_ONLY']],
  // T93: 같은 쉬운 말 기준으로 다시 썼다.
  reactions: [
    {
      conditionId: 'SCOPE',
      memberId: 'CAIO',
      text: '처음 겪는 상황으로 범위를 좁히면, 데이터가 약한 곳에서만 경험을 앞세우게 됩니다. 범위를 어떻게 나누시겠습니까?',
      bubble: '범위를 어떻게 나누시나요',
    },
    {
      conditionId: 'RECORD',
      memberId: 'CISO',
      text: '판단 이유를 기록해 두면 나중에 그 결정을 다시 확인할 수 있습니다. 어떻게 적을지부터 정하겠습니다.',
      bubble: '이유를 적어 두면 확인됩니다',
    },
    {
      conditionId: 'DATA_VETO',
      memberId: 'CFO',
      text: '데이터가 경고할 때 멈추는 절차를 두면, 숫자를 무시하는 일은 없을 것입니다.',
      bubble: '경고 때 멈추면 안심입니다',
    },
    {
      conditionId: 'REVIEW',
      memberId: 'CISO',
      text: '결과를 다시 보는 것까지 더하면, 기록과 함께 판단 기준을 계속 다듬을 수 있습니다.',
      bubble: '다시 보면 기준을 다듬습니다',
    },
    {
      conditionId: 'EXP_ONLY',
      memberId: 'CFO',
      text: '경험만 항상 앞세우면, 데이터가 분명히 경고해도 멈출 방법이 없습니다.',
      bubble: '경고해도 멈출 수 없습니다',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 잘 들었습니다. 더 확인할 게 없으면 지금 안건대로 판단하겠습니다.',
      bubble: '지금 안건대로 판단하겠습니다',
    },
  ],
  // 순수 반대(조건 없이 안건 자체에 반대, T92 N4 "중요한 결정은 숫자로 확인해야 한다고
  // 생각해 경험을 우선하는 것 자체에 반대합니다")에 대한 임원 4명의 응답. aiApproval.ts
  // oppositionReactions와 같은 근거 — "입장 그대로입니다"만 반복하지 않고 N4의 핵심
  // 주장("숫자로 확인")에 한 문장씩 직접 답한다.
  oppositionReactions: {
    CEO: '숫자로 확인해야 한다는 말씀, 이해합니다. 다만 지난 2년을 보면 숫자도 늘 맞지는 않았으니, 사람이 방향을 잡는 몫도 필요합니다.',
    CFO: '숫자로 확인해야 한다는 말씀에 저도 동의합니다. 데이터가 분명히 경고할 때 멈추는 절차가 없으면 저도 경험을 앞세울 수 없습니다.',
    CAIO: '말씀하신 걱정에 공감합니다. 다만 데이터가 약해지는, 처음 겪는 상황으로 좁힌다면 경험을 앞세워볼 수 있다고 봅니다.',
    CISO: '숫자로 확인해야 한다는 말씀, 인터뷰 메모에서도 같은 걱정이 나왔습니다. 판단 이유를 남기지 않으면 저도 반대합니다.',
  },
  // BRIEFING 핵심 말(T99): 상황·제안·미정 줄에서 굵게 표시한다.
  highlightTerms: [
    '생각이 다릅니다',
    '정한 규칙이 없습니다',
    '경험 있는 사람의 판단을 우선',
    '기준',
    '데이터는 어떻게 쓰나',
    '되짚는 방법',
  ],
  // 유지 이유(T96, aiApproval.ts holdReasons 주석과 같은 근거).
  // 근거 자료·임원 발언 핵심 말(T105): 문장에 실제로 나오는 글자만 쓴다(테스트로 확인).
  evidenceHighlightTerms: [
    '일곱 번 중',
    '경험이 네 번, 데이터가 세 번',
    '한쪽만 늘 맞지는 않았습니다',
    '처음 겪는 일에는 약합니다',
    '선을 정해야',
    '설명과 기록이 없습니다',
    '다시 확인할 수 없습니다',
    '두 쪽 다 실패',
    '어떻게 같이 쓰냐',
  ],
  statementHighlightTerms: [
    '경험을 따르시겠습니까',
    '방향은 사람이 잡아야',
    '경험을 앞세',
    '숫자가 경고할 때 멈추지',
    '처음 겪는 상황',
    '멈출 방법이 없습니다',
    '기록이 없었습니다',
    '근거를 남기지',
    '판단 이유를',
    '데이터가 경고할 때 멈추는 절차',
  ],
  holdReasons: {
    CEO: '지금 안건대로도 책임지는 사람이 판단을 앞세우는 방향이라 말씀은 바뀌지 않습니다.',
    CFO: '데이터가 경고할 때 멈추는 절차가 아직 보이지 않아 입장은 그대로입니다.',
    CAIO: '처음 겪는 상황으로 범위를 좁히는 안이 아직 보이지 않아 입장은 그대로입니다.',
    CISO: '판단 이유를 남기고 다시 보는 절차, 둘 다 아직 확인되지 않아 입장은 그대로입니다.',
  },
  // 추천 답변(T89, aiApproval.ts followUp 주석과 같은 근거). FOR 세 문구는 P3(DATA_VETO)·
  // P5(EXP_ONLY)·P1(SCOPE)과 같은 문장을 재사용한다 — DATA_VETO·EXP_ONLY는 상충쌍이라
  // 같은 입장 안에 함께 두면(DISCUSS와 달리 여기는 "경험을 따르겠다/멈추겠다" 자체가
  // 질문이라 둘 다 그 질문에 직접 답하는 모양이다) ConditionChips 충돌 안내가 그대로
  // 작동하는지 보는 e2e(reactions.spec.ts)도 그대로 통과한다. AGAINST는 "이대로는
  // 반대하지만 ~라면 다시 생각해 보겠습니다" 꼴로 조건 키워드를 부정 없이 담는다.
  // T93(2026-10-07 사용자 지시 "추가 질문도 찬성을 고려해서 질문한다"): aiApproval.ts
  // followUp 주석과 같은 근거. AGAINST는 CAIO가 "경험을 앞세우지 않는다면 데이터가 없는
  // 새로운 상황에서는 어떻게 결정할 것인가"를 묻는다. 조건 키워드(RECORD "판단 근거를
  // 기록"·REVIEW "결정 결과를 복기")는 그대로 유지한다.
  followUp: {
    question: '데이터가 분명히 위험하다고 알려도, 경험을 따르시겠습니까? 아니면 잠시 멈추시겠습니까?',
    askedBy: 'CFO',
    byStance: {
      FOR: {
        question: '데이터가 분명히 위험하다고 알려도, 경험을 따르시겠습니까? 아니면 잠시 멈추시겠습니까?',
        askedBy: 'CFO',
      },
      AGAINST: {
        question: '경험을 앞세우지 않는다면, 데이터가 없는 새로운 상황에서는 어떻게 결정해야 할까요?',
        askedBy: 'CAIO',
      },
    },
    options: [
      {
        text: '데이터가 경고하면 결정을 잠시 멈추고 다시 봅시다.',
        proposeConditionId: 'DATA_VETO',
        side: 'FOR',
      },
      {
        text: '최종 결정은 언제나 경험 판단을 따르도록 합시다.',
        proposeConditionId: 'EXP_ONLY',
        side: 'FOR',
      },
      {
        text: '처음 겪는 상황에서만 경험을 우선합시다.',
        proposeConditionId: 'SCOPE',
        side: 'FOR',
      },
      {
        text: '새로운 상황도 데이터를 더 모아서 풀어야지, 경험만 앞세우면 안 된다고 생각합니다.',
        proposeConditionId: null,
        side: 'AGAINST',
      },
      {
        text: '그래도 어렵다면, 판단 근거를 기록한다면 다시 생각해 보겠습니다.',
        proposeConditionId: 'RECORD',
        side: 'AGAINST',
      },
      {
        text: '그래도 어렵다면, 결정 결과를 돌아보고 다음에 반영한다면 다시 생각해 보겠습니다.',
        proposeConditionId: 'REVIEW',
        side: 'AGAINST',
      },
      {
        text: '데이터와 경험을 어떻게 같이 쓸지는 더 논의가 필요하다고 생각합니다.',
        proposeConditionId: null,
        side: 'BOTH',
      },
    ],
  },
  // T85 #14: 번역투 문장을 사람이 회의에서 말하듯 다시 썼다(의미·판단 순서는 그대로,
  // 숫자·퍼센트는 쓰지 않는다 — NUMERIC_COPY_PATTERN).
  // T92: aiApproval.ts voteRules 주석과 같은 근거 — CFO·CAIO·CISO는 자기 조건이 모두
  // 채워질 때만 YES라, 반대 입장에서 일부 조건만 제안해도 NO가 유지된다(반대 성향
  // CFO·CISO가 조건 유무만으로 찬성으로 넘어가지 않는다). 별도 participantStance 분기는
  // 두지 않았다(tests/domain/voting.test.ts 회귀 테스트로 분포를 고정).
  // T93: reason 전부를 같은 쉬운 말 기준으로 다시 썼다(판단 분기·조건 참조는 그대로).
  voteRules: {
    CEO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 항상 앞세우면 데이터를 아예 버리는 셈이라 반대합니다',
      },
      { when: { always: true }, vote: 'YES', reason: '책임지는 사람이 판단을 앞세우는 방향이라 찬성합니다' },
    ],
    CFO: [
      {
        when: { has: 'EXP_ONLY' },
        vote: 'NO',
        reason: '경험만 항상 앞세우면 숫자가 경고해도 무시하게 돼 반대합니다',
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
        reason: '경험만 항상 앞세우면 데이터가 쓰일 자리가 없어 반대합니다',
      },
      {
        when: { has: 'SCOPE' },
        vote: 'YES',
        reason: '처음 겪는 상황으로 범위를 좁힌다니 그러면 찬성합니다',
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
        reason: '경험만 항상 앞세우면 설명 없는 결정만 늘어 반대합니다',
      },
      {
        when: { all: [{ has: 'RECORD' }, { has: 'REVIEW' }] },
        vote: 'YES',
        reason: '판단 이유를 남기고 나중에 다시 보기도 한다니 그러면 찬성합니다',
      },
      {
        when: { has: 'RECORD' },
        vote: 'NO',
        reason: '판단 이유는 남기지만 나중에 다시 보는 절차가 없어 반대합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '판단 이유조차 남기지 않으면 반대합니다',
      },
    ],
  },
  resultCopy: {
    pass: '수정안이 승인되었습니다. 경험을 앞세울 때 지킬 조건도 함께 기록했습니다.',
    reject: '이번 안건은 부결되었습니다. 주요 우려와 이사님의 의견을 기록했습니다.',
    sixMonthsLater: {
      pass: '중요한 의사결정에서 경험이 먼저 발언합니다. 이사회가 붙인 조건이 기록·멈춤·돌아보기의 기준이 되었습니다.',
      passOriginal: '중요한 의사결정은 경험이 이끕니다. 데이터를 어디까지 볼지는 결정하면서 정해야 합니다.',
      reject: '결정 규칙은 그대로입니다. 이사님이 남긴 우려가 다음 안건의 출발점이 되었습니다.',
    },
  },
  remainingTasks: [
    { text: '"중요한 의사결정"의 기준', resolvedBy: 'SCOPE' },
    { text: '판단 이유를 어떻게 적어 둘지', resolvedBy: 'RECORD' },
    { text: '결정을 언제 되짚어 볼지', resolvedBy: 'REVIEW' },
  ],
  baseConditionIds: [],
  status: 'active',
};
