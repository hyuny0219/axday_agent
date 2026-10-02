// 직접 입력 textarea. CLAUDE_IMPLEMENTATION.md 4장: "IME 조합 중 Enter가 제출되지
// 않게 한다. 명시적인 '의견 전달' 버튼으로 전송한다." 여기서는 compositionstart/
// compositionend로 조합 상태를 추적해 조합 중 Enter keydown의 기본 동작(개행 삽입 등)을
// 막아 조합 확정 keydown이 그대로 제출 신호로 새지 않게 한다. 이 컴포넌트 자체는 제출
// 로직을 갖지 않는다(전달 버튼은 DiscussScreen이 소유).
// T73(S3_Discuss 시안 그대로): 머리줄 "MY STATEMENT · 내 발언" + 글자 수를 textarea
// 위로 올리고(시안 HUD 입력 상자 머리줄), 글자 수 칩은 더는 textarea 아래에 따로 두지
// 않는다. textarea는 시안대로 resize를 막는다(HUD 입력 상자 높이가 고정이다).
// T74(S4_Reactions 시안 그대로): REACTIONS의 "MY REPLY · 내 답변" HUD 입력 상자도 같은
// 모양이라 ReactionsScreen이 이 컴포넌트를 그대로 재사용한다 — 머리줄 라벨·aria-label·
// placeholder·testid를 prop으로 받게 넓혔다. 기본값은 모두 DISCUSS 값 그대로라
// DiscussScreen 호출부는 바꾸지 않는다.

import { useState } from 'react';
import { DRAFT_MAX_LENGTH } from '../../domain/draft';

export interface DraftEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** HUD 머리줄 라벨(시안 "MY STATEMENT · 내 발언"/"MY REPLY · 내 답변"). */
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  textareaTestId?: string;
  countTestId?: string;
  errorTestId?: string;
}

export function DraftEditor({
  value,
  onChange,
  label = 'MY STATEMENT · 내 발언',
  ariaLabel = '내 발언',
  placeholder = '이사님의 의견을 직접 입력하거나 선택한 문구를 수정해 주세요.',
  textareaTestId = 'draft-editor-textarea',
  countTestId = 'draft-editor-count',
  errorTestId = 'draft-editor-error',
}: DraftEditorProps) {
  const [isComposing, setIsComposing] = useState(false);
  const overLimit = value.length > DRAFT_MAX_LENGTH;

  return (
    <div className="draft-editor">
      <div className="draft-editor__head">
        <span className="draft-editor__label">{label}</span>
        <span
          className={`draft-editor__count${overLimit ? ' draft-editor__count--over' : ''}`}
          data-testid={countTestId}
        >
          {value.length} / {DRAFT_MAX_LENGTH}자
        </span>
      </div>
      <textarea
        className="draft-editor__textarea"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={3}
        data-testid={textareaTestId}
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(event) => {
          // 조합 중(한글 IME) Enter는 무시한다. isComposing 상태와 네이티브 플래그를
          // 함께 확인해 브라우저별 이벤트 순서 차이에 대비한다.
          if (event.key === 'Enter' && (isComposing || event.nativeEvent.isComposing)) {
            event.preventDefault();
          }
        }}
      />
      {overLimit && (
        <p className="draft-editor__error" role="alert" data-testid={errorTestId}>
          300자를 넘었습니다. 표현을 줄여 주세요.
        </p>
      )}
    </div>
  );
}
