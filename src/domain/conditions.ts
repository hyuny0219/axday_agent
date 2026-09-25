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

function isNegatedAfter(text: string, index: number, keywordLength: number): boolean {
  const end = index + keywordLength;
  const rest = text.slice(end, end + NEGATION_WINDOW);
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
      if (isNegatedAfter(text, index, keyword.length)) {
        return false;
      }
      affirmed = true;
      searchFrom = index + keyword.length;
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
 * 그 조건은 제안하지 않는다.
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
