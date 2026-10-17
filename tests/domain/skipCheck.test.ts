import { describe, expect, it } from 'vitest';
import { skipChecklist } from '../../src/domain/skipCheck';
import { SKIP_CHECK_COPY } from '../../src/content/skipCheck';

const states = (input: { answerVisited: boolean; assistantUsed: boolean }) =>
  Object.fromEntries(skipChecklist(input).map((item) => [item.id, item.state]));

describe('skipChecklist(T142)', () => {
  it('항목은 질문·추천 답변·비서실장 순서이고 비서실장만 선택이다', () => {
    const items = skipChecklist({ answerVisited: false, assistantUsed: false });
    expect(items.map((item) => item.id)).toEqual(['question', 'options', 'assistant']);
    expect(items.map((item) => item.optional)).toEqual([false, false, true]);
  });

  it('2/2에 들어간 적이 있어야 추천 답변이 완료다', () => {
    expect(states({ answerVisited: false, assistantUsed: false })).toEqual({ question: 'done', options: 'todo', assistant: 'todo' });
    expect(states({ answerVisited: true, assistantUsed: false }).options).toBe('done');
  });

  it('비서실장을 썼으면 완료다', () => {
    expect(states({ answerVisited: false, assistantUsed: true }).assistant).toBe('done');
  });
});

describe('SKIP_CHECK_COPY(T142)', () => {
  it('넘어간 뒤의 결과를 예고하는 문구가 없다', () => {
    const all = JSON.stringify(SKIP_CHECK_COPY);
    expect(all).not.toMatch(/돌아갑니다|유지됩니다|바뀌지|바뀝니다|확정됩니다|원래 입장/);
    expect(SKIP_CHECK_COPY.answerLabel).toBe('답하러 가기 ▶');
    expect(SKIP_CHECK_COPY.skipLabel).toBe('그래도 넘어가기');
  });
});
