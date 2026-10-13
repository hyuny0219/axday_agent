// 추천 문구 체크 카드. 라벨(label) 전체를 클릭 영역으로 삼아 내부 실제 checkbox
// input을 토글한다. 브라우저 네이티브 label↔input 연결을 쓰므로 카드 클릭과 체크박스
// 클릭이 각각 이벤트를 만들어 두 번 토글되는 문제가 생기지 않는다
// (DESIGN_SPEC.md 7장 "카드의 라벨을 포함한 전체 영역을 한 번 클릭해 선택/해제한다").
// 선택 상태를 "찬성"으로 표기하지 않는다(DESIGN_SPEC.md 4장 "의견 체크 카드").
// T73(S3_Discuss 시안 그대로): 네이티브 체크박스를 화면에서는 숨기고(옵션 자체는 그대로
// 토글 가능하게 둔다), 시안의 커스텀 체크 박스(테두리 사각형 + 체크 SVG)를 별도 span으로
// 그린다.
// T74(S4_Reactions 시안 그대로): REACTIONS의 추천 답변 체크 카드도 같은 모양이라
// ReactionsScreen이 이 컴포넌트를 그대로 재사용한다 — phrase는 id·text만 읽으므로 전체
// Phrase가 아니라 그 둘만 받고(FollowUpOption에는 conditionId가 없다), testId를 주면
// 기본 `phrase-card-<id>` 대신 그 값을 쓴다(REACTIONS는 기존 `followup-option-<n>`을
// 그대로 유지해야 e2e가 깨지지 않는다).
// PR #12 Codex 5차 검토(P2): 선택적 disabled를 더했다 — REACTIONS가 RebuildConfirm이
// 뜬 동안(아직 "직접 쓴 내용 유지/다시 구성"을 고르지 않은 동안) 추천 답변 카드를
// 모두 잠가, 그중 "앞서 전달한 의견을 유지하겠습니다"(onKeepPrevious로 즉시 다음
// 단계로 넘어가는 카드)를 눌러 확인을 건너뛰고 그대로 넘어가는 경로를 막는다.
// 기본값은 false라 DISCUSS 호출부는 바뀌지 않는다.

import type { Phrase } from '../../content/types';
import { nextStepAttr } from './focusRing';

export interface PhraseCardProps {
  phrase: Pick<Phrase, 'id' | 'text'>;
  selected: boolean;
  onToggle: () => void;
  testId?: string;
  disabled?: boolean;
  /** T113: 지금 눌러야 할 다음 할 일이면 점선 테두리(`data-next-step`)를 붙인다. */
  nextStep?: boolean;
}

export function PhraseCard({ phrase, selected, onToggle, testId, disabled = false, nextStep = false }: PhraseCardProps) {
  return (
    <label
      className={`phrase-card${selected ? ' phrase-card--selected' : ''}${
        disabled ? ' phrase-card--disabled' : ''
      }`}
      data-testid={testId ?? `phrase-card-${phrase.id}`}
      {...nextStepAttr(nextStep)}
    >
      <input
        type="checkbox"
        className="phrase-card__input"
        checked={selected}
        onChange={onToggle}
        disabled={disabled}
      />
      <span className="phrase-card__checkbox" aria-hidden="true">
        {selected && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </span>
      <span className="phrase-card__text">{phrase.text}</span>
    </label>
  );
}
