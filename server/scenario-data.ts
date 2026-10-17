// server 전용 시나리오 자료 사본. src/content/scenarios/anonBoard.ts의 자료 본문·원안·
// 조건 라벨만 그대로 옮겨 쓴다. server는 src/에 의존하지 않는다(validate.ts와 같은 원칙).
// 표결표(voteRules)·문구(phrases)·반응(reactions)은 scripted 데모 전용이므로 여기 옮기지
// 않는다 — live 프롬프트의 정답표로 쓰지 않기 위해서다(AGENT_BOARDROOM_SPEC.md 1장).
// 시나리오 데이터가 바뀌면 이 파일도 함께 갱신해야 한다.

import type { ExecRoleId } from './validate';

export interface ScenarioEvidence {
  id: string;
  title: string;
  content: string;
}

export interface ScenarioCondition {
  id: string;
  label: string;
  /** 반대 근거(T137)면 'AGAINST'. 안건을 수정하지 않고 반대 참가자가 근거 자료를 짚는 카드다. 없으면 찬성 조건. */
  side?: 'AGAINST';
}

/**
 * 안건별 임원 렌즈(T79, 2026-10-02 사용자 결정). lens는 이 임원이 안건에서 특히 무겁게
 * 보는 관점 한 줄, evidenceIds는 그 관점과 함께 무겁게 볼 자료, opening은 OPINIONS
 * 단계에만 주는 "출발 성향"이다. 이 값들은 정답표가 아니다 — 발언 문장·최종 표는 여전히
 * 모델이 매 호출 스스로 정한다(AGENT_BOARDROOM_SPEC.md 1·2장, server/prompts/roles/index.ts의
 * buildOpeningStanceBlock이 "출발점이지 결론이 아니며" 문구로 이 원칙을 프롬프트에도 남긴다).
 */
export interface ScenarioRoleLens {
  lens: string;
  evidenceIds: string[];
  opening: 'FOR' | 'AGAINST' | 'UNDECIDED';
}

export interface ScenarioMaterials {
  scenarioId: string;
  originalMotionId: string;
  originalMotionText: string;
  evidence: ScenarioEvidence[];
  conditions: ScenarioCondition[];
  /** 활성 안건(ai-approval·experience-first)만 채운다. 보존용 안건(anon-board)은 레지스트리
   * 밖이라 비워 둬도 호출 경로에 영향이 없다 — roles/index.ts가 없으면 렌즈·출발 성향
   * 블록을 건너뛴다. */
  roleLenses?: Record<ExecRoleId, ScenarioRoleLens>;
}

const AI_APPROVAL_MATERIALS: ScenarioMaterials = {
  scenarioId: 'ai-approval',
  originalMotionId: 'ai-approval-original',
  // 화면(src/content/scenarios/aiApproval.ts subtitle)과 같은 문장. 'AI Agent'가 남아 있으면
  // 모델이 원안을 인용할 때 'Agent'가 영문 잔존 검사기(validate.ts)에 걸려 정상 응답이
  // 거절된다(PR #20 Codex 22차 검토 P2).
  originalMotionText:
    '정해진 범위의 반복 결재를 AI 에이전트가 직접 승인한다.' +
    ' 결재 범위와 금액 한도, 잘못 승인했을 때 책임, 사람이 다시 보는 절차는 미정이다.',
  // T93(2026-10-07): src/content/scenarios/aiApproval.ts의 evidence.content와 같은 쉬운 말
  // 문장으로 함께 갱신한다 — live 프롬프트(meeting_record)가 읽는 자료 본문과 화면이
  // 어긋나지 않게 한다.
  evidence: [
    {
      id: 'E1',
      title: '결재 처리 기록',
      content:
        '비용·휴가·구매 같은 결재가 한 달에 천 건 넘게 쌓입니다. 담당자가 없으면 사흘' +
        ' 가까이 멈춥니다.',
    },
    {
      id: 'E2',
      title: '시범 자동 승인 결과',
      content:
        '한 부서에서 30만 원 이하 비용 결재를 AI가 자동 승인해 봤습니다. 310건 중 4건이' +
        ' 규칙을 벗어났습니다.',
    },
    {
      id: 'E3',
      title: '감사 메모',
      content:
        '자동 승인한 건에는 승인한 이유가 남지 않았습니다. 나중에 감사할 때 이유를 확인할' +
        ' 수 없었습니다.',
    },
    {
      id: 'E4',
      title: '사용자 설문',
      content:
        '결재를 기다리다 일이 늦어진 사람이 열에 여섯입니다. AI 승인을 믿는 사람은 열에' +
        ' 넷뿐입니다.',
    },
  ],
  conditions: [
    { id: 'LIMIT', label: '결재 금액 한도' },
    { id: 'LOG', label: '승인 사유 기록' },
    { id: 'REVIEW', label: '사람이 일부 다시 보기' },
    { id: 'OWNER', label: '결재 규칙 책임자' },
    { id: 'FULL_AUTO', label: '사람 확인 없이 전부 맡기기' },
    // T137: 반대 근거(src/content/scenarios/aiApproval.ts와 같은 라벨). FOR 조건 뒤에 둔다 — mock이 역할 순서로
    // 앞의 조건을 고른다.
    { id: 'AG_AUDIT', label: '승인 이유를 확인할 수 없음', side: 'AGAINST' },
    { id: 'AG_TRUST', label: '믿지 못해 책임이 흐려짐', side: 'AGAINST' },
    { id: 'AG_SCALE', label: '넓히면 잘못 승인도 늘어남', side: 'AGAINST' },
  ],
  // T79(2026-10-02 사용자 결정): CEO 찬성 쪽·CFO 반대 쪽·CAIO 미정·CISO 반대 쪽으로 네 명이
  // 갈리게 한다. 문구는 docs/TASKS.md T79 카드에 적힌 그대로 옮긴다.
  roleLenses: {
    CEO: {
      lens: '결재 처리 기록의 대기 2.8일을 조직이 멈추는 문제로 봅니다.',
      evidenceIds: ['E1'],
      opening: 'FOR',
    },
    CFO: {
      lens: '시범 자동 승인 결과의 규칙 밖 승인을 회사 전체 규모의 비용 위험으로 봅니다.',
      evidenceIds: ['E2'],
      opening: 'AGAINST',
    },
    CAIO: {
      lens: '승인 사유를 시스템이 남길 수 있는지를 판단 기준으로 봅니다.',
      evidenceIds: ['E3'],
      opening: 'UNDECIDED',
    },
    // T137: 처음 입장을 1 찬성·1 반대·2 고민 중으로 맞췄다 — CISO는 책임과 기록이 확인되면 따를 수 있다.
    CISO: {
      lens: '감사 메모의 기록 부재를 권한 위임의 책임 문제로 봅니다.',
      evidenceIds: ['E3'],
      opening: 'UNDECIDED',
    },
  },
};

const EXPERIENCE_FIRST_MATERIALS: ScenarioMaterials = {
  scenarioId: 'experience-first',
  originalMotionId: 'experience-first-original',
  originalMotionText:
    '중요한 의사결정에서는 데이터보다 경험 있는 사람의 판단을 우선한다.' +
    ' 기준·데이터 활용·되짚기 방법은 미정이다.',
  // T93(2026-10-07): src/content/scenarios/experienceFirst.ts의 evidence.content와 같은
  // 쉬운 말 문장으로 함께 갱신한다.
  evidence: [
    {
      id: 'E1',
      title: '지난 2년 주요 결정 돌아보기',
      content:
        '지난 2년간 큰 결정 18번 중 7번은 데이터와 베테랑의 생각이 달랐습니다. 그 7번 중' +
        ' 경험이 4번, 데이터가 3번 맞았습니다.',
    },
    {
      id: 'E2',
      title: '신규 사업 예측 보고',
      content:
        '데이터 모델은 지난 3년 자료로 배웠습니다. 새 시장이나 법 변화 같은 처음 겪는 일에는' +
        ' 틀림이 두 배로 커집니다.',
    },
    {
      id: 'E3',
      title: '베테랑 인터뷰 메모',
      content:
        '경험 많은 다섯 명 중 네 명이 판단 이유를 말로 설명하기 어렵다고 했습니다. 판단은' +
        ' 빨랐지만 기록은 남지 않았습니다.',
    },
    {
      id: 'E4',
      title: '실패 사례 메모',
      content:
        '데이터가 위험하다고 했는데 경험을 따라 진행해 손해 본 일이 한 번 있습니다.' +
        ' 데이터만 믿고 현장 경고를 놓친 일도 한 번 있습니다.',
    },
  ],
  conditions: [
    { id: 'SCOPE', label: '처음 겪는 상황에서만' },
    { id: 'RECORD', label: '판단 근거 기록' },
    { id: 'DATA_VETO', label: '데이터가 경고하면 멈춤' },
    { id: 'REVIEW', label: '결정 결과 돌아보기' },
    { id: 'EXP_ONLY', label: '언제나 경험 먼저' },
    // T137: 반대 근거(src/content/scenarios/experienceFirst.ts와 같은 라벨).
    { id: 'AG_WARN', label: '경고를 넘길 핑계가 생김', side: 'AGAINST' },
    { id: 'AG_WHY', label: '판단 이유를 설명할 수 없음', side: 'AGAINST' },
    { id: 'AG_SPLIT', label: '반반인데 한쪽만 앞세움', side: 'AGAINST' },
  ],
  // T79(2026-10-02 사용자 결정): 안건①과 같은 배치(CEO 찬성·CFO 반대·CAIO 미정·CISO 반대).
  roleLenses: {
    CEO: {
      lens: '결정 돌아보기(4:3)를 어느 쪽도 늘 맞지 않으니 책임지는 사람이 방향을 잡아야 하는 문제로 봅니다.',
      evidenceIds: ['E1'],
      opening: 'FOR',
    },
    CFO: {
      lens: '실패 사례의 데이터 경고를 무시해 난 손실을 막지 못한 실패로 봅니다.',
      evidenceIds: ['E4'],
      opening: 'AGAINST',
    },
    CAIO: {
      lens: '예측 보고의 처음 겪는 상황 오차를 모델이 약한 범위로 봅니다.',
      evidenceIds: ['E2'],
      opening: 'UNDECIDED',
    },
    CISO: {
      lens: '인터뷰 메모의 기록 부재를 사후 검증 불가 문제로 봅니다.',
      evidenceIds: ['E3'],
      opening: 'UNDECIDED',
    },
  },
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

/** 확정 조건 ID를 안건에 붙는 조건과 반대 근거(T137)의 한국어 라벨로 나눈다. 라벨만 돌려주므로 프롬프트에
 * ID가 새지 않는다. 알 수 없는 ID는 건너뛴다. */
export function splitConditionLabels(
  materials: ScenarioMaterials,
  conditionIds: readonly string[],
): { conditions: string[]; objections: string[] } {
  const byId = new Map(materials.conditions.map((c) => [c.id, c] as const));
  const result = { conditions: [] as string[], objections: [] as string[] };
  for (const id of conditionIds) {
    const condition = byId.get(id);
    if (!condition) continue;
    (condition.side === 'AGAINST' ? result.objections : result.conditions).push(condition.label);
  }
  return result;
}

export function getScenarioMaterials(scenarioId: string): ScenarioMaterials | undefined {
  return SCENARIOS[scenarioId];
}
