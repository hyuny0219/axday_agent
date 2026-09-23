// 조건 제안·충돌·확정 순수 함수. CLAUDE_IMPLEMENTATION.md 4장: 자동 추출은 확정이
// 아닌 제안이며, 부정문·상충 문구를 단순 키워드로 자동 확정하지 않는다.
// 조건 키워드는 시나리오 데이터(Condition.keywords)에 명시된 것만 쓰고,
// 라벨·문구 텍스트에서 토큰을 파생하지 않는다.

import type { ConflictPair, Scenario } from '../content/types';

// 키워드 뒤쪽, 같은 절 안(문장 부호·쉼표 전, 최대 NEGATION_WINDOW자)에 부정 표지가 나오면
// 그 언급은 제안하지 않는다(4장 명시 예 "없이·생략·말고"). 후속 직접 답변 "작성자를
// 확인하지 않겠습니다."가 TRACE 키워드 '작성자를 확인'에 걸려 참가자가 거부한 추적
// 조건이 자동 승인되던 문제(PR #10 Codex 12차 검토 P1) 뒤로 '-지 않-'·'없-'·'안 -'·
// '못 하-'·'반대'도 본다. 부정어가 다른 조건을 향하는 겹문장에서는 앞의 긍정 언급까지
// 빠질 수 있지만, 제안은 확정이 아니고 추천 문구로 다시 넣을 수 있으므로 놓치는 쪽을
// 택한다 — 거부한 조건을 몰래 넣는 것보다 낫다. 키워드 자체에 부정어가 포함된 경우(예:
// ANON_FULL의 '추적할 수 없')는 그 부정어가 키워드 범위 안에 있어 창에 들어오지 않으므로
// 자기 부정으로 처리되지 않는다.
const NEGATION_MARKERS = ['없', '생략', '말고', '않', '안 ', '못하', '못 하', '반대'];
const NEGATION_WINDOW = 24;
const CLAUSE_END = /[.!?,\n]/;

function isNegatedAfter(text: string, index: number, keywordLength: number): boolean {
  const end = index + keywordLength;
  const rest = text.slice(end, end + NEGATION_WINDOW);
  const cut = rest.search(CLAUSE_END);
  const window = cut === -1 ? rest : rest.slice(0, cut);
  return NEGATION_MARKERS.some((marker) => window.includes(marker));
}

function textMentionsConditionUnnegated(
  scenario: Scenario,
  text: string,
  conditionId: string,
): boolean {
  const condition = scenario.conditions.find((c) => c.id === conditionId);
  const keywords = condition?.keywords ?? [];
  for (const keyword of keywords) {
    let searchFrom = 0;
    for (;;) {
      const index = text.indexOf(keyword, searchFrom);
      if (index === -1) {
        break;
      }
      if (!isNegatedAfter(text, index, keyword.length)) {
        return true;
      }
      searchFrom = index + keyword.length;
    }
  }
  return false;
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
 * 키워드 뒤 같은 절에 "없이·생략·말고·-지 않-·안 -·못 하-·반대"가 나오면 부정문으로 보고
 * 제안하지 않는다.
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
