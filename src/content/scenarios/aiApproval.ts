// 안건 ① — AI 에이전트에게 결재권을 부여한다 (docs/SCENARIO_AI_APPROVAL.md v2 그대로 옮김,
// 2026-10-02 사용자 승인). 본 시나리오의 수치·대사·의결 규칙은 체험용 가상 설정이며
// 실제 삼성화재 자료가 아니다. 구조는 이전 안건(anonBoard.ts)과 같다 — 조건 5개,
// 상충 1쌍, 표결 규칙 12행.

import type { Scenario } from '../types';

export const aiApprovalScenario: Scenario = {
  id: 'ai-approval',
  title: 'AI 에이전트에게 결재권을 줄까',
  selectLine: 'AI 에이전트에게 결재권을 줄까',
  subtitle:
    '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다. 결재 범위와 금액 한도, 잘못 승인했을 때 책임, 사람이 다시 보는 절차는 미정이다.',
  // T94(2026-10-08 사용자 지시 "상황·제안·미정 문장도 같은 톤으로"): headline·hook을
  // 중학생이 한 번에 읽을 문장으로 다시 썼다(의미·판단 방향은 그대로, hook은 숫자를
  // 하나만 남겼다). briefingSummary.text는 T94 범위 밖이라 그대로 둔다.
  incident: {
    caseLabel: '사건 01',
    headline: '결재는 쌓이는데 담당자는 자리에 없다',
    hook: '결재자가 자리를 비우면 결재가 사흘 가까이 멈춘다.',
  },
  originalMotion: {
    id: 'ai-approval-original',
    text: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다. 범위·한도·책임·재검토 절차는 미정이다.',
  },
  // T93(2026-10-07 사용자 지시 "자료 카드도 동일하게 쉬운 말로"): title은 그대로 두고
  // insight·content만 중학생이 한 번에 읽을 문장으로 다시 썼다. 의미·수치 방향은 바꾸지
  // 않고 단위만 쉽게 바꾼다(예: "월 1,240건, 평균 2.8일" → "한 달에 천 건 넘게, 사흘
  // 가까이"). server/scenario-data.ts의 같은 content도 함께 갱신해 live 프롬프트가 읽는
  // 자료와 화면이 일치하게 한다.
  evidence: [
    {
      id: 'E1',
      title: '결재 처리 기록',
      content:
        '비용·휴가·구매처럼 반복되는 결재가 한 달에 천 건도 더 쌓입니다. 담당자가 자리를' +
        ' 비우면 결재가 사흘 가까이 멈춥니다.',
      insight: '반복 결재가 한 달에 천 건 넘게 밀리고, 담당자가 없으면 사흘 가까이 멈춥니다.',
      relatedMemberIds: ['CEO'],
    },
    {
      id: 'E2',
      title: '시범 자동승인 집계',
      content:
        '한 부서에서 30만 원 이하 비용 결재를 AI가 자동으로 승인해 봤습니다. 310건 중' +
        ' 4건은 정해둔 규칙을 벗어났습니다.',
      insight: '작게 해봤는데도 310건 중 4건이 규칙을 벗어났습니다. 적어도 0은 아닙니다.',
      relatedMemberIds: ['CFO'],
    },
    {
      id: 'E3',
      title: '감사 메모',
      content:
        '자동으로 승인한 건은 왜 승인했는지 적어두지 않았습니다. 나중에 감사할 때 이유를' +
        ' 다시 확인할 수 없었습니다.',
      insight: '자동 승인은 "왜 승인했는지"가 남지 않습니다. 그래서 다시 확인하기 어렵습니다.',
      relatedMemberIds: ['CAIO', 'CISO'],
    },
    {
      id: 'E4',
      title: '사용자 설문',
      content:
        '결재를 기다리다 일이 늦어졌다는 사람이 열에 여섯입니다. 반면 AI가 승인한 결재를' +
        ' 믿는다는 사람은 열에 넷뿐입니다.',
      insight: '기다리는 건 힘들어하지만, AI 승인을 믿는 사람은 아직 많지 않습니다.',
      relatedMemberIds: ['CISO'],
    },
  ],
  briefingSummary: {
    text:
      '반복 결재는 월 1,240건이고 결재자가 자리를 비우면 평균 2.8일 멈춥니다(결재 처리 기록). 소액 자동 승인 310건 중 4건이 규칙을 벗어났습니다(시범 자동승인 집계). 자동 승인 건은 승인 사유가 남지 않아 사후 감사에서 판단 근거를 재구성할 수 없습니다(감사 메모). 대기 불만은 크지만 AI 승인을 신뢰한다는 응답은 아직 적습니다(사용자 설문).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  // T94: situation을 두 문장으로 나눠 다시 썼다(의미는 그대로, question·role은 그대로).
  chairBriefing: {
    situation: '비용·휴가·구매 같은 결재가 하루 수십 건씩 쌓입니다. 결재자가 없으면 며칠씩 멈춥니다.',
    question: 'AI 에이전트에게 결재권을 줄까요?',
    role: '의견을 내고, 필요한 조건도 직접 제안할 수 있습니다. 마지막에는 한 표를 던집니다.',
  },
  // 원안 문장(subtitle과 동일)을 "제안"과 "아직 정하지 않은 것"으로 그대로 쪼갠 것이다
  // (T52 형식 그대로, 새 사실 없음).
  motionBreakdown: {
    proposal: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다.',
    // resolvedBy(T84): 각 미정 항목을 해소하는 조건 id. 그 조건이 확정되면
    // MotionScreen·VoteScreen·ResultScreen은 이 항목을 "아직 정하지 않은 것"에서 뺀다
    // (src/content/motionDisplay.ts). BriefingScreen(조건 확정 전 단계)은 영향받지 않는다.
    undecidedItems: [
      { text: '결재 범위와 금액 한도', resolvedBy: 'LIMIT' },
      { text: '잘못 승인했을 때 책임', resolvedBy: 'OWNER' },
      // 표본 재검토(REVIEW)로도, 검토 전면 생략(FULL_AUTO — 절차 '없음'으로 결정)으로도 해소.
      { text: '사람이 다시 보는 절차', resolvedBy: ['REVIEW', 'FULL_AUTO'] },
    ],
  },
  // T93: 중학생이 한 번에 읽을 쉬운 말로 다시 썼다(문장 25자 안팎·발언당 2~3문장, 의미·
  // 판단 분기·참조 자료는 그대로).
  initialOpinions: [
    {
      memberId: 'CEO',
      text: '결재 기록을 보면, 담당자가 없을 때 일이 멈춥니다. 범위를 정해 AI에게 맡겨 봅시다.',
      evidenceIds: ['E1'],
      openingStance: 'FOR',
    },
    {
      memberId: 'CFO',
      text: '자동 승인을 해봤더니 규칙을 벗어난 승인이 4건 있었습니다. 적은 돈이어도 그냥 넘길 수 없습니다. 돈 한도와 다시 확인하는 절차가 없으면 반대합니다.',
      evidenceIds: ['E2'],
      openingStance: 'AGAINST',
    },
    {
      memberId: 'CAIO',
      text: '감사 메모를 보니 왜 승인했는지 다시 확인할 수 없었습니다. 먼저 이유를 남기는 장치부터 만들어 봅시다. 그게 되는지 보고 정하겠습니다.',
      evidenceIds: ['E3'],
      openingStance: 'UNDECIDED',
    },
    {
      memberId: 'CISO',
      text: '설문을 보면 AI 승인을 믿는 사람은 열에 넷뿐입니다. 이유도 안 남는다면 더 믿기 어렵습니다. 기록과 책임질 사람부터 정해야 합니다.',
      evidenceIds: ['E3', 'E4'],
      openingStance: 'AGAINST',
    },
  ],
  phrases: [
    { id: 'P1', text: '결재 금액 한도를 정해 소액부터 자동 승인합시다.', conditionId: 'LIMIT', side: 'FOR' },
    { id: 'P2', text: '자동 승인마다 승인 사유를 기록합시다.', conditionId: 'LOG', side: 'FOR' },
    { id: 'P3', text: '승인 뒤 사람이 표본 재검토를 하도록 합시다.', conditionId: 'REVIEW', side: 'FOR' },
    {
      id: 'P4',
      text: '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.',
      conditionId: 'OWNER',
      side: 'FOR',
    },
    {
      id: 'P5',
      text: '사람 검토를 전면 생략하고 전부 자동 승인합시다.',
      conditionId: 'FULL_AUTO',
      side: 'FOR',
    },
    {
      id: 'P6',
      text: '맡겨도 될지 판단할 근거를 더 제시해 주십시오.',
      conditionId: null,
      tag: 'request',
      side: 'BOTH',
    },
    // 반대 쪽 추천 문구(T87, 사용자 지적 "추천 문구가 찬성 쪽에 편중"). N1~N3은
    // "이 조건이 보장되지 않는 한 반대한다"는 뜻이라 그 조건과 연결했다(선택 시
    // proposeFromPhrases가 conditionId로 바로 제안 — proposeFromText는 문장 속
    // '하지 않는'을 부정으로 봐 같은 조건을 제안하지 않지만, 그건 이 문구가 조건을
    // "원한다"는 뜻과 다른 경로일 뿐 상충하지 않는다). N4는 결재권 자체에 대한
    // 순수 반대라 조건과 연결하지 않는다.
    {
      id: 'N1',
      text: '사람이 표본 재검토를 하지 않는 한 자동 승인에 반대합니다.',
      conditionId: 'REVIEW',
      side: 'AGAINST',
    },
    {
      id: 'N2',
      text: '승인 사유를 기록하지 않는 자동 승인에는 반대합니다.',
      conditionId: 'LOG',
      side: 'AGAINST',
    },
    {
      id: 'N3',
      text: '책임자를 지정하지 않고는 결재권을 넘길 수 없어 반대합니다.',
      conditionId: 'OWNER',
      side: 'AGAINST',
    },
    {
      id: 'N4',
      text: '결재는 사람의 판단이 필요한 일이라 AI 에이전트에게 맡기는 것 자체에 반대합니다.',
      conditionId: null,
      side: 'AGAINST',
    },
  ],
  // PR #13 Codex 4차 검토: OWNER의 '책임자' 단독 키워드가 정보성 질문에도 걸리던
  // 문제(1차 검토 P1)를 LIMIT·LOG·REVIEW·FULL_AUTO에서도 전수 점검했다 — 명사만 있는
  // 키워드는 "~가 무엇입니까"·"~는 누가 합니까" 같은 질문에도 걸려 ReactionsScreen이
  // 묻지도 않은 조건을 확정으로 제안한다. 모든 조건의 모든 키워드를 "하겠다/합시다"
  // 동사·어간을 포함한 약속형 어구로 좁혔다(docs/SCENARIO_AI_APPROVAL.md에 같은 근거
  // 기록, tests/content/aiApproval.test.ts에 조건별 정보성 질문 음성 케이스 추가).
  conditions: [
    {
      id: 'LIMIT',
      label: '결재 금액 한도',
      // "금액 한도가 얼마입니까?" 같은 질문은 제외하고 "금액 한도를 정해/정합시다"처럼
      // 실제로 한도를 정하겠다는 문장만 잡는다.
      keywords: ['금액 한도를 정'],
    },
    {
      id: 'LOG',
      label: '승인 사유 기록',
      // "승인 사유가 무엇인지도 먼저 알려 주세요." 같은 질문은 제외한다.
      keywords: ['승인 사유를 기록'],
    },
    {
      id: 'REVIEW',
      label: '사람 표본 재검토',
      // "표본 재검토는 누가 합니까?"는 제외하고 "표본 재검토를 하도록/하겠습니다"만 잡는다.
      keywords: ['표본 재검토를 하', '사람이 다시 보도록'],
    },
    {
      id: 'OWNER',
      label: '결재 규칙 책임자',
      // '책임자' 한 단어만 두면 "현재 책임자가 누구인지 먼저 알려 주세요." 같은 정보성
      // 질문에도 걸려 ReactionsScreen이 묻지도 않은 조건을 확정으로 제안한다(PR #13 Codex
      // 1차 검토 P1). 책임자를 "지정하겠다"는 약속형 표현으로 좁힌다.
      keywords: ['책임자를 지정', '결재 규칙 책임자'],
    },
    {
      id: 'FULL_AUTO',
      label: '사람 검토 전면 생략',
      // "전면 생략이 무슨 뜻입니까?"는 제외한다. '검토를 전면 생략'은 "검토를"까지
      // 묶어야 "전면 생략이란" 같은 질문에 걸리지 않는다. '전부 자동'도 '승인'까지
      // 묶어 "전부 자동이 뭔가요?" 같은 질문을 피한다.
      keywords: ['검토를 전면 생략', '전부 자동 승인'],
    },
  ],
  conflicts: [['REVIEW', 'FULL_AUTO']],
  // T93: 같은 쉬운 말 기준으로 다시 썼다.
  reactions: [
    {
      conditionId: 'LIMIT',
      memberId: 'CFO',
      text: '돈 한도를 정하면 잘못 승인되는 돈이 얼마나 되는지 알 수 있습니다. 어디까지 맡길지 숫자로 정합시다.',
    },
    {
      conditionId: 'LOG',
      memberId: 'CAIO',
      text: '승인 사유를 남기면 나중에 왜 승인했는지 다시 확인할 수 있습니다. 어떻게 적을지부터 정하겠습니다.',
    },
    {
      conditionId: 'REVIEW',
      memberId: 'CFO',
      text: '일부를 다시 확인하는 절차까지 더하면, 한도 안에서도 잘못된 승인을 걸러낼 수 있습니다.',
    },
    {
      conditionId: 'OWNER',
      memberId: 'CISO',
      text: '책임질 사람을 정하면, 잘못된 승인이 나왔을 때 누가 설명할지 분명해집니다.',
    },
    {
      conditionId: 'FULL_AUTO',
      memberId: 'CISO',
      text: '사람이 보는 과정을 다 없애면, 잘못된 승인이 나와도 아무도 책임지지 못합니다.',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 잘 들었습니다. 더 확인할 게 없으면 지금 안건대로 판단하겠습니다.',
    },
  ],
  // 순수 반대(조건 없이 안건 자체에 반대, T92 N4 "결재는 사람의 판단이 필요한 일이라
  // AI 에이전트에게 맡기는 것 자체에 반대합니다")에 대한 임원 4명의 응답. 사용자 지적
  // "반대 의견을 작성해도 AI 임원들이 찬성 쪽으로 몰고 가는 경향"을 반응 문구에서도
  // 고친다 — "입장 그대로입니다"만 반복하지 않고 N4의 핵심 주장("사람의 판단")에 한
  // 문장씩 직접 답한다.
  oppositionReactions: {
    CEO: '사람이 판단해야 한다는 말씀, 이해합니다. 다만 담당자가 없으면 일이 멈추니, 범위를 좁혀서라도 맡겨 보자는 제안입니다.',
    CFO: '사람이 판단해야 한다는 말씀에는 저도 동의합니다. 돈 한도도, 다시 확인하는 절차도 없이 넘기는 건 저도 반대입니다.',
    CAIO: '말씀하신 걱정에는 공감합니다. 다만 승인 이유를 남기는 장치가 있다면, 좁은 범위에서는 맡겨볼 수 있다고 봅니다.',
    CISO: '사람이 판단해야 한다는 말씀, 감사 메모에서도 같은 걱정이 나왔습니다. 책임질 사람부터 정하지 않으면 저도 반대합니다.',
  },
  // 유지 이유(T96, 2026-10-08 사용자 지시 "내 발언에 따라 임원 입장이 변하는 것이 잘
  // 보이게"): REACTIONS 반응 카드가 "유지"일 때 빈 대사("앞서 말씀드린 입장 그대로입니다")
  // 대신 쓴다. 조건별이 아니라 역할별 1문장 — 그 역할이 voteRules에서 아직 못 채운
  // 조건을 넌지시 가리키되 새 수치·조건 라벨을 지어내지 않는다.
  holdReasons: {
    CEO: '지금 안건대로도 느린 결재를 풀어주는 방향이라 말씀은 바뀌지 않습니다.',
    CFO: '돈 한도와 다시 확인하는 절차가 아직 둘 다 갖춰지지 않아 입장은 그대로입니다.',
    CAIO: '승인 사유를 남기는 장치가 아직 보이지 않아 입장은 그대로입니다.',
    CISO: '책임질 사람과 기록, 둘 다 아직 확인되지 않아 입장은 그대로입니다.',
  },
  // 추천 답변(T89, 사용자 지시 "반응에 답하기에서도 내 의견에서와 마찬가지로 선택할 수
  // 있도록"): DISCUSS 추천 문구(Phrase.side)와 같은 구조로 입장별 3개씩(FOR·AGAINST)
  // + 입장과 무관한 BOTH 1개. 모두 "누구에게 책임을 맡기시겠습니까"에 직접 답하는 한
  // 문장이다. FOR 세 문구는 각각 P4(OWNER)·P2(LOG)·P5(FULL_AUTO)와 같은 문장을 그대로
  // 재사용해 조건 키워드 일치를 보장한다. AGAINST는 "이대로는 반대하지만 ~라면
  // 다시 생각해 보겠습니다" 꼴로, 조건 키워드가 **부정되지 않고** 등장해야
  // proposeFromText가 선언한 조건과 정확히 같은 값을 돌려준다(반대 자체는 키워드
  // 앞쪽에 둬 부정 판정 창에 걸리지 않는다, tests/content/aiApproval.test.ts). 옛
  // keepPrevious 선택지("앞서 전달한 의견을 유지하겠습니다")는 T84 #1부터 보조 버튼
  // "답하지 않고 넘어가기"가 그 역할을 하므로 뺐다.
  // T93(2026-10-07 사용자 지시 "추가 질문도 찬성을 고려해서 질문한다"): 기존 질문("AI가
  // 잘못 승인하면 누구에게 책임을 맡기시겠습니까")은 결재권을 준다는 전제라 반대
  // 참가자에게 어색했다. byStance로 입장별 질문을 나누고(FOR는 기존 질문 그대로,
  // AGAINST는 CEO가 "AI에게 맡기지 않는다면 지금 쌓인 결재는 어떻게 풀 것인가"를
  // 묻는다), AGAINST 추천 답변 3개를 새 질문에 답하는 문장으로 다시 썼다. 조건을 묻는
  // 두 답변(LIMIT·REVIEW)은 proposeFromText 키워드("금액 한도를 정"·"표본 재검토를
  // 하")를 그대로 유지한다.
  followUp: {
    question: 'AI가 잘못 승인하면, 이사님은 누구에게 책임을 맡기시겠습니까?',
    askedBy: 'CISO',
    byStance: {
      FOR: {
        question: 'AI가 잘못 승인하면, 이사님은 누구에게 책임을 맡기시겠습니까?',
        askedBy: 'CISO',
      },
      AGAINST: {
        question: 'AI에게 맡기지 않는다면, 하루 수십 건씩 밀리는 결재는 어떻게 풀어야 할까요?',
        askedBy: 'CEO',
      },
    },
    options: [
      {
        text: '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.',
        proposeConditionId: 'OWNER',
        side: 'FOR',
      },
      {
        text: '자동 승인마다 승인 사유를 기록합시다.',
        proposeConditionId: 'LOG',
        side: 'FOR',
      },
      {
        // "책임을 누구에게"라는 질문에 맞게 — 한도 안의 결과는 이사회가 책임진다는 답.
        text: '결재 금액 한도를 정해 두고, 그 안에서 생긴 문제는 이사회가 책임집시다.',
        proposeConditionId: 'LIMIT',
        side: 'FOR',
      },
      {
        text: '사람을 더 투입하거나 순서를 바꿔 풀어야지, AI에게 맡기면 안 된다고 생각합니다.',
        proposeConditionId: null,
        side: 'AGAINST',
      },
      {
        text: '그래도 급하다면, 결재 금액 한도를 정해 일부만 맡기는 것은 다시 생각해 보겠습니다.',
        proposeConditionId: 'LIMIT',
        side: 'AGAINST',
      },
      {
        text: '그래도 급하다면, 사람이 표본 재검토를 하도록 하는 선에서는 다시 생각해 보겠습니다.',
        proposeConditionId: 'REVIEW',
        side: 'AGAINST',
      },
      {
        text: '책임을 어떻게 나눌지는 더 논의가 필요하다고 생각합니다.',
        proposeConditionId: null,
        side: 'BOTH',
      },
    ],
  },
  // PR #13 Codex 검토 이후의 번역투 문장을 T85 #14에서 사람이 회의에서 말하듯
  // 다시 썼다(의미·판단 순서는 그대로, 숫자·퍼센트는 쓰지 않는다 — NUMERIC_COPY_PATTERN).
  // T92(voting.ts의 participantStance predicate 확인): CFO·CAIO·CISO는 이미 "자기 조건이
  // 모두 채워질 때만 YES, 그 외(always)는 NO"로 짜여 있어, 참가자가 반대 입장이면서
  // 조건 일부만 제안해도(예: N1만 골라 REVIEW만 확정) 그 임원의 조건이 전부 채워지지
  // 않는 한 NO가 그대로 유지된다 — 반대 성향 임원(CFO·CISO)이 조건이 "붙어 있다는
  // 사실만으로" 찬성으로 넘어가지 않는다. CEO는 FULL_AUTO가 아니면 항상 YES를 유지한다
  // (A안 "CEO는 찬성 유지"). 참가자가 자신의 반대 조건을 전부 충족시키면(누적 확정) 그
  // 임원이 찬성으로 바뀌는 것은 "참가자 주장에 설득됨"으로 의도된 동작이라 별도
  // participantStance 분기를 추가하지 않았다(tests/domain/voting.test.ts에 반대 입장
  // 경로 회귀 테스트로 이 분포를 고정해 둔다).
  // T93: reason 전부를 같은 쉬운 말 기준으로 다시 썼다(판단 분기·조건 참조는 그대로).
  voteRules: {
    CEO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 없애면 사고가 나도 되돌릴 수 없어 반대합니다',
      },
      { when: { always: true }, vote: 'YES', reason: '느린 결재를 풀어주는 방향이라 찬성합니다' },
    ],
    CFO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 없애면 얼마나 잘못 승인됐는지 알 수 없어 반대합니다',
      },
      {
        when: { all: [{ has: 'LIMIT' }, { has: 'REVIEW' }] },
        vote: 'YES',
        reason: '돈 한도를 정하고 일부도 다시 본다니 그러면 찬성합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '돈 한도와 다시 확인하는 절차가 둘 다 있어야 찬성할 수 있어 반대합니다',
      },
    ],
    CAIO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 없애면 기록 없는 승인만 늘어 반대합니다',
      },
      {
        when: { has: 'LOG' },
        vote: 'YES',
        reason: '승인 사유를 남긴다니 그러면 찬성합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '승인 사유를 남기지 않으면 반대합니다',
      },
    ],
    CISO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 없애면 책임질 사람이 아무도 없어 반대합니다',
      },
      {
        when: { all: [{ has: 'OWNER' }, { has: 'LOG' }] },
        vote: 'YES',
        reason: '책임질 사람도 정하고 사유도 남긴다니 그러면 찬성합니다',
      },
      {
        when: { has: 'OWNER' },
        vote: 'NO',
        reason: '책임질 사람은 정했지만 사유 기록이 없어 반대합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '책임질 사람조차 정하지 않았으니 반대합니다',
      },
    ],
  },
  resultCopy: {
    pass: '수정안이 승인되었습니다. 운영 전에 확인할 조건도 함께 기록했습니다.',
    reject: '이번 안건은 부결되었습니다. 주요 우려와 이사님의 의견을 기록했습니다.',
    sixMonthsLater: {
      pass: '소액 반복 결재는 AI 에이전트가 처리합니다. 이사회가 붙인 조건이 한도·기록·재검토의 기준이 되었습니다.',
      passOriginal: 'AI 에이전트가 반복 결재를 승인합니다. 한도와 책임은 운영하면서 정해야 합니다.',
      reject: '결재는 사람이 그대로 봅니다. 이사님이 남긴 우려가 다음 안건의 출발점이 되었습니다.',
    },
  },
  remainingTasks: [
    { text: '결재 범위와 돈 한도 정하기', resolvedBy: 'LIMIT' },
    { text: '승인 이유를 어떻게 남길지', resolvedBy: 'LOG' },
    { text: '책임질 사람 정하기', resolvedBy: 'OWNER' },
  ],
  baseConditionIds: [],
  status: 'active',
};
