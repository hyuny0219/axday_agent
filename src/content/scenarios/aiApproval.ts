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
  incident: {
    caseLabel: '사건 01',
    headline: '결재는 쌓이고, 담당자는 부재중',
    hook: '반복 결재는 월 1,240건이고, 결재자가 자리를 비우면 평균 2.8일 멈춘다.',
  },
  originalMotion: {
    id: 'ai-approval-original',
    text: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다. 범위·한도·책임·재검토 절차는 미정이다.',
  },
  evidence: [
    {
      id: 'E1',
      title: '결재 처리 기록',
      content:
        '2026-07-01~09-30, 반복 유형(비용·휴가·구매) 결재 월 평균 1,240건. 결재자 부재 시 평균 대기 2.8일.',
      insight: '반복 결재가 월 1,240건이고, 결재자가 비우면 평균 2.8일 멈춘다.',
      relatedMemberIds: ['CEO'],
    },
    {
      id: 'E2',
      title: '시범 자동승인 집계',
      content:
        '2026-08 한 부서에서 30만 원 이하 비용 결재 310건을 규칙 기반으로 자동 승인. 사후 점검에서 규칙 밖 승인 4건.',
      insight: '소액 자동 승인 310건 중 4건이 규칙을 벗어났다. 적지만 0은 아니다.',
      relatedMemberIds: ['CFO'],
    },
    {
      id: 'E3',
      title: '감사 메모',
      content: '자동 승인 건은 승인 사유가 기록되지 않아 사후 감사에서 판단 근거를 재구성할 수 없었다.',
      insight: '자동 승인은 "왜 승인했는지"가 남지 않는다. 감사가 어려워진다.',
      relatedMemberIds: ['CAIO', 'CISO'],
    },
    {
      id: 'E4',
      title: '사용자 설문',
      content: '결재 대기 때문에 업무가 지연됐다는 응답 62%. 반면 "AI가 승인한 결재를 신뢰한다"는 응답은 38%.',
      insight: '대기 불만은 크지만, AI 승인을 믿는 사람은 아직 적다.',
      relatedMemberIds: ['CISO'],
    },
  ],
  briefingSummary: {
    text:
      '반복 결재는 월 1,240건이고 결재자가 자리를 비우면 평균 2.8일 멈춥니다(결재 처리 기록). 소액 자동 승인 310건 중 4건이 규칙을 벗어났습니다(시범 자동승인 집계). 자동 승인 건은 승인 사유가 남지 않아 사후 감사에서 판단 근거를 재구성할 수 없습니다(감사 메모). 대기 불만은 크지만 AI 승인을 신뢰한다는 응답은 아직 적습니다(사용자 설문).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  chairBriefing: {
    situation: '비용·휴가·구매 같은 반복 결재가 하루 수십 건 쌓이고, 결재자가 자리를 비우면 며칠씩 멈춥니다.',
    question: 'AI 에이전트에게 결재권을 줄까요?',
    role: '의견을 내고, 필요한 조건도 직접 제안할 수 있습니다. 마지막에는 한 표를 던집니다.',
  },
  // 원안 문장(subtitle과 동일)을 "제안"과 "아직 정하지 않은 것"으로 그대로 쪼갠 것이다
  // (T52 형식 그대로, 새 사실 없음).
  motionBreakdown: {
    proposal: '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다.',
    undecidedItems: ['결재 범위와 금액 한도', '잘못 승인했을 때 책임', '사람이 다시 보는 절차'],
  },
  initialOpinions: [
    {
      memberId: 'CEO',
      text: '결재 처리 기록을 보면 사람이 자리를 비울 때 일이 멈춥니다. 이런 결재까지 붙들고 있을 순 없죠. 범위를 정해 맡겨 봅시다.',
      evidenceIds: ['E1'],
      openingStance: 'FOR',
    },
    {
      memberId: 'CFO',
      text: '시범 자동승인 집계에서 규칙 밖 승인이 4건 나왔습니다. 소액이라고 넘길 순 없죠. 한도와 사후 점검 없이는 반대입니다.',
      evidenceIds: ['E2'],
      openingStance: 'AGAINST',
    },
    {
      memberId: 'CAIO',
      text: '감사 메모를 보니 승인 이유를 되짚을 수가 없네요. 승인 사유를 남기도록 시스템부터 설계합시다. 그게 되는지 보고 판단하겠습니다.',
      evidenceIds: ['E3'],
      openingStance: 'UNDECIDED',
    },
    {
      memberId: 'CISO',
      text: '감사 메모에 승인 근거를 재구성할 수 없었다고 돼 있습니다. 이 상태로 결재권부터 줄 수는 없죠. 기록과 책임자부터 정해야 합니다.',
      evidenceIds: ['E3', 'E4'],
      openingStance: 'AGAINST',
    },
  ],
  phrases: [
    { id: 'P1', text: '결재 금액 한도를 정해 소액부터 자동 승인합시다.', conditionId: 'LIMIT' },
    { id: 'P2', text: '자동 승인마다 승인 사유를 기록합시다.', conditionId: 'LOG' },
    { id: 'P3', text: '승인 뒤 사람이 표본 재검토를 하도록 합시다.', conditionId: 'REVIEW' },
    { id: 'P4', text: '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.', conditionId: 'OWNER' },
    {
      id: 'P5',
      text: '사람 검토를 전면 생략하고 전부 자동 승인합시다.',
      conditionId: 'FULL_AUTO',
    },
    {
      id: 'P6',
      text: '맡겨도 될지 판단할 근거를 더 제시해 주십시오.',
      conditionId: null,
      tag: 'request',
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
  reactions: [
    {
      conditionId: 'LIMIT',
      memberId: 'CFO',
      text: '금액 한도를 정하면 오승인 규모를 가늠할 수 있겠습니다. 어디까지 자동 승인할지 숫자로 정합시다.',
    },
    {
      conditionId: 'LOG',
      memberId: 'CAIO',
      text: '승인 사유를 남기면 나중에라도 왜 승인했는지 되짚을 수 있습니다. 기록 형식부터 정하겠습니다.',
    },
    {
      conditionId: 'REVIEW',
      memberId: 'CFO',
      text: '표본 재검토까지 더하면 한도 안에서도 오승인을 걸러낼 수 있겠습니다.',
    },
    {
      conditionId: 'OWNER',
      memberId: 'CISO',
      text: '책임자를 지정하면 잘못된 승인이 나왔을 때 누가 설명할지 분명해집니다.',
    },
    {
      conditionId: 'FULL_AUTO',
      memberId: 'CISO',
      text: '사람 검토를 전부 생략하면 잘못된 승인이 나와도 누구도 책임질 수 없습니다.',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 기록했습니다. 다른 확인 조건이 없다면 현재 안건으로 판단하겠습니다.',
    },
  ],
  followUp: {
    question: 'AI가 잘못 승인했을 때, 이사님은 누구에게 책임을 맡기시겠습니까?',
    askedBy: 'CISO',
    options: [
      {
        text: '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.',
        proposeConditionId: 'OWNER',
      },
      {
        text: '책임을 누구에게 맡길지 더 논의합시다.',
        proposeConditionId: null,
      },
      {
        text: '앞서 전달한 의견을 유지하겠습니다.',
        proposeConditionId: null,
        keepPrevious: true,
      },
    ],
  },
  // PR #13 Codex 검토 이후의 번역투 문장을 T85 #14에서 사람이 회의에서 말하듯
  // 다시 썼다(의미·판단 순서는 그대로, 숫자·퍼센트는 쓰지 않는다 — NUMERIC_COPY_PATTERN).
  voteRules: {
    CEO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 빼면 사고가 나도 되돌릴 수 없어 반대합니다',
      },
      { when: { always: true }, vote: 'YES', reason: '늦는 결재를 푸는 방향이라 찬성합니다' },
    ],
    CFO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 빼면 얼마나 잘못 승인되는지 가늠할 수가 없어 반대합니다',
      },
      {
        when: { all: [{ has: 'LIMIT' }, { has: 'REVIEW' }] },
        vote: 'YES',
        reason: '금액 한도를 정하고 표본도 다시 본다니 그러면 찬성합니다',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '금액 한도와 표본 재검토가 둘 다 있어야 찬성할 수 있어 반대합니다',
      },
    ],
    CAIO: [
      {
        when: { has: 'FULL_AUTO' },
        vote: 'NO',
        reason: '사람 검토를 아예 빼면 기록 없는 승인만 늘어 반대합니다',
      },
      {
        when: { has: 'LOG' },
        vote: 'YES',
        reason: '승인 사유를 남긴다니 그거면 찬성합니다',
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
        reason: '사람 검토를 아예 빼면 책임질 사람이 아무도 없어 반대합니다',
      },
      {
        when: { all: [{ has: 'OWNER' }, { has: 'LOG' }] },
        vote: 'YES',
        reason: '책임자도 정하고 사유도 남긴다니 그러면 찬성합니다',
      },
      {
        when: { has: 'OWNER' },
        vote: 'NO',
        reason: '책임자는 정했지만 승인 사유 기록이 없어 반대합니다',
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
      pass: '소액 반복 결재는 Agent가 처리합니다. 이사회가 붙인 조건이 한도·기록·재검토의 기준이 되었습니다.',
      passOriginal: 'Agent가 반복 결재를 승인합니다. 한도와 책임은 운영하면서 정해야 합니다.',
      reject: '결재는 사람이 그대로 봅니다. 이사님이 남긴 우려가 다음 안건의 출발점이 되었습니다.',
    },
  },
  remainingTasks: ['결재 범위·한도 확정', '승인 사유 기록 방식', '책임자 지정'],
  baseConditionIds: [],
  status: 'active',
};
