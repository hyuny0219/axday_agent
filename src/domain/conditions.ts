// 조건 제안·충돌·확정 순수 함수. CLAUDE_IMPLEMENTATION.md 4장: 자동 추출은 확정이
// 아닌 제안이며, 부정문·상충 문구를 단순 키워드로 자동 확정하지 않는다.
// 조건 키워드는 시나리오 데이터(Condition.keywords)에 명시된 것만 쓰고,
// 라벨·문구 텍스트에서 토큰을 파생하지 않는다.

import type { ConflictPair, Scenario } from '../content/types';

// 키워드 뒤쪽, 같은 절 안(문장 부호·쉼표 전, 최대 NEGATION_WINDOW자)에 부정 표지가 나오면
// 그 언급은 제안하지 않는다(4장 명시 예 "없이·생략·말고"). 후속 직접 답변 "작성자를
// 확인하지 않겠습니다."가 TRACE 키워드 '작성자를 확인'에 걸려 참가자가 거부한 추적
// 조건이 자동 승인되던 문제(PR #10 Codex 12차 검토 P1) 뒤로 '-지 않-'·'없-'·'안 -'·
// '못 하-'·'반대'를, 17차 뒤로 배제 표현('빼-'·'제외'·'아니'·'금지'·'-지 말-')을, 18차 뒤로 붙여 쓴
// '안하-'·'안함'·'안되-'를, 20·21차 뒤로 '-지 마-'·'-지 맙-' 활용 전체(띄어쓰기 유무 무관)를 본다. 부정어가 다른 조건을 향하는 겹문장에서는 앞의 긍정 언급까지
// 빠질 수 있지만, 제안은 확정이 아니고 추천 문구로 다시 넣을 수 있으므로 놓치는 쪽을
// 택한다 — 거부한 조건을 몰래 넣는 것보다 낫다. 키워드 자체에 부정어가 포함된 경우(예:
// ANON_FULL의 '추적할 수 없')는 그 부정어가 키워드 범위 안에 있어 창에 들어오지 않으므로
// 자기 부정으로 처리되지 않는다.
// '빼-'(빼고·빼면)·'뺀'·'제외'·'아니'·'금지'·'-지 말-'은 조건을 명시적으로 배제하는 표현 — "효과 측정은
// 빼고 바로 확대합시다."가 MEASURE로 자동 승인됐다(PR #10 Codex 17차 검토 P1).
const NEGATION_MARKERS = [
  '없',
  '생략',
  '말고',
  '않',
  '못하',
  '못 하',
  '반대',
  '빼',
  '뺀',
  '제외',
  '아니',
  '금지',
];
// '-지 마-'(말고·말아·마세요·마십시오)와 축약 청유형 '-지 맙-'(맙시다). 공백은 선택 — "하지맙시다"·
// "하지마세요"처럼 붙여 쓴 형도 흔하다(PR #10 Codex 20·21차 검토 P1).
const JI_MA_NEGATION = /지\s?[마말맙]/;
// '안 -'과 '안' + 하다·되다 활용(안하-·안할·안해·안했·안한·안함·안합, 안되-·안된·안될·안됨·안돼·안됐)은
// 어절 시작(앞이 한글 음절이 아닐 때)에서만 부정으로 본다 — "검수 안하고"·"검수안하고"·"안할게요"는
// 부정, "불안하면"의 '안하'는 아니다. 붙여 쓴 '안하고'(18차)와 활용형 '안할·안해·안했'(22차)이
// 걸리지 않아 SCREEN이 자동 승인됐다(PR #10 Codex 검토 P1). 초성 ㅎ 음절은 하(U+D558)~힣,
// 초성 ㄷ+ㅚ/ㅙ 음절은 되~됳·돼~됗 범위다. 앞 글자 조건의 변천: "어절 시작"(18차, 붙여 쓴 조사에
// 막힘) → 조사 일부 허용(23차, '조차·마저·부터'가 빠짐) → 비부정 낱말 앞 글자 제외(24차, "제안합니다"의
// '안합'이 부정으로 잡혀 요청한 조건이 사라짐 — 25차 P1). 최종: **'안' 앞이 어절 경계(문자열 시작·
// 한글 아님)이거나 조사(한 음절·두 음절 모두 열거)일 때만** 부정이다. 조사 목록: 은·는·이·가·을·를·
// 도·만·과·와·에·로·서·나·야·든·랑·께·뿐 + 조차·마저·부터·까지·밖에·처럼·보다·이나·든지. '제안·고안·
// 감안·대안·방안·불안·미안·보안·편안'처럼 앞 글자가 조사가 아닌 합성어의 '안하-'는 부정이 아니다.
// '안내·안전·안정·안심'은 '안' 뒤 음절이 ㅎ·되 계열이 아니라 애초에 걸리지 않는다. 남는 위험은
// '도안·이안'처럼 조사와 같은 글자로 끝나는 명사뿐이며 이 안건의 어휘에는 없다.
const AN_NEGATION =
  /(?<=^|[^가-힣]|[은는이가을를도만과와에로서나야든랑께뿐]|조차|마저|부터|까지|밖에|처럼|보다|이나|든지)안(?:\s|[하-힣]|[되-됳돼-됗])/;

// '뿐 아니라'류는 배제가 아니라 긍정 병렬이다 — "효과 측정뿐 아니라 확대도 합시다."가 '아니'
// 표지에 부분 문자열로 걸려 참가자가 요청한 MEASURE가 사라졌다(PR #10 Codex 30차 검토 P1). '뿐'과
// '아니라/아니고' 사이에는 조사가 0~2음절 끼어 든다(만·이·은·는·도와 그 조합: 뿐만이·뿐만은·뿐만도·
// 뿐이·뿐도…). 조사를 하나씩 열거하다 31차(이)·32차(은)·33차(도)에서 매번 빠뜨렸으므로 조사 글자
// 집합 [만이은는도]를 0~2개 허용하는 꼴로 정리한다 — 특정 조사 종류에 기대지 않는다. 띄어쓰기
// 무관. 표지를 보기 전에 창에서 지운다. '뿐' 없는 "검수가 아니라 측정을 합시다"의 대조 부정은
// 그대로 부정이다.
const POSITIVE_PARALLEL = /뿐[만이은는도]{0,2}\s?아니[라고]/g;

// 창(window)은 isNegatedAfter가 공백 묶음을 한 칸으로 접은 뒤 잘라 넘긴다 — 여기서는 긍정
// 병렬만 지우고 표지를 본다.
function hasNegationMarker(window: string): boolean {
  const scanned = window.replace(POSITIVE_PARALLEL, ' ');
  return (
    NEGATION_MARKERS.some((marker) => scanned.includes(marker)) ||
    AN_NEGATION.test(scanned) ||
    JI_MA_NEGATION.test(scanned)
  );
}
const NEGATION_WINDOW = 24;
const CLAUSE_END = /[.!?,\n]/;

// PR #13 Codex 5차 검토 P1: 4차에서 약속형 어간으로 좁힌 키워드도 정보성 질문의 부분
// 문자열이다 — "금액 한도를 정하는 기준이 무엇입니까?"가 '금액 한도를 정'에 걸리고,
// 아래 부정 검사는 뒤쪽의 '않'만 보고 의문절인지는 보지 않는다. REACTIONS 직접 입력
// 경로가 추출된 조건을 자동 수락하므로(ReactionsScreen) 질문만 했는데 조건이 최종
// 안건에 들어갈 수 있다. 의문·정보 요청 문장 속 키워드 언급은 "그 한 번의 언급만
// 무시"(continue)한다 — 부정(조건 전체 거부, return false)과 다르다. 의문 판정을
// 부정 판정보다 먼저 해야 한다: "금액 한도를 정하지 않는 이유가 무엇입니까? 금액
// 한도를 정합시다."에서 첫 문장은 '않'이 있지만 의문문이라 무시하고, 둘째 문장의
// 긍정 청유만으로 LIMIT을 제안한다 — 부정을 먼저 보면 의문문 안의 '않'이 조건
// 전체를 거부해 버린다.
//
// 범위는 절(쉼표)이 아니라 문장이다. 의문 종결은 문장 끝에 오므로 쉼표를 넘어서
// 봐야 한다. 강한 문장 경계는 ". ! ? ？ \n"이고, 문장 부호 없이 이어 쓴 경우를 위해
// 평서·청유 격식 종결(-니다·-시다·-십시오·-세요) 바로 뒤 공백도 약한 경계로 둔다 —
// 의문 종결(-니까 등)은 이 목록에 없어 잘려 나가지 않는다.
const STRONG_SENTENCE_BOUNDARY = /[.!?？\n]/g;
const WEAK_SENTENCE_BOUNDARY = /(니다|시다|십시오|세요)(?=\s)/g;

function findSentenceBoundaries(text: string): number[] {
  const boundaries = new Set<number>();
  let match: RegExpExecArray | null;
  STRONG_SENTENCE_BOUNDARY.lastIndex = 0;
  while ((match = STRONG_SENTENCE_BOUNDARY.exec(text))) {
    boundaries.add(match.index + 1);
  }
  WEAK_SENTENCE_BOUNDARY.lastIndex = 0;
  while ((match = WEAK_SENTENCE_BOUNDARY.exec(text))) {
    boundaries.add(match.index + match[0].length);
  }
  return [...boundaries].sort((a, b) => a - b);
}

/** 주어진 위치(키워드 시작 인덱스)를 포함하는 문장의 [start, end) 범위를 찾는다. */
function sentenceSpanAt(text: string, index: number): { start: number; end: number } {
  let start = 0;
  let end = text.length;
  for (const boundary of findSentenceBoundaries(text)) {
    if (boundary <= index) {
      start = boundary;
    } else {
      end = boundary;
      break;
    }
  }
  return { start, end };
}

// 받침 판정: 음절 코드에서 (code - 0xAC00) % 28이 종성 인덱스다. ㅂ=17, ㄹ=8.
const JONG_B = 17;
const JONG_L = 8;

function hasJongseong(char: string | undefined, jong: number): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === jong;
}

function stripTrailingWhitespaceAndQuotes(s: string): string {
  return s.replace(/[\s"'""''「」『』]+$/u, '');
}

// 물음표 없이 의문 종결로 끝나는 꼴(문장 맨 끝 기준). '습니까'는 '습'이 이미 ㅂ받침
// 음절이라 일반 규칙(ㅂ받침+니까)에 포함된다. '하니까'(이유 연결)의 '하'는 받침이
// 없어 제외된다.
function hasInterrogativeEnding(core: string): boolean {
  if (core.endsWith('니까') && hasJongseong(core.at(-3), JONG_B)) {
    return true;
  }
  if (core.endsWith('까요') && hasJongseong(core.at(-3), JONG_L)) {
    return true;
  }
  if (core.endsWith('까') && !core.endsWith('까요') && hasJongseong(core.at(-2), JONG_L)) {
    return true;
  }
  if (/(?:인가|는가|은가|던가|건가|한가)(?:요)?$/.test(core)) return true;
  if (core.endsWith('나요')) return true;
  if (core.endsWith('는지요') || core.endsWith('인지요')) return true;
  if (core.endsWith('냐')) return true;
  return false;
}

// 키워드 뒤쪽(같은 문장 안)의 간접 의문 표지. 뒤가 공백·조사·쉼표·문장 끝이어야
// 한다 — '한지'·'던지'는 넣지 않고, '정할지라도'는 뒤가 '라'라서 제외된다.
// '-(으)ㄹ지'는 '할지·될지·을지'를 열거하는 대신 ㄹ받침 음절 + '지'로 본다 — '멈출지·
// 따를지·둘지'처럼 어간에 따라 음절이 달라지기 때문이다(builder가 테스트 작성 중
// 발견). 단 '일지'(명사, "기록한 일지를 남깁시다")는 ㄹ받침이어도 제외해 LOG와 겹치지
// 않게 한다.
const INDIRECT_QUESTION_MARKER = /(는지|인지|은지)(?=[\s,도는를가만요]|$)/;
const JI_AFTER_SYLLABLE = /([가-힣])지(?=[\s,도는를가만요]|$)/g;

function hasIndirectQuestionMarker(afterKeyword: string): boolean {
  if (INDIRECT_QUESTION_MARKER.test(afterKeyword)) return true;
  for (const match of afterKeyword.matchAll(JI_AFTER_SYLLABLE)) {
    if (match[1] !== '일' && hasJongseong(match[1], JONG_L)) return true;
  }
  return false;
}

// 키워드 뒤쪽의 정보 요청 서술어. 뒤쪽만 보는 이유: "설명드리자면 금액 한도를
// 정해야 합니다."처럼 키워드 앞의 '설명'은 제안이지 질문이 아니다.
const INFO_REQUEST_VERB = /알려|가르쳐|설명|궁금|알고 싶|묻고 싶|여쭙|여쭤|질문/;

function hasInfoRequestVerb(afterKeyword: string): boolean {
  return INFO_REQUEST_VERB.test(afterKeyword);
}

// 의문사. 부정칭(언제나·누구나·무엇이든·어디서든 등)과 '왜냐'·'몇몇'은 의문사로 보지
// 않는다 — EXP_ONLY 키워드 '언제나 경험 판단'의 '언제'가 의문사로 잡히면 안 된다.
const INTERROGATIVE_WORDS = [
  '무엇',
  '뭐',
  '뭔',
  '뭘',
  '무슨',
  '어떤',
  '어떻게',
  '어떠',
  '어디',
  '언제',
  '누가',
  '누구',
  '왜',
  '얼마',
  '몇',
  '어느',
];
const INDEFINITE_SUFFIX = /^(나|든|이나|이든|서나|서든)/;
const DETERMINER_WORDS = ['어떤', '어느', '무슨'];
const INDEFINITE_NOUN_PHRASE = /^\s[가-힣]+(?:든|라도|도)(?=\s|$)/;

function hasInterrogativeWord(sentence: string): boolean {
  for (const word of INTERROGATIVE_WORDS) {
    let from = 0;
    for (;;) {
      const index = sentence.indexOf(word, from);
      if (index === -1) break;
      const after = sentence.slice(index + word.length);
      // '얼마나'는 '언제나·누구나'와 달리 부정칭이 아니라 의문사("얼마나 돼요")다 —
      // '얼마'는 '얼마든(지)'만 부정칭으로 본다.
      // 관형사 '어떤·어느·무슨'은 다음 명사에 '-든/-라도/-도'가 붙으면 부정칭이다 —
      // "어떤 기준이든 금액 한도를 정해요"·"어떤 경우에도 …"는 질문이 아니다.
      const isIndefinite =
        word === '얼마'
          ? after.startsWith('든')
          : INDEFINITE_SUFFIX.test(after) ||
            (DETERMINER_WORDS.includes(word) && INDEFINITE_NOUN_PHRASE.test(after));
      const isWaenya = word === '왜' && after.startsWith('냐');
      const isMyeotMyeot = word === '몇' && after.startsWith('몇');
      if (!isIndefinite && !isWaenya && !isMyeotMyeot) {
        return true;
      }
      // '몇몇'은 둘째 '몇'도 단어 시작으로 다시 검사되지 않도록 함께 건너뛴다.
      from = index + word.length + (isMyeotMyeot ? 1 : 0);
    }
  }
  return false;
}

// 해요체·반말 종결. '-지'·'-나'는 간접 의문 표지(는지·할지 등)와 다른 자리다 —
// 여기서는 문장 "끝" 전체가 이 어미로 끝나는지만 본다. 해요체는 '-요'로 끝나는 꼴
// 전체를 받는다 — '예요·에요·데요'만 열거했더니 가장 흔한 '-해요/-어요/-아요'가 빠져
// "승인 사유를 기록하는 방식은 어떻게 정해요"가 LOG로 잡혔다(PR #13 Codex 6차 검토
// P1). 단 '-ㄹ게요/-ㄹ께요'(약속)와 '-세요'(요청)는 의문사가 있어도 질문이 아니다 —
// "누가 뭐라 해도 금액 한도를 정할게요"는 약속이다.
const CASUAL_ENDINGS = ['죠', '나', '지'];
const NON_QUESTION_YO_ENDINGS = ['게요', '께요', '세요'];

function hasCasualOrPoliteEnding(core: string): boolean {
  if (core.endsWith('요')) {
    return !NON_QUESTION_YO_ENDINGS.some((ending) => core.endsWith(ending));
  }
  return CASUAL_ENDINGS.some((ending) => core.endsWith(ending));
}

// 간접 의문 표지·정보 요청 서술어는 **키워드가 든 절** 안에서만 본다. 문장 끝까지
// 보면 "금액 한도를 정하고 질문은 나중에 받겠습니다."·"…정해서 설명자료를 준비합시다."
// 처럼 연결어미로 이어진 뒤 절의 무관한 '질문'·'설명'이 앞 절의 분명한 청유를 지운다
// (5차 수정 내부 검토). 키워드 동사가 연결어미(-고·-서·-되·-며·-면·-자·-지만·-면서·
// -다가·-거나)나 '-ㄴ 뒤/다음/후'로 닫히고 공백이 오면, 또는 쉼표가 오면 절이 끝난
// 것으로 본다. '-서'는 '해서·어서·아서·여서·라서' 꼴만 — 조사 '에서'("기준이 어디에서
// 나오는지")를 절 끝으로 보면 안 된다. '-고'도 의도·인용의 '-려고/-자고/-다고/-라고'
// ("정하려고 하는데 기준이 무엇인지 궁금합니다")와 '-고 보니/보면'("정하고 보니 기준이
// 무엇인지 모르겠습니다")은 조건을 정한 것이 아니라 아직 묻는 중이므로 절 끝으로 보지
// 않는다(내부 재검토). 반면 "…정하는 기준이 무엇인지 알려 주세요"는 키워드가 관형절로
// 이어져 절이 닫히지 않으므로 끝까지 본다. 문장 유형(물음표·의문 종결·의문사+해요체)은
// 그대로 문장 전체 기준이다.
const KEYWORD_CLAUSE_END =
  /,|(?:(?<![려자다라])고(?!\s보[니면])|[해어아여라]서|되|며|면|자|지만|면서|다가|거나|뒤|다음|후)\s/;

function keywordClause(afterKeyword: string): string {
  const cut = afterKeyword.search(KEYWORD_CLAUSE_END);
  return cut === -1 ? afterKeyword : afterKeyword.slice(0, cut);
}

/**
 * 문장이 의문문이거나(물음표·의문 종결·"의문사 + 해요체/반말 종결"), 키워드가 든 절
 * 뒤쪽에 간접 의문 표지나 정보 요청 서술어가 있으면 true다. 애매하면 놓치는 쪽을 택한다 —
 * "금액 한도를 정합시다, 괜찮겠습니까?" 같은 부가 의문은 문장 전체가 의문이라
 * 놓친다(이 한계는 의도한 것).
 */
function isQuestionOrInfoRequestMention(sentence: string, afterKeyword: string): boolean {
  const trimmed = stripTrailingWhitespaceAndQuotes(sentence);
  if (trimmed.endsWith('?') || trimmed.endsWith('？')) return true;
  const core = trimmed.replace(/[.!]+$/u, '');
  if (hasInterrogativeEnding(core)) return true;
  const clause = keywordClause(afterKeyword);
  if (hasIndirectQuestionMarker(clause)) return true;
  if (hasInfoRequestVerb(clause)) return true;
  if (hasInterrogativeWord(sentence) && hasCasualOrPoliteEnding(core)) return true;
  return false;
}

function isNegatedAfter(text: string, index: number, keywordLength: number): boolean {
  const end = index + keywordLength;
  // 공백 묶음을 한 칸으로 접은 **뒤에** 창을 자른다. 직접 입력·붙여넣기에서 "뿐만  아니라"·
  // "하지  맙시다"·"못  하"처럼 두 칸 이상 벌어지면 `\s?`·' ' 표지가 빗나가 긍정 병렬은 부정으로,
  // 부정은 긍정으로 뒤집혔고(PR #10 Codex 34차 검토 P1), 접기를 창을 자른 뒤에 하면 키워드 뒤
  // 공백이 24칸을 넘을 때 창이 공백으로만 차서 그 뒤의 "하지 맙시다"를 버렸다(35차 P1). 표지
  // 패턴을 하나씩 `\s*`로 바꾸는 대신 이 한 곳에서 정규화한다. 단, 줄바꿈은 절 경계(CLAUSE_END)
  // 라서 접지 않는다 — `\s+`로 접으면 "검수\n완전 익명으로 하지 맙시다"의 둘째 줄 부정이 첫 줄
  // 검수까지 삼켰다(36차 P1). 가로 공백([^\S\n], 탭·\r 포함)만 한 칸으로 접는다.
  const rest = text.slice(end).replace(/[^\S\n]+/g, ' ').slice(0, NEGATION_WINDOW);
  const cut = rest.search(CLAUSE_END);
  const window = cut === -1 ? rest : rest.slice(0, cut);
  return hasNegationMarker(window);
}

// 한 조건의 키워드 중 하나라도 부정되면 그 조건은 제안하지 않는다 — 긍정 언급이 다른 키워드로
// 남아 있어도 마찬가지다. "효과를 측정하지 않고 바로 확대합시다."는 '효과'·'측정'이 부정되지만
// '확대'가 긍정으로 남아 MEASURE(운영 효과 측정 후 확대)가 자동 승인됐다(PR #10 Codex 16차 검토
// P1). 조건 라벨은 키워드들의 결합("측정 후 확대")이므로 일부 부정은 조건 전체의 거부로 본다.
function textMentionsConditionUnnegated(
  scenario: Scenario,
  text: string,
  conditionId: string,
): boolean {
  const condition = scenario.conditions.find((c) => c.id === conditionId);
  const keywords = condition?.keywords ?? [];
  let affirmed = false;
  for (const keyword of keywords) {
    let searchFrom = 0;
    for (;;) {
      const index = text.indexOf(keyword, searchFrom);
      if (index === -1) {
        break;
      }
      const keywordEnd = index + keyword.length;
      // 의문·정보 요청 문장 속 언급은 그 한 번만 건너뛴다(부정과 달리 조건 전체를
      // 거부하지 않는다) — 부정 검사보다 먼저 본다(PR #13 Codex 5차 검토 P1).
      const { start, end } = sentenceSpanAt(text, index);
      const sentence = text.slice(start, end);
      const afterKeyword = text.slice(keywordEnd, end);
      if (isQuestionOrInfoRequestMention(sentence, afterKeyword)) {
        searchFrom = keywordEnd;
        continue;
      }
      if (isNegatedAfter(text, index, keyword.length)) {
        return false;
      }
      affirmed = true;
      searchFrom = keywordEnd;
    }
  }
  return affirmed;
}

/** 선택된 추천 문구 ID에 연결된 조건 ID를 시나리오 순서대로 중복 없이 모은다. */
export function proposeFromPhrases(scenario: Scenario, phraseIds: string[]): string[] {
  const proposed: string[] = [];
  for (const phraseId of phraseIds) {
    const phrase = scenario.phrases.find((p) => p.id === phraseId);
    if (phrase?.conditionId && !proposed.includes(phrase.conditionId)) {
      proposed.push(phrase.conditionId);
    }
  }
  return proposed;
}

/**
 * 자유 입력 텍스트에서 조건별 명시 키워드(Condition.keywords)를 찾아 제안만 한다(확정 아님).
 * 키워드 뒤 같은 절에 "없이·생략·말고·-지 않-·안 -·못 하-·반대·빼고·제외·아니·금지·-지 말-"이 나오면 부정문으로 보고
 * 제안하지 않는다('-지 말-'은 '-지 마-'·'-지 맙-' 활용 전체). 한 조건의 키워드 중 하나라도 부정되면 다른 키워드가 긍정으로 남아 있어도
 * 그 조건은 제안하지 않는다. 키워드가 의문문이나 정보 요청 문장(같은 문장 안에서 물음표·
 * 의문 종결·간접 의문 표지·"알려/설명/궁금" 같은 서술어) 속에서만 쓰였으면 그 언급은
 * 무시한다 — 같은 조건을 다른 문장에서 긍정으로 말하면 그대로 제안한다(PR #13 Codex 5차 검토 P1).
 */
export function proposeFromText(scenario: Scenario, text: string): string[] {
  return scenario.conditions
    .filter((condition) => textMentionsConditionUnnegated(scenario, text, condition.id))
    .map((condition) => condition.id);
}

/** 주어진 조건 ID 집합 안에서 실제로 겹치는 충돌쌍만 골라낸다. */
export function findConflicts(scenario: Scenario, conditionIds: string[]): ConflictPair[] {
  const idSet = new Set(conditionIds);
  return scenario.conflicts.filter(([a, b]) => idSet.has(a) && idSet.has(b));
}

export interface ConditionConfirmation {
  id: string;
  status: 'proposed' | 'confirmed';
}

/**
 * 제안된 조건 중 참가자가 받아들인 것만 확정한다. 충돌쌍이 동시에 accepted에 있으면
 * 그 두 조건 모두 확정을 거부하고 'proposed' 상태로 남긴다.
 */
export function confirmConditions(
  scenario: Scenario,
  proposedIds: string[],
  acceptedIds: string[],
): ConditionConfirmation[] {
  const acceptedSet = new Set(acceptedIds);
  const blockedByConflict = new Set<string>();
  for (const [a, b] of scenario.conflicts) {
    if (acceptedSet.has(a) && acceptedSet.has(b)) {
      blockedByConflict.add(a);
      blockedByConflict.add(b);
    }
  }
  return proposedIds.map((id) => ({
    id,
    status: acceptedSet.has(id) && !blockedByConflict.has(id) ? 'confirmed' : 'proposed',
  }));
}
