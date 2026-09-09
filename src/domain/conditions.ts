// 조건 제안·충돌·확정 순수 함수. CLAUDE_IMPLEMENTATION.md 4장: 자동 추출은 확정이
// 아닌 제안이며, 부정문·상충 문구를 단순 키워드로 자동 확정하지 않는다.
// 조건 키워드는 시나리오 데이터(조건 라벨·문구 텍스트)에서만 파생한다.

import type { ConflictPair, Scenario } from '../content/types';

// 조건 라벨/문구가 어떤 언어든 이 세 부정어 근처에서는 조건을 제안하지 않는다(4장 명시 예).
const NEGATION_MARKERS = ['없이', '생략', '말고'];
const NEGATION_WINDOW = 8;

// 문구 문장에서 조사를 떼어 명사만 남기기 위한 일반 한국어 문법 어미 목록.
// 시나리오별 조건 키워드가 아니라 언어 처리용 공통 어미이므로 여기 둔다.
const TRAILING_PARTICLES = [
  '합시다',
  '합니다',
  '해야',
  '하고',
  '해서',
  '으로',
  '에서',
  '에게',
  '에는',
  '에도',
  '이나',
  '라도',
  '까지',
  '부터',
  '에',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '와',
  '과',
  '도',
  '만',
  '한',
].sort((a, b) => b.length - a.length);

function stripTrailingParticle(token: string): string {
  for (const particle of TRAILING_PARTICLES) {
    if (token.length > particle.length + 1 && token.endsWith(particle)) {
      return token.slice(0, token.length - particle.length);
    }
  }
  return token;
}

function tokenizeLabel(label: string): string[] {
  return label
    .split(/[\s·,/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenizePhraseText(text: string): string[] {
  return text
    .split(/[\s.,!?·]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .map(stripTrailingParticle)
    .filter((token) => token.length >= 2);
}

/** 조건 라벨과 그 조건에 연결된 문구 텍스트에서 제안용 키워드를 파생한다. */
function conditionKeywords(scenario: Scenario, conditionId: string): string[] {
  const condition = scenario.conditions.find((c) => c.id === conditionId);
  const labelTokens = condition ? tokenizeLabel(condition.label) : [];
  const phraseTokens = scenario.phrases
    .filter((phrase) => phrase.conditionId === conditionId)
    .flatMap((phrase) => tokenizePhraseText(phrase.text));
  return Array.from(new Set([...labelTokens, ...phraseTokens]));
}

function isNegatedAt(text: string, index: number, keywordLength: number): boolean {
  const start = Math.max(0, index - NEGATION_WINDOW);
  const end = Math.min(text.length, index + keywordLength + NEGATION_WINDOW);
  const window = text.slice(start, end);
  return NEGATION_MARKERS.some((marker) => window.includes(marker));
}

function textMentionsConditionUnnegated(
  scenario: Scenario,
  text: string,
  conditionId: string,
): boolean {
  const keywords = conditionKeywords(scenario, conditionId);
  for (const keyword of keywords) {
    let searchFrom = 0;
    for (;;) {
      const index = text.indexOf(keyword, searchFrom);
      if (index === -1) {
        break;
      }
      if (!isNegatedAt(text, index, keyword.length)) {
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
 * 자유 입력 텍스트에서 조건 라벨/문구 키워드를 찾아 제안만 한다(확정 아님).
 * "없이·생략·말고" 근처에 나오는 언급은 부정문으로 보고 제안하지 않는다.
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
