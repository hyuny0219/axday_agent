// 답변 뒤(MOTION·VOTE)에는 임원 찬반 방향을 결과 화면에서 한 장씩 공개한다(T114). 그래서 FOLLOWUP
// 발언 문장에 방향 단어가 있으면 안 된다. 이 파일은 서버(응답 검사·재시도·대체)와 화면(봉인 단계
// 회의록 가림)과 평가 스크립트가 같은 기준을 쓰도록 의존성 없는 순수 함수만 둔다.

// 설계 원칙(T114, Codex 53~58차 반복 지적 정리): "명사형 방향 표현은 넓게 잡고, 유보형만 제외한다."
//  1) 방향을 밝히는 말(찬성·반대·가결·부결 등 단어, "○○ 쪽/편 + 서술격", "○○에 가깝다")은 어미를
//     하나씩 열거하는 허용 목록으로 잡지 않는다 — 열거하면 "쪽이라고 하겠습니다" 같은 변형이 계속 샌다.
//  2) 대신 서술격·"에 서/속"·"으로" 연결이면 선언으로 보고, 바로 뒤가 의문·조건·유보·열거형
//     (LEAVE_OPEN: 인지·이라면·일 수도·에서 말씀 …)이면 부정 전방탐색으로 제외한다.
//  3) 뒤에 명사가 이어지는 수식형("승인 쪽 조건", "찬성 편 임원")은 쪽/편 바로 뒤가 서술격이 아니므로 걸리지 않는다.
//  4) 어미 열거만으로는 의문형이 계속 샌다 — 서술 꼴 패턴에는 절 단위 보조 규칙을 쓰고(isInQuestionClause),
//     종결 판정은 어미 목록이 아니라 글자 종류로 한다: 절 경계는 문장 부호·쉼표뿐이고, 매칭이 끝나는 어절부터
//     처음 만나는 종결 어절이 의문 종결(ㅂ받침 + 니까(요)·ㄹ받침 + 까(요)·나요·가요·는지요; 연결·강조형 "-으니까·-라니까"는 질문이 아님)이거나
//     바로 뒤가 "?"이면 질문(제외),
//     활용 꼴 종결(어요·니다·죠 등, 명사 "필요"는 제외)로 끝나면 선언이다. 연결 어미는 경계가 아니다. "쪽이/편이 + 공백"은 주격 조사라
//     뒤 어절이 맞·옳·낫·타당·합리·좋·우세·유리·적절로 시작할 때만 선언으로 본다.
//     부호 묶음("…?"·"...?"·"… ?")은 하나로 보고 그 안에 "?"가 있으면 질문 부호로 본다.
//     단정형(-라니까(요)·-다니까(요)·-잖아요·-잖습니까)은 "?"가 붙어도 선언이라 "?" 검사보다 먼저 적용한다.
//     되묻는 -라니(요)·-라고요는 단정형이 아니다 — "?"가 붙으면 질문, 없으면 일반 종결 규칙을 따른다.
//  5) 임원이 참가자 발언을 인용하는 문장("승인 쪽이라고 하셨으니까 묻겠습니다")과 임원 자신의 선언은 구분하지 않는다
//     — 과잉 차단을 허용한다(걸리면 재시도·중립 대체).
//  6) 새 오탐·누락 지적이 오면 위 기준으로 판단하고, 문장을 tests/server/followUpVerdict.test.ts의
//     "걸려야 하는 문장"/"중립 문장" 목록에 먼저 추가한 뒤 패턴을 고친다. 찬성·반대 단어 자체를 쓴 문장은
//     (의문형이라도) 단어 패턴이 걸린다 — 의도된 엄격함.

/** 의문·조건·유보·열거형 접미(쪽/편 바로 뒤에 이 접미가 오면 방향 선언이 아니다). */
const LEAVE_OPEN =
  '입니까|이겠습니까|이에요\\?|이죠\\?|이겠어요\\?|이겠지요\\?|인지요|인지|인가|일지|일까|일는지|이라면|이면|다면|라면|이든|이거나|인 ?줄|인 것인지|인 것 같지는|이기보다|이라기보다|은지|운지|을지|을까|는지|지는 않|지 않|라고 보기|다고 보기|라 하기|다고 하기|이라 할 수는|일 수도|일 수 있|일지도|으로 볼지|으로 봐야 할지|로 볼지|로 봐야 할지|에서 말씀|에서 제안|에서 요청';

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
  { pattern: /(승인|이사님|참가자|그) ?(쪽|편|방향)(으로|에) (기울|돌아|가겠|가는|갑니다|서겠|서 있|마음이)/, why: '"○○ 쪽으로 기울었다·돌아섰다·가겠다" 꼴의 우회 방향 선언(찬성·반대 등은 위 단어 패턴이 잡는다)' },
  { pattern: /마음이 (기울|움직)/, why: '"마음이 기울다·움직이다"는 입장 이동을 말해 방향을 짐작하게 함' },
  { pattern: /힘을 싣/, why: '"힘을 싣다"는 지지 선언의 우회 표현' },
  { pattern: /손을 들/, why: '"손을 들다"는 표 행사 표현' },
  { pattern: /승인(으로|을)? ?(결정|정)했/, why: '"승인으로 정했다" 꼴의 결론 선언(찬성·반대·부결은 단어 패턴이 잡는다)' },
  {
    pattern: new RegExp(`(?:승인|찬성|반대|가결|부결|통과|반려|기각|이사님|참가자|그) ?(?:쪽|편)(?!${LEAVE_OPEN})(?:이(?! )|이 (?=맞|옳|낫|타당|합리|좋|우세|유리|적절)|입|일|인|임|에 가깝|에 서|에 섭|에 속|으로)`),
    why: '"○○ 쪽입니다·쪽이라고 하겠습니다·편으로 답하겠습니다·쪽임을 밝힙니다" 꼴의 명사형 입장 선언. 쪽·편 바로 뒤가 서술격(이·입·일·인·임; "쪽이 "+공백은 주격 조사라 뒤 어절이 맞·옳·낫·타당·합리·좋·우세·유리·적절로 시작할 때만)·"에 서/속"·"으로"이면 선언으로 보고, 의문·조건·유보형(LEAVE_OPEN)이나 뒤에 명사가 이어지는 수식형("쪽 조건")은 제외한다',
  },
  {
    pattern: new RegExp('(?:승인|찬성|반대|가결|부결)에 가깝(?!다면|은지|운지|지는|다고 보기|다고 하기|기는|지 않|습니까)|(?:승인|찬성|반대|가결|부결)에 가까운 (?:입장|쪽|편)'),
    why: '"○○에 가깝다"는 기울기를 밝히는 우회 선언. "가깝다면·가까운지·가깝지는 않" 같은 조건·의문·부정 유보형은 제외',
  },
  {
    pattern: new RegExp(`(?:저는|제 입장은|제 결론은|최종적으로)[^.!?]{0,15}(?:승인|찬성|반대|가결|부결)(?!${LEAVE_OPEN})(?:입|일|이다|이에|이죠|이네|이지|이고|이라|인|임)`),
    why: '"제 입장은 ○○입니다·○○이라고 하겠습니다" 꼴의 명사형 결론 선언. 같은 유보형 제외 집합을 쓰고, "승인이 필요"처럼 조건을 말하는 문장이 걸리지 않게 "이" 단독 연결은 뺀다',
  },
  { pattern: /결론은 ?(찬성|반대|승인|가결|부결)/, why: '"결론은 ○○" 꼴의 결론 선언' },
];

/** 임원 FOLLOWUP 발언(message)에서 방향을 밝히는 표현을 찾아, 걸린 부분 문자열을 패턴 순서대로
 * 돌려준다(패턴당 최대 1개). 없으면 빈 배열. 서버(응답 거절·재시도·대체), 화면(봉인 단계 회의록),
 * 평가 스크립트가 같은 기준을 쓴다. */
export function findVerdictWords(text: string): string[] {
  const found: string[] = [];
  for (const { pattern } of VERDICT_PATTERNS) {
    // 단어 하나뿐인 패턴(찬성·반대…)은 질문 안에 있어도 잡는다(의도된 엄격함). 서술 꼴 패턴만 질문 절을 제외한다.
    const isPlainWord = PLAIN_WORD_SOURCE.test(pattern.source);
    const scan = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(scan)) {
      if (!isPlainWord && isInQuestionClause(text, match.index ?? 0, (match.index ?? 0) + match[0].length)) continue;
      found.push(match[0]);
      break;
    }
  }
  return found;
}

const PLAIN_WORD_SOURCE = /^[가-힣|]+$/;

/** 한글 음절의 받침 번호(0=없음, 8=ㄹ, 17=ㅂ). 한글 음절이 아니면 -1. */
function finalConsonantIndex(char: string | undefined): number {
  if (!char) return -1;
  const code = char.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : -1;
}

/** 어절이 질문 종결인가. 글자 "까"만 보면 연결·강조형 "-니까"(했으니까·이니까·그러니까·라니까(요))가 걸리므로
 * 받침으로 가른다: 앞 음절에 ㅂ받침이 있는 "-ㅂ니까(요)"(합니까·입니까·습니까·봅니까), ㄹ받침 음절 + "까(요)"
 * (할까·될까·일까·있을까요), 그리고 나요·가요(ㄴ가요·는가요 포함)·는지요. "-데요"는 "?"가 바로 붙을 때만 질문이라
 * 호출부의 "?" 검사가 맡는다. */
function isQuestionWord(rawWord: string): boolean {
  if (/(?:나요|가요|는지요)$/.test(rawWord)) return true;
  const word = rawWord.endsWith('요') ? rawWord.slice(0, -1) : rawWord;
  if (word.endsWith('니까')) return finalConsonantIndex(word[word.length - 3]) === 17;
  if (word.endsWith('까')) return finalConsonantIndex(word[word.length - 2]) === 8;
  return false;
}

/** 강조·단정 어미 — "?"가 붙어도 질문이 아니라 선언을 되풀이하는 말이다("승인 쪽이라니까요?", "승인 쪽이잖아요?").
 * "-라니(요)·-라고요"는 일부러 뺀다: "?"가 붙으면 놀라서 되묻는 질문(echo)이다("승인 쪽이라니요?"). */
const EMPHATIC_WORD_END = /(?:라니까|다니까|잖아요|잖습니까)요?$/;

/** 평서 종결 활용 꼴(요·다·네·죠, 뒤에 '만'이 붙어도 됨). 글자 하나만 보면 "필요·중요·주요·수요·개요·소요·강요"
 * 같은 명사가 걸리므로 '요'는 활용 꼴(어요·아요·여요·해요·예요·에요·이요·게요·래요·데요·고요·네요·군요)일 때만,
 * '다'는 니다·는다·ㄴ다(받침 ㄴ + 다)·이다·었다·았다·겠다·했다·있다·없다·같다·않다일 때만 종결로 본다. */
const DECLARATIVE_CORE =
  /(?:[어아여해예에이게래데고네군]요|죠|(?:이|하|었|았|겠)네|니다|는다|[이었았겠했있없같않]다)$/;

function isDeclarativeWord(rawWord: string): boolean {
  const word = rawWord.endsWith('만') ? rawWord.slice(0, -1) : rawWord;
  if (word === '네') return true;
  if (DECLARATIVE_CORE.test(word)) return true;
  // "한다·된다·본다"처럼 받침 ㄴ + 다
  const beforeDa = word.endsWith('다') ? word.charCodeAt(word.length - 2) : NaN;
  if (beforeDa >= 0xac00 && beforeDa <= 0xd7a3) {
    return (beforeDa - 0xac00) % 28 === 4;
  }
  return false;
}

/** 질문 절 보조 규칙(어미 열거 LEAVE_OPEN만으로는 의문형이 계속 샌다) — 종결 판정은 글자 종류로 한다.
 *  절 경계는 문장 부호(. ! ? … 줄바꿈)와 쉼표(, 、)뿐이다. 매칭이 끝나는 어절부터 공백 단위로 읽으며
 *  처음 만나는 "종결 어절"로 판단한다: 의문 어절(까·까요·나요·가요·는지요)이거나 바로 뒤가 "?"이면 질문(제외),
 *  평서 종결 글자([다요죠네](만))이면 뒤에 무엇이 오든 선언(걸림). 종결 어절 없이 절이 "?"로 끝나면 질문,
 *  아니면 선언이다. 연결 어미(-고·-는데…)는 경계가 아니라 그냥 비종결 어절이다. */
function isInQuestionClause(text: string, matchStart: number, matchEnd: number): boolean {
  const boundary = /[.!?…,、\n]/g;
  boundary.lastIndex = matchStart;
  const end = boundary.exec(text);
  const segEnd = end ? end.index : text.length;
  // 문장 부호 묶음(…?·...?·"… ?")은 하나로 본다 — 묶음 안에 "?"가 있으면 질문 부호다.
  const marks = /[.…!?]+(?:\s+[.…!?]+)*/y;
  marks.lastIndex = segEnd;
  const questionMark = (marks.exec(text)?.[0] ?? '').includes('?');
  let position = Math.max(text.lastIndexOf(' ', matchEnd - 1) + 1, matchStart);
  while (position < segEnd) {
    while (position < segEnd && text[position] === ' ') position += 1;
    let wordEnd = position;
    while (wordEnd < segEnd && text[wordEnd] !== ' ') wordEnd += 1;
    const word = text.slice(position, wordEnd);
    if (word.length > 0) {
      if (EMPHATIC_WORD_END.test(word)) return false;
      if (isQuestionWord(word) || (wordEnd === segEnd && questionMark)) return true;
      if (isDeclarativeWord(word)) return false;
    }
    position = wordEnd;
  }
  return questionMark;
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

// ---------------------------------------------------------------------------------------------
// T115: 임원 발언 문장이 선언하는 방향(찬성/반대)을 뽑는다. 서버가 OPINIONS·REACTIONS 응답의 구조화된
// stance와 문장이 명백히 반대인지 가르는 데 쓴다. 참가자는 문장을 읽으므로 문장과 stance가 어긋나면
// 화면(표정·현황판·비서실장 추천)이 문장과 정반대로 보인다.
//
// 원칙: 교정은 명백한 경우만. 금지어 검사(findVerdictWords)와 달리 단어가 있다는 이유만으로 방향을 정하지
// 않고, 결과 명사 바로 뒤가 실제 선언 꼴일 때만 센다. 확신이 없으면 null(교정하지 않음)이다.
//  (a) 긍정 선언: 결과 명사 + 서술 결합("찬성합니다·찬성입니다·가결하겠·부결시키겠·찬성 쪽입니다·승인 쪽으로 가겠").
//      명사와 결합 사이의 공백은 있어도 없어도 같다.
//  (b) 부정 서술은 반대 방향: 뒤에 부정어(않·못·없·어렵·힘들·불가·곤란·아니·안 됩)가 오면 방향을 뒤집는다
//      ("가결은 어렵습니다·찬성하기 어렵습니다·승인이 안 됩니다"는 AGAINST, "반대하지 않겠습니다·반대는 어렵습니다"는 FOR).
//  (c) 단순 언급("가결 여부를 보겠습니다", "가결 기준은…", "승인 사유를 남기면")은 null이다.
//  조건·의문 문장은 건너뛰고, 서로 다른 방향이 함께 나오면 null이다.

export type DeclaredDirection = 'FOR' | 'AGAINST';

/** 문장 방향이 참가자 입장에 상대적인 말(같은 편·동의·지지). 참가자 입장을 모르면 쓰지 않는다. */
const RELATIVE_PATTERNS: readonly RegExp[] = [/같은 편(?:입|이에|이라|이죠|에 서|으로)/, /(?:동의|지지)(?:합니다|하겠|한다|해 드)/, /뜻을 같이/];

const RESULT_NOUNS: ReadonlyArray<{ word: string; direction: DeclaredDirection }> = [
  { word: '찬성', direction: 'FOR' },
  { word: '가결', direction: 'FOR' },
  { word: '통과', direction: 'FOR' },
  { word: '승인', direction: 'FOR' },
  { word: '반대', direction: 'AGAINST' },
  { word: '부결', direction: 'AGAINST' },
  { word: '반려', direction: 'AGAINST' },
  { word: '기각', direction: 'AGAINST' },
  { word: '거부', direction: 'AGAINST' },
];
const NOUN_SCAN = new RegExp(`(${RESULT_NOUNS.map((n) => n.word).join('|')})`, 'g');

// 꼬리(결과 명사 바로 뒤, 공백 하나 허용)는 "완결된 어절"일 때만 센다. 한 글자·접두 일치는 쓰지 않는다:
// "합의·합리"의 '합', "입장"의 '입', "불가피·불가결"의 '불가'는 선언이 아니다. 각 꼬리는 활용 어미까지 적고
// 끝의 \S*가 그 어절의 남은 글자(만·요 등)를 먹는다. 결과 명사 뒤에 다른 명사가 이어지면 어떤 꼬리와도
// 맞지 않아 null이다. 부정 서술에서 "찬성 입장은 아직 아닙니다"처럼 중간에 다른 말이 끼면 null로 둔다(교정 안 함).
// 부정·없다 꼬리는 종결 활용일 때만 센다. 기본형(-다)·평서형·존대형을 모두 받되 **어절 끝**(선택적 '만' 허용)이어야 한다.
// 인용·연결 어미(않다고·않다는·않다며·없다면·없는지)는 어절이 이어져 경계가 맞지 않으므로 종결이 아니다 — 인용은 교정하지 않는다
// ("교정은 명백한 경우만"). WORD_END가 그 경계다.
const WORD_END = '(?=만?(?:[\\s,)\\]"\']|$))';
const TERMINAL =
  '(?:(?:다|는다|습니다|습니까|어요|아요|네요|죠|고요|군요|겠다|겠습니다|겠습니까|겠어요|았다|었다|을 것입니다|을 것이다|을 겁니다|겁니다|것입니다)' + WORD_END + ')';
const NO_END = '없' + TERMINAL;
const NOT_END = '(?:않' + TERMINAL + '|못(?:합니다|합니까|해요)' + WORD_END + '|못하' + TERMINAL + ')';
const HARD_END =
  '(?:어렵' + TERMINAL + '|어려(?:워요|웠다)' + WORD_END + '|힘(?:듭니다|듭니까)' + WORD_END + '|힘들' + TERMINAL + '|곤란(?:합니다|해요)' + WORD_END + '|곤란하' + TERMINAL + ')';

// 모든 꼬리 대안은 완결 어절로 끝나야 하고(WORD_END) 바깥에서 어절 나머지를 삼키지 않는다 — 다어절 대안("해야 한다")도
// 인용·연결 어미("한다고")가 이어지면 맞지 않는다.
const NEGATED_TAIL = new RegExp(
  '^\\s?(?:' +
    // 불가피의 부정 활용: 찬성은 불가피하지 않습니다 / 반대가 불가피한 것은 아닙니다
    '(?:은|는|이|가)? ?불가피(?:하지 ' + NOT_END + '|한 것은 (?:아닙니다|아니다|아니에요)|하다고 보지 않습니다)' +
    '|' +
    // 명사 + 조사 + 부정 서술: 가결은 어렵습니다 / 승인이 안 됩니다 / 승인 불가입니다
    '(?:은|는|이|가)?\\s?(?:' + HARD_END + '|불가(?:능합니다|합니다|하다|해요|입니다|이다)|안 ?(?:됩니다|되겠습니다|된다|돼요)|' + NO_END + '|아(?:닙니다|니다|니에요))' +
    '|' +
    // 쪽/편/입장 + 아니다: 찬성 쪽이 아닙니다
    '(?:쪽|편|입장)(?:은|이|는)? ?(?:아닙니다|아니다|아니에요)' +
    '|' +
    // 동사 부정: 반대하지 않겠습니다 / 찬성하기 어렵습니다 / 승인할 수 없습니다
    '(?:하|시키|되|해 드리|해 주)?(?:지 ' + NOT_END + '|기(?:는|가)? ' + HARD_END + '|(?:할|ㄹ) 수 (?:는 )?' + NO_END + ')' +
    ')' + WORD_END,
);

// 이중 부정(조사 선택): 찬성하지 않을 수가/는/도 없습니다 · 반대하지 않을 리가 없습니다 · 찬성 안 할 수가 없습니다 ·
// 찬성하지 않으면 안 됩니다. 단일 부정 검사보다 먼저 본다.
const DOUBLE_NEGATED_TAIL = new RegExp(
  '^\\s?(?:(?:하|시키|되)?(?:지|치) ?(?:않|아니)(?:을|할) ?(?:(?:수|리)(?:가|는|도|야)?|수 ?밖에|밖에|도리(?:가|는)?|길(?:이|은)?|방법(?:이|은)?) ?' +
    NO_END +
    '|안 ?할 ?수(?:가|는|도)? ?' +
    NO_END +
    '|(?:하|시키|되)?지 ?않으면 ?안 ?(?:됩니다|된다|돼요)' + WORD_END + ')',
);
// 단일 긍정 "-할 수밖에 없습니다"(찬성할 수밖에 없습니다)도 그 방향의 선언이다.
const UNAVOIDABLE_TAIL = new RegExp('^\\s?(?:하|시키|되)?(?:ㄹ|할|될) ?수 ?밖에 ?' + NO_END);

const AFFIRMED_TAIL = new RegExp(
  '^\\s?(?:' +
    // 동사 선언: 찬성합니다 / 가결하겠습니다 / 부결시키겠습니다 / 부결해야 합니다
    '(?:합니다|합니까|하겠습니다|하겠어요|하겠다|하겠네요|한다|드립니다|됩니다|드리겠습니다|시키겠습니다|시키겠다|되겠습니다|되겠다' +
    '|하기로 (?:했습니다|했다|하였다|합니다|하겠습니다)|해야 (?:합니다|한다|하겠습니다)|시킬 (?:것입니다|겁니다|예정입니다)|시키기로 (?:했습니다|했다))' +
    '|' +
    // 서술격 선언: 찬성입니다 / 찬성이에요 / 찬성이라고 하겠습니다
    '(?:입니다|이에요|이죠|이다|이라고|이라서)' +
    '|' +
    // 쪽·편·입장 선언: 찬성 쪽입니다 / 승인 쪽으로 가겠습니다 / 반대 편에 서겠습니다
    '(?:쪽|편)(?:입니다|이에요|이라고?|이죠|임을|이다|으로 (?:가겠습니다|가겠어요|기울었습니다|하겠습니다|정하겠습니다|보겠습니다|서겠습니다)|에 (?:서겠습니다|서겠어요|섭니다|서 있습니다))' +
    '|' +
    '입장(?:입니다|이에요|이다|이라고?)' +
    '|' +
    // 불가피("찬성은 불가피합니다")는 그 방향이 피할 수 없다는 긍정 선언이다. 불가결·불가역은 해당 없음.
    '(?:은|는|이|가)? ?불가피(?:합니다|하다|해 보입니다|할 것입니다|하겠습니다)' +
    '|' +
    // 방향 조사: 승인으로 가겠습니다 / 가결로 보겠습니다
    '(?:으로|로) (?:가겠습니다|하겠습니다|정하겠습니다|보겠습니다)' +
    ')' + WORD_END,
);


/** 반대 방향 관용 선언과 표를 보태는 표현(부정어가 섞이면 건너뛴다). */
const AGAINST_IDIOMS: readonly RegExp[] = [/반대로 (?:남|서겠|가겠)/];
const FOR_IDIOMS: readonly RegExp[] = [/표를 (?:보태|드리)|힘을 보태/];
const IDIOM_NEGATION = /지 않|지 못|없|어렵|힘들|불가|아니/;

/** 조건·의문 문장은 선언으로 보지 않는다("한도를 정하면 찬성하겠습니다", "찬성할까요?"). 부정은 위에서 따로 처리한다. */
// 조건 어미 "-면"은 실제 조건절일 때만 센다(명사 목록만으로는 서면·대면 같은 명사를 다 못 거른다).
//  (0) 명사 끝 음절(전면·측면·표면·정면·평면·국면·직면·당면·화면·장면·단면·외면·후면·양면·반면)이면 명사다.
//  (a) 면 바로 앞 음절이 으·다·라·하·되·이·시·려·거·니이거나 ㄹ받침이면 조건 어미다(붙으면·그렇다면·검토되면·열면).
//  (b) 그 밖의 모음 어간(가면·보면·남기면·서면·대면·지면)은 뒤 어절이 명사·조사 결합(으로·의·을·를·에·회의·방식·의견·
//      심사·절차·관계·자료·보고·설계)이면 명사("서면 의견으로", "지면 관계상"), 아니면 조건이다.
const MYEON_NOUN_SYLLABLES = '전측표정평국직당화장단외후양반';
const MYEON_CONDITIONAL_SYLLABLES = '으다라하되이시려거니';
const MYEON_KNOWN_NOUNS = ['서면', '대면', '지면', '화면', '외면', '후면', '수면', '노면', '도면', '액면', '정면', '전면', '측면', '국면', '당면', '직면', '장면', '단면', '양면', '반면', '비대면', '다방면'];
const MYEON_SHORT_VERB_STEMS = '가오보주쓰두내자타사나차피치';
const MYEON_VERB_STEMS = '가오보주쓰두내자타사나차피치기리키우세해래배재채패매깨';
const MYEON_NOUN_FOLLOWER = /^(?:으로|의|을|를|에|에서|보고|회의|방식|의견|심사|절차|관계|자료|설계)/;

function hasConditionalMyeon(sentence: string): boolean {
  const words = sentence.split(/\s+/);
  for (let i = 0; i < words.length; i += 1) {
    const word = (words[i] ?? '').replace(/[,、]+$/, '');
    if (word.length < 2 || !word.endsWith('면')) continue;
    // (-1) 동사 활용과 형태가 같은 명사는 목록으로만 구분할 수 있어 의도적으로 목록을 둔다. 목록에 있으면 앞뒤 어절과
    // 무관하게 명사다("이 안건을 서면 결의로 승인합니다"). '내면'은 "돈을 내면"과 구분할 수 없어 목록에 넣지 않는다.
    if (MYEON_KNOWN_NOUNS.includes(word)) continue;
    const prev = word[word.length - 2] ?? '';
    const finalConsonant = finalConsonantIndex(prev);
    // (a) ㄹ이 아닌 자음 받침 + 면은 명사다: 용언은 자음 받침 뒤에 "으면"이 온다(다방면·전면·국면·정면).
    if (finalConsonant > 0 && finalConsonant !== 8) continue;
    if (MYEON_NOUN_SYLLABLES.includes(prev)) continue;
    // (b) ㄹ받침(들면·살면·열면)이거나 조건 어미 음절이면 조건이다.
    if (finalConsonant === 8 || MYEON_CONDITIONAL_SYLLABLES.includes(prev)) return true;
    // (c) 받침 없는 모음 음절 — 규칙 순서(앞 어절 단서는 현재 어절이 2음절 동사 어간일 때만 쓴다):
    //   0) 2음절 어절 앞이 을·를로 끝남 → 조건(목적어 뒤의 2음절 어절은 동사; 켜면·끄면처럼 목록에 없는 동사도 포함)
    //   1) 2음절 동사 어간(가·오·보·주·쓰·두·내·자·타·사·나·차·피·치) + 앞 어절이 을·를·에·로·서·게·히로 끝남 → 조건("자료를 보면")
    //   2) 3음절 이상 + 동사 어간 음절(남기면·느려지면) → 조건
    //   3) 뒤 어절이 명사·조사 결합(으로·의·회의·의견·관계 …) → 명사(비대면 회의에, 서면 의견으로, 지면 관계상). 앞 어절과 무관
    //   4) 그 밖 → 조건(기본값)
    // 0) 2음절 어절 앞이 목적격 조사(을·를)로 끝나면 동사 목록과 무관하게 조건("로그를 켜면", "기능을 끄면")
    if (word.length === 2 && /[을를]$/.test(words[i - 1] ?? '')) return true;
    if (word.length === 2 && MYEON_SHORT_VERB_STEMS.includes(prev) && /[을를에로서게히]$/.test(words[i - 1] ?? '')) return true;
    if (word.length >= 3 && MYEON_VERB_STEMS.includes(prev)) return true;
    if (MYEON_NOUN_FOLLOWER.test(words[i + 1] ?? '')) continue;
    return true;
  }
  return false;
}

const HEDGED_SENTENCE = /(?:다면|라면|경우|한다면|수도 (?:있|없)|을지|일지|할지|인지|일까|을까|할까|\?)/;

function sentencesOf(text: string): string[] {
  return text.split(/[.!?…\n]+/).map((part) => part.trim()).filter((part) => part.length > 0);
}

function flip(direction: DeclaredDirection): DeclaredDirection {
  return direction === 'FOR' ? 'AGAINST' : 'FOR';
}

/** 발언 문장에서 임원이 선언한 방향을 돌려준다. 찬성·반대가 함께 있거나, 조건·유보형이거나, 선언이 없으면 null.
 * participantStance를 주면 "같은 편·동의·지지"처럼 참가자에게 상대적인 표현도 방향으로 바꾼다. */
export function declaredDirection(
  text: string,
  participantStance?: 'FOR' | 'AGAINST' | null,
): DeclaredDirection | null {
  const found = new Set<DeclaredDirection>();
  for (const sentence of sentencesOf(text)) {
    // "?"는 문장 분리에서 지워지므로 원문에서 그 문장 뒤에 "?"가 오는지도 본다.
    const index = text.indexOf(sentence);
    const asked = /^[\s.…!?]*\?/.test(text.slice(index + sentence.length));
    // "-하지 않으면 안 됩니다"는 조건절이 아니라 이중 부정 관용구라 조건 판정에서 뺀다.
    const forHedge = sentence.replace(/않으면 ?안 ?됩/g, '않아야 합');
    if (asked || HEDGED_SENTENCE.test(forHedge) || hasConditionalMyeon(forHedge)) continue;
    for (const match of sentence.matchAll(NOUN_SCAN)) {
      const noun = RESULT_NOUNS.find((n) => n.word === match[0]);
      if (!noun) continue;
      const tail = sentence.slice((match.index ?? 0) + match[0].length);
      // 이중 부정("찬성하지 않을 수 없습니다")은 그 방향의 긍정이다 — 단일 부정 판정보다 먼저 본다.
      if (DOUBLE_NEGATED_TAIL.test(tail) || UNAVOIDABLE_TAIL.test(tail)) found.add(noun.direction);
      else if (NEGATED_TAIL.test(tail)) found.add(flip(noun.direction));
      else if (AFFIRMED_TAIL.test(tail)) found.add(noun.direction);
    }
    const negated = IDIOM_NEGATION.test(sentence);
    if (!negated) {
      if (AGAINST_IDIOMS.some((pattern) => pattern.test(sentence))) found.add('AGAINST');
      if (FOR_IDIOMS.some((pattern) => pattern.test(sentence))) found.add('FOR');
      if (participantStance && RELATIVE_PATTERNS.some((pattern) => pattern.test(sentence))) found.add(participantStance);
    }
  }
  if (found.size !== 1) return null;
  return [...found][0] ?? null;
}
