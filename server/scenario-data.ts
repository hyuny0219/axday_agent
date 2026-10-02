// server 전용 시나리오 자료 사본. src/content/scenarios/anonBoard.ts의 자료 본문·원안·
// 조건 라벨만 그대로 옮겨 쓴다. server는 src/에 의존하지 않는다(validate.ts와 같은 원칙).
// 표결표(voteRules)·문구(phrases)·반응(reactions)은 scripted 데모 전용이므로 여기 옮기지
// 않는다 — live 프롬프트의 정답표로 쓰지 않기 위해서다(AGENT_BOARDROOM_SPEC.md 1장).
// 시나리오 데이터가 바뀌면 이 파일도 함께 갱신해야 한다.

export interface ScenarioEvidence {
  id: string;
  title: string;
  content: string;
}

export interface ScenarioCondition {
  id: string;
  label: string;
}

export interface ScenarioMaterials {
  scenarioId: string;
  originalMotionId: string;
  originalMotionText: string;
  evidence: ScenarioEvidence[];
  conditions: ScenarioCondition[];
}

const AI_APPROVAL_MATERIALS: ScenarioMaterials = {
  scenarioId: 'ai-approval',
  originalMotionId: 'ai-approval-original',
  originalMotionText:
    '정해진 범위의 반복 결재를 AI Agent가 직접 승인한다.' +
    ' 범위·한도·책임·재검토 절차는 미정이다.',
  evidence: [
    {
      id: 'E1',
      title: '결재 처리 기록',
      content:
        '2026-07-01~09-30, 반복 유형(비용·휴가·구매) 결재 월 평균 1,240건. 결재자 부재 시 평균 대기 2.8일.',
    },
    {
      id: 'E2',
      title: '시범 자동승인 집계',
      content:
        '2026-08 한 부서에서 30만 원 이하 비용 결재 310건을 규칙 기반으로 자동 승인. 사후 점검에서 규칙 밖 승인 4건.',
    },
    {
      id: 'E3',
      title: '감사 메모',
      content: '자동 승인 건은 승인 사유가 기록되지 않아 사후 감사에서 판단 근거를 재구성할 수 없었다.',
    },
    {
      id: 'E4',
      title: '사용자 설문',
      content: '결재 대기 때문에 업무가 지연됐다는 응답 62%. 반면 "AI가 승인한 결재를 신뢰한다"는 응답은 38%.',
    },
  ],
  conditions: [
    { id: 'LIMIT', label: '결재 금액 한도' },
    { id: 'LOG', label: '승인 사유 기록' },
    { id: 'REVIEW', label: '사람 표본 재검토' },
    { id: 'OWNER', label: '결재 규칙 책임자' },
    { id: 'FULL_AUTO', label: '사람 검토 전면 생략' },
  ],
};

const EXPERIENCE_FIRST_MATERIALS: ScenarioMaterials = {
  scenarioId: 'experience-first',
  originalMotionId: 'experience-first-original',
  originalMotionText:
    '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다.' +
    ' 기준·데이터 활용·되짚기 방법은 미정이다.',
  evidence: [
    {
      id: 'E1',
      title: '지난 2년 주요 결정 복기',
      content:
        '주요 결정 18건 중 데이터 예측과 베테랑 판단이 갈린 7건. 결과적으로 경험이 맞은 경우 4건, 데이터가 맞은 경우 3건.',
    },
    {
      id: 'E2',
      title: '신규 사업 예측 보고',
      content: '데이터 모델은 최근 3년 자료로 학습됐고, 전례 없는 상황(신시장·규제 변화)에서는 오차가 2배로 커졌다.',
    },
    {
      id: 'E3',
      title: '베테랑 인터뷰 메모',
      content: '경험자 5명 중 4명이 "판단 근거를 말로 설명하기 어렵다"고 답했다. 판단은 빨랐지만 기록은 남지 않았다.',
    },
    {
      id: 'E4',
      title: '실패 사례 메모',
      content:
        '데이터가 명확히 경고했는데 경험을 따라 진행해 손실이 난 사례 1건. 반대로 데이터만 믿고 현장 경고를 놓친 사례 1건.',
    },
  ],
  conditions: [
    { id: 'SCOPE', label: '전례 없는 상황 한정' },
    { id: 'RECORD', label: '판단 근거 기록' },
    { id: 'DATA_VETO', label: '데이터 경고 시 멈춤' },
    { id: 'REVIEW', label: '결정 결과 복기' },
    { id: 'EXP_ONLY', label: '경험 판단 절대 우선' },
  ],
};

// 이전 안건(보존, T78에서 레지스트리 제거 — src/content/scenarios/anonBoard.ts와 같은
// 처리). 자료는 그대로 두되 SCENARIOS 조회표에는 더는 올리지 않는다. export로 남겨
// noUnusedLocals에 걸리지 않게 하고 되돌릴 때 바로 쓸 수 있게 한다.
export const ANON_BOARD_MATERIALS: ScenarioMaterials = {
  scenarioId: 'anon-board',
  originalMotionId: 'anon-board-original',
  originalMotionText:
    '사내 게시판을 익명제로 전환한다.' +
    ' 작성자 추적 범위, 게시 전 검수, 임원 열람 범위는 미정이다.',
  evidence: [
    {
      id: 'E1',
      title: '게시판 운영 기록',
      content: '집계 기간 2026-06-01~08-31, 실명 게시글 월 평균 320건. 전사 게시판 기준.',
    },
    {
      id: 'E2',
      title: '시범 게시판 집계',
      content:
        '집계 기간 2026-08-15~09-14, 익명 시범 게시글 월 140건. 참여 부서 일부, 집계 기간과 범위가 게시판 운영 기록과 다르다.',
    },
    {
      id: 'E3',
      title: '운영 회의록',
      content:
        '신고 처리 절차는 있으나 담당자 지정이 없다. 신고가 들어올 때마다 담당을 새로 정하고 있다.',
    },
    {
      id: 'E4',
      title: '정보보호 메모',
      content:
        '접속 로그 보관 기간과 작성자 추적 권한은 아직 설계 중이다. 익명 표시와 로그 보관은 별개 문제다.',
    },
  ],
  conditions: [
    { id: 'PILOT', label: '한 게시판에서 시범' },
    { id: 'SCREEN', label: '게시 전 검수' },
    { id: 'TRACE', label: '문제 발생 시 추적 가능' },
    { id: 'MEASURE', label: '운영 효과 측정 후 확대' },
    { id: 'ANON_FULL', label: '완전 익명 — 추적 불가' },
  ],
};

const SCENARIOS: Record<string, ScenarioMaterials> = {
  'ai-approval': AI_APPROVAL_MATERIALS,
  'experience-first': EXPERIENCE_FIRST_MATERIALS,
};

export function getScenarioMaterials(scenarioId: string): ScenarioMaterials | undefined {
  return SCENARIOS[scenarioId];
}
