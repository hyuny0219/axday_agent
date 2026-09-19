// 직접 입력 textarea. CLAUDE_IMPLEMENTATION.md 4장: "IME 조합 중 Enter가 제출되지
// 않게 한다. 명시적인 '의견 전달' 버튼으로 전송한다." 여기서는 compositionstart/
// compositionend로 조합 상태를 추적해 조합 중 Enter keydown의 기본 동작(개행 삽입 등)을
// 막아 조합 확정 keydown이 그대로 제출 신호로 새지 않게 한다. 이 컴포넌트 자체는 제출
// 로직을 갖지 않는다(전달 버튼은 DiscussScreen이 소유).

import { useState } from 'react';
import { DRAFT_MAX_LENGTH } from '../../domain/draft';

export interface DraftEditorProps {
  value: string;
  onChange: (text: string) => void;
}

export function DraftEditor({ value, onChange }: DraftEditorProps) {
  const [isComposing, setIsComposing] = useState(false);
  const overLimit = value.length > DRAFT_MAX_LENGTH;

  return (
    <div className="draft-editor">
      <textarea
        className="draft-editor__textarea"
        value={value}
        placeholder="이사님의 의견을 직접 입력하거나 선택한 문구를 수정해 주세요."
        rows={3}
        data-testid="draft-editor-textarea"
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
      <div className="draft-editor__meta">
        <span
          className={`draft-editor__count${overLimit ? ' draft-editor__count--over' : ''}`}
          data-testid="draft-editor-count"
        >
          {value.length} / {DRAFT_MAX_LENGTH}자
        </span>
      </div>
      {overLimit && (
        <p className="draft-editor__error" role="alert" data-testid="draft-editor-error">
          300자를 넘었습니다. 표현을 줄여 주세요.
        </p>
      )}
    </div>
  );
}
