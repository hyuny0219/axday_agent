// 제안 조건 칩. 자동 추출은 확정이 아닌 제안이며, 여기서 토글한 결과만 참가자가
// 확인한 것으로 취급한다(CLAUDE_IMPLEMENTATION.md 4장 "자유 입력 처리"). 실제 충돌
// 판정·확정 여부는 src/domain/conditions.ts가 계산하고, 이 컴포넌트는 그 결과를
// 보여주고 토글 요청만 상위로 올린다.
// T74(S4_Reactions 시안 그대로): REACTIONS는 이전에(DISCUSS에서) 이미 확정된 조건과
// 이번 답변에서 새로 제안된 조건을 구분해 보여준다 — 기존 확정 칩은 시안색(cyan)
// 테두리 + "✓", 새로 제안된 칩은 확정돼도 앰버 테두리 + "+ 새 조건"이다. 선택적
// newlyProposedIds가 비어 있으면(DISCUSS 기본) 전부 기존 cyan "✓" 모양 그대로다.

import type { ConflictPair, Scenario } from '../../content/types';

export interface ConditionChipsProps {
  scenario: Scenario;
  proposedIds: string[];
  acceptedIds: string[];
  conflictPairs: ConflictPair[];
  /** 자유 입력 문장에서 아무 조건도 찾지 못했을 때만 안내 문구를 보여준다. */
  showNoMatchHint: boolean;
  onToggle: (conditionId: string) => void;
  /** 이번 화면에서 새로 제안된 조건 ID(REACTIONS만 넘긴다). 확정된 칩이 이 목록에
   * 있으면 "기존 확정"(cyan "✓") 대신 "새 조건"(앰버 "+ 새 조건") 모양을 쓴다. */
  newlyProposedIds?: string[];
}

function conditionLabel(scenario: Scenario, conditionId: string): string {
  return scenario.conditions.find((condition) => condition.id === conditionId)?.label ?? conditionId;
}

// ACCESS/OPEN_ALL 충돌은 docs/SCENARIO_AI_ASSISTANT.md "추천 문구와 구조화 조건" 절의
// 문구를 그대로 쓴다. 다른 충돌쌍은 라벨을 채운 일반 템플릿을 쓴다.
const ACCESS_OPEN_ALL_MESSAGE =
  '권한 확인 후 사용 / 권한 검토 없이 연결 중 어떤 의견을 전달할까요?';

function conflictMessage(scenario: Scenario, pair: ConflictPair): string {
  const [a, b] = pair;
  const isAccessOpenAll =
    (a === 'ACCESS' && b === 'OPEN_ALL') || (a === 'OPEN_ALL' && b === 'ACCESS');
  if (isAccessOpenAll) {
    return ACCESS_OPEN_ALL_MESSAGE;
  }
  return `'${conditionLabel(scenario, a)}'와 '${conditionLabel(scenario, b)}' 중 하나만 선택해 주세요.`;
}

export function ConditionChips({
  scenario,
  proposedIds,
  acceptedIds,
  conflictPairs,
  showNoMatchHint,
  onToggle,
  newlyProposedIds = [],
}: ConditionChipsProps) {
  if (proposedIds.length === 0) {
    if (!showNoMatchHint) {
      return null;
    }
    return (
      <p className="condition-chips__hint" data-testid="condition-chips-hint">
        말씀은 회의 기록에 남깁니다. 반영할 조건이 있으면 선택해 주세요
      </p>
    );
  }

  return (
    <div className="condition-chips" data-testid="condition-chips">
      {/* T73(S3_Discuss·S4_Reactions 시안 공용 HUD 라벨): "CONDITIONS"는 시안의 장식
          라벨이었으나(STEP·EXHIBIT 등과 같은 규칙) T83에서 한국어로 바꿨다. 확정 칩의
          체크는 배지가 아니라 시안처럼 라벨 문구 끝에 그대로 붙는 글자다. */}
      <p className="condition-chips__label">조건</p>
      <div className="condition-chips__list">
        {proposedIds.map((id) => {
          const accepted = acceptedIds.includes(id);
          const isNew = newlyProposedIds.includes(id);
          const modifier = accepted ? (isNew ? ' condition-chip--new' : ' condition-chip--accepted') : '';
          return (
            <button
              key={id}
              type="button"
              className={`condition-chip${modifier}`}
              aria-pressed={accepted}
              data-testid={`condition-chip-${id}`}
              onClick={() => onToggle(id)}
            >
              {conditionLabel(scenario, id)}
              {accepted ? (isNew ? ' + 새 조건' : ' ✓') : ''}
            </button>
          );
        })}
      </div>
      {conflictPairs.length > 0 && (
        <ul className="condition-chips__conflicts" role="alert" data-testid="condition-chips-conflicts">
          {conflictPairs.map(([a, b]) => (
            <li key={`${a}-${b}`}>{conflictMessage(scenario, [a, b])}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
