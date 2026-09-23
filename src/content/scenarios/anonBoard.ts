// 안건 ② — 사내 게시판을 익명제로 전환할까 (docs/SCENARIO_ANON_BOARD.md 그대로 옮김)
// 본 시나리오의 수치·대사·의결 규칙은 체험용 가상 설정이며 실제 삼성화재 자료가 아니다.
// 구조는 이전 안건(aiAssistant.ts)과 같다 — 조건 5개, 상충 1쌍, 표결 규칙 12행.

import type { Scenario } from '../types';

export const anonBoardScenario: Scenario = {
  id: 'anon-board',
  title: '익명이면 말할 수 있을까',
  selectLine: '익명이면 말할 수 있을까',
  subtitle:
    '사내 게시판을 익명제로 전환한다. 작성자 추적 범위, 게시 전 검수, 임원 열람 범위는 미정이다.',
  incident: {
    caseLabel: '사건 02',
    headline: '익명 게시판을 열어 달라는 요구가 쌓였지만, 운영 기준이 없다',
    hook: '실명 게시판은 월 320건, 익명 시범은 월 140건. 집계 기간이 달라 어느 쪽이 더 활발한지 이 자료만으로는 알 수 없다.',
  },
  originalMotion: {
    id: 'anon-board-original',
    text: '사내 게시판을 익명제로 전환한다. 작성자 추적 범위, 게시 전 검수, 임원 열람 범위는 미정이다.',
  },
  evidence: [
    {
      id: 'E1',
      title: '게시판 운영 기록',
      content: '집계 기간 2026-06-01~08-31, 실명 게시글 월 평균 320건. 전사 게시판 기준.',
      insight: '실명 게시판은 월 평균 320건(3개월, 전사 기준).',
      relatedMemberIds: ['CFO'],
    },
    {
      id: 'E2',
      title: '시범 게시판 집계',
      content:
        '집계 기간 2026-08-15~09-14, 익명 시범 게시글 월 140건. 참여 부서 일부, 집계 기간과 범위가 E1과 다르다.',
      insight: '익명 시범은 월 140건이지만 기간·범위가 달라 실명 기록과 직접 비교할 수 없다.',
      relatedMemberIds: ['CFO', 'CAIO'],
    },
    {
      id: 'E3',
      title: '운영 회의록',
      content:
        '신고 처리 절차는 있으나 담당자 지정이 없다. 신고가 들어올 때마다 담당을 새로 정하고 있다.',
      insight: '신고를 처리할 담당자가 지정돼 있지 않다. 글이 늘면 처리도 늘어난다.',
      relatedMemberIds: ['CEO', 'CFO'],
    },
    {
      id: 'E4',
      title: '정보보호 메모',
      content:
        '접속 로그 보관 기간과 작성자 추적 권한은 아직 설계 중이다. 익명 표시와 로그 보관은 별개 문제다.',
      insight: '로그 보관 기간과 추적 권한이 아직 설계 중이다. 전환 전 확인이 필요하다.',
      relatedMemberIds: ['CISO', 'CAIO'],
    },
  ],
  briefingSummary: {
    text: '실명 320건과 익명 시범 140건은 집계 기간과 참여 범위가 다릅니다. 같은 기준으로 확인하기 전에는 어느 쪽이 더 활발한지 판단할 수 없습니다. 신고 처리 담당자는 아직 지정돼 있지 않습니다(E3). 로그 보관 기간과 작성자 추적 권한은 설계 중입니다(E4).',
    evidenceIds: ['E1', 'E2', 'E3', 'E4'],
  },
  chairBriefing: {
    situation:
      '익명 게시판을 열어 달라는 요구가 반복되지만, 운영 기준은 아직 정해져 있지 않습니다.',
    question: '사내 게시판을 익명제로 바꿀까요?',
    role: '의견을 내고, 필요한 조건도 직접 제안할 수 있습니다. 마지막에는 한 표를 던집니다.',
  },
  // 원안 문장(subtitle과 동일)을 "제안"과 "아직 정하지 않은 것"으로 그대로 쪼갠 것이다
  // (T52, 새 사실 없음).
  motionBreakdown: {
    proposal: '사내 게시판을 익명제로 전환한다.',
    undecidedItems: ['작성자 추적 범위', '게시 전 검수', '임원 열람 범위'],
  },
  initialOpinions: [
    {
      memberId: 'CEO',
      text: '솔직한 목소리가 올라오는 것은 좋지만, 조직 신뢰가 상하지 않아야 합니다.',
      evidenceIds: ['E1'],
    },
    {
      memberId: 'CFO',
      text: '글이 늘면 신고와 검토 공수도 늡니다. 처리 담당자부터 필요합니다.',
      evidenceIds: ['E2', 'E3'],
    },
    {
      memberId: 'CAIO',
      text: '익명 처리와 중복 계정 차단을 계정 체계와 어떻게 연결할지 정해야 합니다.',
      evidenceIds: ['E2', 'E4'],
    },
    {
      memberId: 'CISO',
      text: '로그 보관 기간과 추적 권한이 설계되지 않았습니다. 익명 표시와 로그는 별개입니다.',
      evidenceIds: ['E4'],
    },
  ],
  phrases: [
    { id: 'P1', text: '한 게시판에서 먼저 시범 운영합시다.', conditionId: 'PILOT' },
    { id: 'P2', text: '게시 전 검수 절차를 두고 시작합시다.', conditionId: 'SCREEN' },
    {
      id: 'P3',
      text: '문제가 생기면 작성자를 확인할 수 있게 해 둡시다.',
      conditionId: 'TRACE',
    },
    { id: 'P4', text: '운영 효과를 측정한 뒤 전사로 넓힙시다.', conditionId: 'MEASURE' },
    {
      id: 'P5',
      text: '작성자를 누구도 추적할 수 없는 완전 익명으로 합시다.',
      conditionId: 'ANON_FULL',
    },
    {
      id: 'P6',
      text: '아직 확인할 것이 많습니다. 운영 기준을 더 정리해 주십시오.',
      conditionId: null,
      tag: 'request',
    },
  ],
  conditions: [
    {
      id: 'PILOT',
      label: '한 게시판에서 시범',
      keywords: ['시범', '파일럿', '한 게시판', '작은 범위'],
    },
    {
      id: 'SCREEN',
      label: '게시 전 검수',
      keywords: ['검수', '게시 전', '사전 확인', '걸러'],
    },
    {
      id: 'TRACE',
      label: '문제 발생 시 추적 가능',
      // '추적' 한 단어만 두면 "추적할 수 없는 완전 익명"(ANON_FULL) 문장에도 걸려
      // 상충하는 두 조건이 동시에 제안된다. 긍정형 표현으로 좁힌다.
      // '신고가 들어온'은 넣지 않는다 — 후속 빠른 답 "신고가 들어온 뒤에 처리해도
      // 충분합니다."(조건 없음)에 걸려 TRACE가 몰래 확정된다(PR #10 Codex 5차 검토 P1).
      // 빠른 답 문구는 선택 즉시 초안이 되어 proposeFromText()를 거친다.
      keywords: ['추적 가능', '작성자를 확인', '확인할 수 있게'],
    },
    {
      id: 'MEASURE',
      label: '운영 효과 측정 후 확대',
      keywords: ['효과', '측정', '확대', '넓히'],
    },
    {
      id: 'ANON_FULL',
      label: '완전 익명 — 추적 불가',
      keywords: ['완전 익명', '추적할 수 없', '추적 불가', '누구도 확인'],
    },
  ],
  conflicts: [['TRACE', 'ANON_FULL']],
  reactions: [
    {
      conditionId: 'PILOT',
      memberId: 'CFO',
      text: '한 게시판에서 시작하면 처리 공수를 가늠할 수 있겠습니다. 무엇을 셀까요?',
    },
    {
      conditionId: 'SCREEN',
      memberId: 'CAIO',
      text: '게시 전 검수는 운영 인력과 처리 시간을 함께 정해야 돌아갑니다.',
    },
    {
      conditionId: 'TRACE',
      memberId: 'CISO',
      text: '추적 가능으로 두면 로그 보관 기간과 열람 권한을 먼저 정해야 합니다.',
    },
    {
      conditionId: 'MEASURE',
      memberId: 'CFO',
      text: '운영 효과를 확대 판단의 기준으로 삼겠습니다.',
    },
    {
      conditionId: 'ANON_FULL',
      memberId: 'CISO',
      text: '누구도 추적할 수 없으면 문제 글이 올라왔을 때 대응할 방법이 없습니다.',
    },
    {
      conditionId: 'none',
      memberId: 'CEO',
      text: '말씀은 기록했습니다. 다른 확인 조건이 없다면 현재 안건으로 판단하겠습니다.',
    },
  ],
  // 후속 질문은 앞 단계에서 확정한 조건이 아니라 '아직 다루지 않은 쟁점'을 끌어낸다
  // (E3: 신고 처리 담당자가 지정돼 있지 않다).
  followUp: {
    question: '글이 늘면 신고 처리는 누가 맡습니까? 지금은 지정된 담당자가 없습니다.',
    askedBy: 'CFO',
    options: [
      {
        text: '게시 전 검수 절차를 두고 담당자를 지정합시다.',
        proposeConditionId: 'SCREEN',
      },
      {
        text: '신고가 들어온 뒤에 처리해도 충분합니다.',
        proposeConditionId: null,
      },
      {
        text: '앞서 전달한 의견을 유지하겠습니다.',
        proposeConditionId: null,
        keepPrevious: true,
      },
    ],
  },
  // 판단 이유 한 줄(v1.0 T48). 조건 라벨을 그대로 인용하고 새 사실을 만들지 않는다.
  voteRules: {
    CEO: [
      {
        when: { has: 'ANON_FULL' },
        vote: 'HOLD',
        reason: '완전 익명 — 추적 불가 조건이 있어 보류',
      },
      { when: { always: true }, vote: 'YES', reason: '솔직한 목소리를 여는 방향에 찬성' },
    ],
    CFO: [
      {
        when: { has: 'ANON_FULL' },
        vote: 'NO',
        reason: '완전 익명 — 추적 불가 조건이 있어 신고 처리 부담을 가늠할 수 없어 반대',
      },
      {
        when: { all: [{ has: 'PILOT' }, { has: 'MEASURE' }] },
        vote: 'YES',
        reason: '한 게시판에서 시범과 운영 효과 측정 후 확대 조건이 있어 찬성',
      },
      {
        when: { always: true },
        vote: 'HOLD',
        reason: '한 게시판에서 시범과 운영 효과 측정 후 확대 조건이 함께 있지 않아 보류',
      },
    ],
    CAIO: [
      {
        when: { has: 'ANON_FULL' },
        vote: 'NO',
        reason: '완전 익명 — 추적 불가 조건이 있어 중복 계정·악용을 막을 수단이 없어 반대',
      },
      {
        when: { has: 'SCREEN' },
        vote: 'YES',
        reason: '게시 전 검수 조건이 있어 찬성',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '게시 전 검수 조건이 없어 반대',
      },
    ],
    CISO: [
      {
        when: { has: 'ANON_FULL' },
        vote: 'NO',
        reason: '완전 익명 — 추적 불가 조건이 있어 문제 발생 시 대응할 방법이 없어 반대',
      },
      {
        when: { all: [{ has: 'TRACE' }, { has: 'SCREEN' }] },
        vote: 'YES',
        reason: '문제 발생 시 추적 가능과 게시 전 검수 조건이 있어 찬성',
      },
      {
        when: { has: 'TRACE' },
        vote: 'HOLD',
        reason: '문제 발생 시 추적 가능 조건은 있으나 게시 전 검수 조건이 없어 보류',
      },
      {
        when: { always: true },
        vote: 'NO',
        reason: '문제 발생 시 추적 가능 조건이 없어 반대',
      },
    ],
  },
  resultCopy: {
    pass: '수정안이 승인되었습니다. 운영 전에 확인할 조건도 함께 기록했습니다.',
    hold: '추가 검토 후 다시 심의합니다. 이사님의 확인 요청을 기록했습니다.',
    reject: '이번 안건은 부결되었습니다. 주요 우려와 이사님의 의견을 기록했습니다.',
    sixMonthsLater: {
      pass: '익명 게시판에 글이 늘었습니다. 이사회가 붙인 조건이 신고 처리와 검수의 기준이 되었습니다.',
      passOriginal:
        '익명 게시판에 글이 늘었습니다. 추적 범위와 검수 절차는 운영하면서 정해야 합니다.',
      hold: '신고 처리와 로그 기준을 정리한 뒤 안건이 다시 상정됩니다. 그때까지 게시판은 실명으로 운영됩니다.',
      reject: '게시판은 실명 그대로입니다. 이사님이 남긴 우려가 다음 안건의 출발점이 되었습니다.',
    },
  },
  remainingTasks: ['신고 처리 담당자 지정', '로그 보관 기간 확정', '운영 효과 측정'],
  baseConditionIds: [],
  status: 'active',
};
