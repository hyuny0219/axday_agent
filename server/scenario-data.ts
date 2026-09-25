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

const ANON_BOARD_MATERIALS: ScenarioMaterials = {
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
  'anon-board': ANON_BOARD_MATERIALS,
};

export function getScenarioMaterials(scenarioId: string): ScenarioMaterials | undefined {
  return SCENARIOS[scenarioId];
}
