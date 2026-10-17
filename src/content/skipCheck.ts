// REACTIONS "넘어가기" 앞 확인 팝업 문구(T142). 결과를 미리 알려 주는 말은 쓰지 않는다 —
// tests/content/skipCheck.test.ts가 지켜 본다.

export const SKIP_CHECK_COPY = {
  title: '넘어가기 전에 확인해 보세요',
  items: {
    question: '추가 질문을 읽었나요?',
    options: '추천 답변을 살펴봤나요?',
    assistant: 'AI 비서실장에게 물어봤나요? (선택)',
  },
  stateMark: { done: '✓', todo: '○' },
  stateText: { done: '완료', todo: '아직' },
  answerLabel: '답하러 가기 ▶',
  skipLabel: '그래도 넘어가기',
  footerHint: ['바깥을 누르거나 닫기를 누르면 닫힙니다', '지금 화면에서 계속합니다'],
} as const;
