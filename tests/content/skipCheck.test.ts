import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SKIP_CHECK_COPY } from '../../src/content/skipCheck';
import { SkipCheckDialog } from '../../src/components/parts/SkipCheckDialog';

afterEach(() => {
  cleanup();
});

// 넘어간 뒤의 결과를 미리 알려 주는 말은 팝업 어디에도 쓰지 않는다(T142).
const RESULT_PREVIEW = /원래 입장|돌아갑|유지|입장이|표결|반영|편에/;

describe('SKIP_CHECK_COPY 결과 예고 금지(T142)', () => {
  it('문구 상수에 결과 예고 표현이 없다', () => {
    expect(JSON.stringify(SKIP_CHECK_COPY)).not.toMatch(RESULT_PREVIEW);
  });

  it('렌더된 팝업 글에도 결과 예고 표현이 없다(비활성 안내 포함)', () => {
    for (const answerDisabled of [false, true]) {
      const { unmount } = render(
        createElement(SkipCheckDialog, {
          question: '질문 예시입니다',
          answerVisited: false,
          assistantUsed: false,
          answerDisabled,
          onAnswer: () => {},
          onSkip: () => {},
          onClose: () => {},
        }),
      );
      expect(document.body.textContent ?? '').not.toMatch(RESULT_PREVIEW);
      unmount();
    }
  });
});
