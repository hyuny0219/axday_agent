// 제안 조건 칩. 자동 추출은 확정이 아닌 제안이며, 여기서 토글한 결과만 참가자가
// 확인한 것으로 취급한다(CLAUDE_IMPLEMENTATION.md 4장 "자유 입력 처리"). 실제 충돌
// 판정·확정 여부는 src/domain/conditions.ts가 계산하고, 이 컴포넌트는 그 결과를
// 보여주고 토글 요청만 상위로 올린다.

import type { ConflictPair, Scenario } from '../../content/types';

export interface ConditionChipsProps {
  scenario: Scenario;
  proposedIds: string[];
  acceptedIds: string[];
  conflictPairs: ConflictPair[];
  /** 자유 입력 문장에서 아무 조건도 찾지 못했을 때만 안내 문구를 보여준다. */
  showNoMatchHint: boolean;
  onToggle: (conditionId: string) => void;
}

function conditionLabel(scenario: Scenario, conditionId: string): string {
  return scenario.conditions.find((condition) => condition.id === conditionId)?.label ?? conditionId;
}

export function ConditionChips({
  scenario,
  proposedIds,
  acceptedIds,
  conflictPairs,
  showNoMatchHint,
  onToggle,
}: ConditionChipsProps) {
  if (proposedIds.length === 0) {
    if (!showNoMatchHint) {
      return null;
    }
    return (
      <p className="condition-chips__hint" data-testid="condition-chips-hint">
        말씀은 회의 기록에 남깁니다. 반영할 조건이 있으면 선택해 주세요.
      </p>
    );
  }

  return (
    <div className="condition-chips" data-testid="condition-chips">
      <p className="condition-chips__label">확인할 조건</p>
      <div className="condition-chips__list">
        {proposedIds.map((id) => {
          const accepted = acceptedIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              className={`condition-chip${accepted ? ' condition-chip--accepted' : ''}`}
              aria-pressed={accepted}
              data-testid={`condition-chip-${id}`}
              onClick={() => onToggle(id)}
            >
              {conditionLabel(scenario, id)}
            </button>
          );
        })}
      </div>
      {conflictPairs.length > 0 && (
        <ul className="condition-chips__conflicts" role="alert" data-testid="condition-chips-conflicts">
          {conflictPairs.map(([a, b]) => (
            <li key={`${a}-${b}`}>
              '{conditionLabel(scenario, a)}'와 '{conditionLabel(scenario, b)}' 중 하나만 선택해
              주세요.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
