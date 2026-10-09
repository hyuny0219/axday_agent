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
const NEGATED_TAIL = new RegExp(
  '^\\s?(?:' +
    // 명사 + 조사 + 부정 서술: 가결은 어렵습니다 / 승인이 안 됩니다 / 승인 불가입니다
    '(?:은|는|이|가)?\\s?(?:어렵(?:습|다|네|죠|겠|어|지)|힘(?:듭|들(?:겠|다|어))|불가(?:능|합|하|해|입|이다|라)|곤란(?:합|하|해)|안 ?(?:됩|되겠|된다|돼)|없(?:습|다|어|네|죠|겠)|아(?:닙|니다|니에))' +
    '|' +
    // 쪽/편/입장 + 아니다: 찬성 쪽이 아닙니다
    '(?:쪽|편|입장)(?:은|이|는)? ?(?:아닙|아니다|아니에)' +
    '|' +
    // 동사 부정: 반대하지 않겠습니다 / 찬성하기 어렵습니다 / 승인할 수 없습니다
    '(?:하|시키|되|해 드리|해 주)?(?:지 (?:않|못)|기 (?:어렵|힘들|곤란)|기는 (?:어렵|힘들)|기가 (?:어렵|힘들)|(?:할|ㄹ) 수 (?:는 )?없)' +
    ')\\S*',
);

const AFFIRMED_TAIL = new RegExp(
  '^\\s?(?:' +
    // 동사 선언: 찬성합니다 / 가결하겠습니다 / 부결시키겠습니다 / 부결해야 합니다
    '(?:합니다|합니까|하겠(?:습|어|다|네)|한다|하기로 (?:했|하였|합|하겠)|해야 (?:합|한다|하겠)|드리겠|드립니다|시키겠|시킬 (?:것|겁|예정)|시키기로|되겠(?:습|다)|됩니다)' +
    '|' +
    // 서술격 선언: 찬성입니다 / 찬성이에요 / 찬성이라고 하겠습니다
    '(?:입니다|이에요|이라(?:고|서)|이죠|이다)' +
    '|' +
    // 쪽·편·입장 선언: 찬성 쪽입니다 / 승인 쪽으로 가겠습니다 / 반대 편에 서겠습니다
    '(?:쪽|편)(?:입니다|이에요|이라|이죠|임을|이다|으로 (?:가겠|기울|하겠|정하겠|보겠|서겠)|에 (?:서|표))' +
    '|' +
    '입장(?:입니다|이에요|이다|이라)' +
    '|' +
    // 불가피("찬성은 불가피합니다")는 그 방향이 피할 수 없다는 긍정 선언이다. 불가결·불가역은 해당 없음.
    '(?:은|는|이|가)? ?불가피' +
    '|' +
    // 방향 조사: 승인으로 가겠습니다 / 가결로 보겠습니다
    '(?:으로|로) (?:가겠|하겠|정하겠|보겠)' +
    ')\\S*',
);

/** 반대 방향 관용 선언과 표를 보태는 표현(부정어가 섞이면 건너뛴다). */
const AGAINST_IDIOMS: readonly RegExp[] = [/반대로 (?:남|서겠|가겠)/];
const FOR_IDIOMS: readonly RegExp[] = [/표를 (?:보태|드리)|힘을 보태/];
const IDIOM_NEGATION = /지 않|지 못|없|어렵|힘들|불가|아니/;

/** 조건·의문 문장은 선언으로 보지 않는다("한도를 정하면 찬성하겠습니다", "찬성할까요?"). 부정은 위에서 따로 처리한다. */
const HEDGED_SENTENCE = /(?:[가-힣]면(?=[ ,]|$)|다면|라면|경우|한다면|수도|을지|일지|할지|인지|일까|을까|할까|\?)/;

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
    const asked = text.slice(index + sentence.length).trimStart().startsWith('?');
    if (asked || HEDGED_SENTENCE.test(sentence)) continue;
    for (const match of sentence.matchAll(NOUN_SCAN)) {
      const noun = RESULT_NOUNS.find((n) => n.word === match[0]);
      if (!noun) continue;
      const tail = sentence.slice((match.index ?? 0) + match[0].length);
      if (NEGATED_TAIL.test(tail)) found.add(flip(noun.direction));
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
