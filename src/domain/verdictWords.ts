// 답변 뒤(MOTION·VOTE)에는 임원 찬반 방향을 결과 화면에서 한 장씩 공개한다(T114). 그래서 FOLLOWUP
// 발언 문장에 방향 단어가 있으면 안 된다. 이 파일은 서버(응답 검사·재시도·대체)와 화면(봉인 단계
// 회의록 가림)과 평가 스크립트가 같은 기준을 쓰도록 의존성 없는 순수 함수만 둔다.

export const VERDICT_WORDS = ['찬성', '반대', '가결', '부결'] as const;

/** 문장 속 방향 단어를 등장 순서 없이 한 번씩 돌려준다. 없으면 빈 배열. */
export function findVerdictWords(text: string): string[] {
  return VERDICT_WORDS.filter((word) => text.includes(word));
}

/** 서버가 방향 단어가 든 FOLLOWUP 발언을 대체할 때 쓰는 역할별 한 문장(영문 없음). */
export const FOLLOWUP_MASKED_MESSAGES: Record<string, string> = {
  CEO: '이사님 답변은 들었습니다. 제 판단은 표결에서 밝히겠습니다.',
  CFO: '이사님 답변은 들었습니다. 비용에 대한 제 판단은 표결에서 밝히겠습니다.',
  CAIO: '이사님 답변은 들었습니다. 운영에 대한 제 판단은 표결에서 밝히겠습니다.',
  CISO: '이사님 답변은 들었습니다. 보안에 대한 제 판단은 표결에서 밝히겠습니다.',
};

export function maskedFollowUpMessage(roleId: string): string {
  return FOLLOWUP_MASKED_MESSAGES[roleId] ?? FOLLOWUP_MASKED_MESSAGES.CEO!;
}

/** 봉인 단계 회의록에서 방향 단어가 든 FOLLOWUP 행 대신 보여 주는 문구. */
export const SEALED_FOLLOWUP_TEXT = '(답변을 들었습니다 · 결과에서 공개)';
