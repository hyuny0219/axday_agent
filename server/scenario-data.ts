// server 전용 시나리오 자료 사본. src/content/scenarios/aiAssistant.ts의 자료 본문·원안·
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

const AI_ASSISTANT_MATERIALS: ScenarioMaterials = {
  scenarioId: 'ai-assistant',
  originalMotionId: 'work-assistant-original',
  originalMotionText:
    '여러 부서 자료를 연결해 주간 보고서를 자동 작성·공유하는 AI 업무 비서를 도입한다.' +
    ' 사용자별 권한, 검토 담당자, 확대 기준은 미정이다.',
  evidence: [
    { id: 'E1', title: '실적표', content: '기준일 2026-08-31, 처리 건수 120건. 담당자 검토 완료.' },
    { id: 'E2', title: '업무 메일', content: '기준일 2026-09-01, 처리 건수 126건. 잠정 집계, 검토 전.' },
    {
      id: 'E3',
      title: '회의록',
      content: '주간 보고마다 자료 취합을 반복한다. 다음 회의 전 보고 초안 검토 담당자를 지정해야 한다.',
    },
    {
      id: 'E4',
      title: '권한·운영 메모',
      content: '부서 자료별 조회 권한이 다르다. 권한 확인, 공유 대상, 담당자 검토 절차는 아직 설계 중이다.',
    },
  ],
  conditions: [
    { id: 'PILOT', label: '작은 범위로 시작' },
    { id: 'REVIEW', label: '출처·기준일 표시 후 담당자 검토' },
    { id: 'ACCESS', label: '권한·공유 범위 확인' },
    { id: 'MEASURE', label: '준비시간·수정량 확인 후 확대' },
    { id: 'OPEN_ALL', label: '권한 검토 없이 전체 연결' },
  ],
};

const SCENARIOS: Record<string, ScenarioMaterials> = {
  'ai-assistant': AI_ASSISTANT_MATERIALS,
};

export function getScenarioMaterials(scenarioId: string): ScenarioMaterials | undefined {
  return SCENARIOS[scenarioId];
}
