// 안건 ② — 보고 준비에 쓰는 시간을 되찾아라 (docs/SCENARIO_AI_ASSISTANT.md 그대로 옮김)
// 본 시나리오의 수치·대사·의결 규칙은 프로토타입 구현을 위한 가상 설정이며 실제 삼성화재 자료가 아니다.

import type { Scenario } from '../types';

export const aiAssistantScenario: Scenario = {
  id: 'ai-assistant',
  title: '보고 준비에 쓰는 시간을 되찾아라',
  selectLine: '보고 준비에 쓰는 시간을 되찾아라',
  subtitle:
    '여러 부서 자료를 연결해 주간 보고서를 자동 작성·공유하는 AI 업무 비서를 도입한다. 사용자별 권한, 검토 담당자, 확대 기준은 미정이다.',
  originalMotion: {
    id: 'work-assistant-original',
    text: '여러 부서 자료를 연결해 주간 보고서를 자동 작성·공유하는 AI 업무 비서를 도입한다. 사용자별 권한, 검토 담당자, 확대 기준은 미정이다.',
  },
  evidence: [
    {
      id: 'E1',
      title: '실적표',
      content: '기준일 2026-08-31, 처리 건수 120건. 담당자 검토 완료.',
      insight: '검토 완료 수치 120건(8/31 기준).',
      relatedMemberIds: ['CIO'],
    },
    {
      id: 'E2',
      title: '업무 메일',
      content: '기준일 2026-09-01, 처리 건수 126건. 잠정 집계, 검토 전.',
      insight:
        '잠정 수치 126건(9/1 기준, 검토 전). E1과 다르며 어느 쪽이 최종인지는 이 자료만으로 알 수 없다.',
      relatedMemberIds: ['CIO'],
    },
    {
      id: 'E3',
      title: '회의록',
      content: '주간 보고마다 자료 취합을 반복한다. 다음 회의 전 보고 초안 검토 담당자를 지정해야 한다.',
      insight: '취합이 매주 반복된다. 자동화 효과의 근거이자, 검토 담당자가 아직 없다는 뜻이다.',
      relatedMemberIds: ['CEO', 'CFO_CAIO'],
    },
    {
      id: 'E4',
      title: '권한·운영 메모',
      content: '부서 자료별 조회 권한이 다르다. 권한 확인, 공유 대상, 담당자 검토 절차는 아직 설계 중이다.',
      insight: '권한·공유 범위가 아직 설계 중이다. 도입 전 확인이 필요하다.',
      relatedMemberIds: ['CISO'],
    },
  ],
  briefingSummary: {
    text: '120건과 126건은 기준일과 검토 상태가 다릅니다. 동일 기준으로 확인이 필요하며, 어느 값이 최종 확정 수치인지는 현재 자료만으로 판단할 수 없습니다. 회의 전 초안 검토 담당자 지정이 필요합니다(E3). 조회 권한과 공유 범위는 아직 설계 중입니다(E4).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  chairBriefing: {
    situation:
      '주간 보고마다 부서 자료를 손으로 모으고 있습니다. 보고 준비에 쓰던 시간을 판단과 실행에 돌려줄 수 있을까요?',
    question: '이 일을 AI 업무 비서에 맡길지 정합니다. 도입할까요? 한다면 어떤 조건을 붙일까요?',
    role: '특별 이사님은 조건을 붙여 의견을 내시고, 마지막에 한 표를 던지시면 됩니다.',
  },
  briefingIssues: [
    { text: '숫자가 자료마다 다릅니다.', evidenceIds: ['E1', 'E2'] },
    { text: '초안을 검토할 담당자가 없습니다.', evidenceIds: ['E3'] },
    { text: '권한과 공유 범위가 정해지지 않았습니다.', evidenceIds: ['E4'] },
  ],
  previewConditionIds: ['PILOT', 'REVIEW', 'ACCESS', 'MEASURE'],
  initialOpinions: [
    { memberId: 'CEO', text: '보고 준비를 줄이고 판단과 실행에 시간을 씁시다.', evidenceIds: ['E3'] },
    {
      memberId: 'CFO_CAIO',
      text: '작은 범위에서 준비시간과 수정량을 먼저 확인합시다.',
      evidenceIds: ['E3'],
    },
    {
      memberId: 'CIO',
      text: '출처·기준일을 표시하고 담당자가 확인해야 합니다.',
      evidenceIds: ['E1', 'E2'],
    },
    { memberId: 'CISO', text: '접근 권한과 공유 범위를 먼저 명확히 해야 합니다.', evidenceIds: ['E4'] },
  ],
  phrases: [
    { id: 'P1', text: '주간 보고 초안부터 작은 범위로 시작합시다.', conditionId: 'PILOT' },
    {
      id: 'P2',
      text: '출처와 기준일을 표시하고 담당자가 검토한 뒤 공유합시다.',
      conditionId: 'REVIEW',
    },
    {
      id: 'P3',
      text: '사용자 권한과 공유 범위를 확인한 자료만 사용합시다.',
      conditionId: 'ACCESS',
    },
    { id: 'P4', text: '준비시간과 수정량을 확인한 뒤 확대합시다.', conditionId: 'MEASURE' },
    {
      id: 'P5',
      text: '권한 검토 없이 모든 부서 자료를 바로 연결합시다.',
      conditionId: 'OPEN_ALL',
    },
    {
      id: 'P6',
      text: '아직 확인할 것이 많습니다. 검증 자료를 더 요청합시다.',
      conditionId: null,
      tag: 'request',
    },
  ],
  conditions: [
    {
      id: 'PILOT',
      label: '작은 범위로 시작',
      keywords: ['작은 범위', '파일럿', '시범', '주간 보고 초안'],
    },
    {
      id: 'REVIEW',
      label: '출처·기준일 표시 후 담당자 검토',
      keywords: ['담당자 검토', '담당자가 검토', '출처', '기준일'],
    },
    {
      id: 'ACCESS',
      label: '권한·공유 범위 확인',
      keywords: ['권한', '공유 범위', '접근 권한'],
    },
    {
      id: 'MEASURE',
      label: '준비시간·수정량 확인 후 확대',
      keywords: ['준비시간', '수정량', '효과를 확인'],
    },
    {
      id: 'OPEN_ALL',
      label: '권한 검토 없이 전체 연결',
      keywords: ['권한 검토 없이', '모든 부서', '바로 연결', '전부 연결'],
    },
  ],
  conflicts: [['ACCESS', 'OPEN_ALL']],
  reactions: [
    {
      conditionId: 'PILOT',
      memberId: 'CFO_CAIO',
      text: '작게 시작하면 효과를 확인할 수 있겠습니다. 무엇을 측정할까요?',
    },
    {
      conditionId: 'REVIEW',
      memberId: 'CIO',
      text: '출처·기준일 표시와 공유 전 담당자 확인 절차를 수정안에 넣겠습니다.',
    },
    {
      conditionId: 'ACCESS',
      memberId: 'CISO',
      text: '권한과 공유 범위를 조건으로 넣겠습니다. 실제 검증은 착수 전에 필요합니다.',
    },
    {
      conditionId: 'MEASURE',
      memberId: 'CFO_CAIO',
      text: '준비시간과 수정량을 확대 판단의 기준으로 삼겠습니다.',
    },
    {
      conditionId: 'OPEN_ALL',
      memberId: 'CISO',
      text: '권한 검토 없이 연결하는 방식에는 우려가 남습니다.',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 기록했습니다. 다른 확인 조건이 없다면 현재 안건으로 판단하겠습니다.',
    },
  ],
  followUp: {
    question: '메일과 실적표의 숫자가 다르면 어떻게 처리할까요?',
    askedBy: 'CIO',
    options: [
      {
        text: '출처·기준일 차이를 표시하고 담당자가 확인한 뒤 공유합시다.',
        proposeConditionId: 'REVIEW',
      },
      {
        text: '최신 메일 값으로 바로 공유합시다.',
        proposeConditionId: null,
      },
      {
        text: '앞서 전달한 의견을 유지하겠습니다.',
        proposeConditionId: null,
        keepPrevious: true,
      },
    ],
  },
  voteRules: {
    CEO: [
      { when: { has: 'OPEN_ALL' }, vote: 'HOLD' },
      { when: { always: true }, vote: 'YES' },
    ],
    CFO_CAIO: [
      { when: { has: 'OPEN_ALL' }, vote: 'NO' },
      { when: { all: [{ has: 'PILOT' }, { has: 'MEASURE' }] }, vote: 'YES' },
      { when: { always: true }, vote: 'HOLD' },
    ],
    CIO: [
      { when: { has: 'OPEN_ALL' }, vote: 'NO' },
      { when: { has: 'REVIEW' }, vote: 'YES' },
      { when: { always: true }, vote: 'NO' },
    ],
    CISO: [
      { when: { has: 'OPEN_ALL' }, vote: 'NO' },
      { when: { all: [{ has: 'ACCESS' }, { has: 'REVIEW' }] }, vote: 'YES' },
      { when: { has: 'ACCESS' }, vote: 'HOLD' },
      { when: { always: true }, vote: 'NO' },
    ],
  },
  resultCopy: {
    pass: '수정안이 승인되었습니다. 실행 전에 확인할 조건도 함께 기록했습니다.',
    hold: '추가 검토 후 다시 심의합니다. 이사님의 확인 요청을 기록했습니다.',
    reject: '이번 안건은 부결되었습니다. 주요 우려와 이사님의 의견을 기록했습니다.',
  },
  remainingTasks: ['권한 검증', '검토 담당자 지정', '파일럿 성과 측정'],
  baseConditionIds: [],
  status: 'active',
};
