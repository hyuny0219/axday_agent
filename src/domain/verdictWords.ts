// 답변 뒤(MOTION·VOTE)에는 임원 찬반 방향을 결과 화면에서 한 장씩 공개한다(T114). 그래서 FOLLOWUP
// 발언 문장에 방향 단어가 있으면 안 된다. 이 파일은 서버(응답 검사·재시도·대체)와 화면(봉인 단계
// 회의록 가림)과 평가 스크립트가 같은 기준을 쓰도록 의존성 없는 순수 함수만 둔다.

/** 임원 FOLLOWUP 발언에서 최종 방향을 밝히는 표현을 가리는 패턴(T114, Codex 54차). 참가자 발언에는
 * 적용하지 않는다 — 참가자가 자기 입장을 말하는 것은 막을 이유가 없다. 지나치게 넓히면 평범한
 * 문장(예: "자동 승인 사유를 남기는 점은 좋습니다")이 걸려 정상 발언이 중립 문장으로 바뀌므로, 단어
 * 하나가 아니라 "방향을 선언하는 꼴"(서술어 붙은 형태)만 잡는다. 거짓 양성은 단위 테스트가 지킨다. */
export const VERDICT_PATTERNS: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /찬성/, why: '결과 화면에서 공개할 찬반 그 자체' },
  { pattern: /반대/, why: '결과 화면에서 공개할 찬반 그 자체(반대편 포함)' },
  { pattern: /가결/, why: '결과 화면에서 공개할 가부 그 자체' },
  { pattern: /부결/, why: '결과 화면에서 공개할 가부 그 자체' },
  { pattern: /반려|기각/, why: '안건을 돌려보내는 말은 부결의 동의어' },
  { pattern: /통과(시키|되|합니다|하겠|할 것)/, why: '안건의 통과 여부 선언' },
  { pattern: /승인(합니다|하겠|해 드리|하기로|할 수 없|하지 않)/, why: '안건 승인 선언(명사 "자동 승인"은 안건 용어라 제외)' },
  { pattern: /지지(합|하겠|한다|하는|해)/, why: '지지 선언은 찬성의 동의어' },
  { pattern: /동의(합니다|하겠|한다|하기로|해 드)/, why: '안건에 대한 동의 선언은 찬성의 동의어' },
  { pattern: /(힘|표|손)(을|를)? ?(보태|보탭|들어|듭|들겠)/, why: '"힘·표를 보탠다", "손을 든다"는 표 행사 표현' },
  { pattern: /표(를|도) ?(주|던지|드리|행사)/, why: '"표를 주다·던지다"는 표 행사 표현("표결"은 걸리지 않는다)' },
  { pattern: /한 표(를)? ?(던|행사|보태)/, why: '"한 표를 던지다"' },
  { pattern: /같은 편|뜻을 같이|한 편(이|에)/, why: '참가자와의 편 가르기로 방향을 알림' },
  { pattern: /밀어(주|드)|밀겠|막겠|막아 (보|야)/, why: '안건을 밀거나 막겠다는 방향 선언' },
  { pattern: /거부(합|하겠|한)/, why: '거부 선언은 반대의 동의어' },
  { pattern: /(긍정|부정)적으로 (보|판단|평가|생각)/, why: '안건을 긍정·부정으로 본다는 방향 선언' },
  { pattern: /저는[^.!?]{0,20}쪽/, why: '"저는 …쪽입니다" 류 입장 선언' },
  { pattern: /쪽(으로|에) (서|기울|가겠|표)/, why: '"○○쪽에 서다·기울다" 류 입장 선언' },
];

/** 임원 FOLLOWUP 발언(message)에서 방향을 밝히는 표현을 찾아, 걸린 부분 문자열을 패턴 순서대로
 * 돌려준다(패턴당 최대 1개). 없으면 빈 배열. 서버(응답 거절·재시도·대체), 화면(봉인 단계 회의록),
 * 평가 스크립트가 같은 기준을 쓴다. */
export function findVerdictWords(text: string): string[] {
  const found: string[] = [];
  for (const { pattern } of VERDICT_PATTERNS) {
    const match = pattern.exec(text);
    if (match) found.push(match[0]);
  }
  return found;
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
