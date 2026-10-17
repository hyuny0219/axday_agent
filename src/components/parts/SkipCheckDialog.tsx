// REACTIONS "넘어가기"를 눌렀을 때 먼저 뜨는 확인 팝업(T142). 답하기 전에 해 볼 일을
// 화면 상태로 자동 체크해 보여 줄 뿐, 넘어간 뒤의 일은 말하지 않는다. Esc·바깥 클릭·닫기는
// 팝업만 닫는다(DialogShell). role=dialog라 말풍선·다음 할 일 점선은 숨는다(useDialogOpen).

import type { SkipCheckInput } from '../../domain/skipCheck';
import { skipChecklist } from '../../domain/skipCheck';
import { SKIP_CHECK_COPY } from '../../content/skipCheck';
import { DialogShell } from './DialogShell';

export interface SkipCheckDialogProps extends SkipCheckInput {
  /** ① 아래에 보여 줄 추가 질문 원문. */
  question: string;
  /** 주 버튼을 못 누르는 때(live 반응 대기 중 1/2). */
  answerDisabled?: boolean;
  onAnswer: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function SkipCheckDialog({
  question,
  answerVisited,
  assistantUsed,
  answerDisabled = false,
  onAnswer,
  onSkip,
  onClose,
}: SkipCheckDialogProps) {
  const copy = SKIP_CHECK_COPY;
  return (
    <DialogShell
      testId="skip-check"
      titleId="skip-check-title"
      title={copy.title}
      onClose={onClose}
      closeTestId="skip-check-close"
      footerHint={copy.footerHint}
    >
      <ol className="skip-check__list" data-testid="skip-check-list">
        {skipChecklist({ answerVisited, assistantUsed }).map(({ id, state }) => (
          <li key={id} className="skip-check__item" data-state={state} data-testid={`skip-check-${id}`}>
            <span className="skip-check__mark" aria-hidden="true">
              {copy.stateMark[state]}
            </span>
            <span className="skip-check__text">
              {copy.items[id]}
              <span className="sr-only"> {copy.stateText[state]}</span>
              {id === 'question' && (
                <span className="skip-check__question" data-testid="skip-check-question-text">
                  {question}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="skip-check__actions">
        <button
          type="button"
          className="cta"
          onClick={onAnswer}
          disabled={answerDisabled}
          data-testid="skip-check-answer"
        >
          {copy.answerLabel}
        </button>
        <button type="button" className="cta cta--secondary" onClick={onSkip} data-testid="skip-check-skip">
          {copy.skipLabel}
        </button>
      </div>
    </DialogShell>
  );
}
