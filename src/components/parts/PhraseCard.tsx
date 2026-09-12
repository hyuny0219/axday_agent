// 추천 문구 체크 카드. 라벨(label) 전체를 클릭 영역으로 삼아 내부 실제 checkbox
// input을 토글한다. 브라우저 네이티브 label↔input 연결을 쓰므로 카드 클릭과 체크박스
// 클릭이 각각 이벤트를 만들어 두 번 토글되는 문제가 생기지 않는다
// (DESIGN_SPEC.md 7장 "카드의 라벨을 포함한 전체 영역을 한 번 클릭해 선택/해제한다").
// 선택 상태를 "찬성"으로 표기하지 않는다(DESIGN_SPEC.md 4장 "의견 체크 카드").

import type { Phrase } from '../../content/types';

export interface PhraseCardProps {
  phrase: Phrase;
  selected: boolean;
  onToggle: () => void;
}

export function PhraseCard({ phrase, selected, onToggle }: PhraseCardProps) {
  return (
    <label
      className={`phrase-card${selected ? ' phrase-card--selected' : ''}`}
      data-testid={`phrase-card-${phrase.id}`}
    >
      <input
        type="checkbox"
        className="phrase-card__checkbox"
        checked={selected}
        onChange={onToggle}
      />
      <span className="phrase-card__text">{phrase.text}</span>
    </label>
  );
}
