// T137: 반대 입장 대칭 설계의 결과표를 규칙표(voteRules) 계산으로 고정한다. 두 안건 × 두 입장.
// 참가자 표는 입장대로(찬성 YES·반대 NO), 같은 표가 내 좌석을 포함해 3석 이상이면 성공이다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import type { Scenario } from '../../src/content/types';
import { EXEC_MEMBER_ORDER, decideMember } from '../../src/domain/voting';

type Stance = 'FOR' | 'AGAINST';

/** 내 표와 같은 표를 낸 좌석 수(나 포함). 추가 질문에 답한 뒤의 최종 표다. */
function seats(scenario: Scenario, stance: Stance, conditionIds: string[]): number {
  const mine = stance === 'FOR' ? 'YES' : 'NO';
  const same = EXEC_MEMBER_ORDER.filter(
    (memberId) =>
      decideMember(scenario.voteRules[memberId], {
        conditionIds,
        executionMode: 'DEFAULT',
        participantStance: stance,
        followUpAnswered: true,
      }) === mine,
  ).length;
  return same + 1;
}

interface Row {
  name: string;
  ids: string[];
  seats: number;
}

const TABLES: Array<{ scenario: Scenario; against: Row[]; for: Row[] }> = [
  {
    scenario: aiApprovalScenario,
    against: [
      { name: '근거 없음', ids: [], seats: 2 },
      { name: '감사 메모(CAIO)', ids: ['AG_AUDIT'], seats: 3 },
      { name: '사용자 설문(CISO)', ids: ['AG_TRUST'], seats: 3 },
      { name: '둘', ids: ['AG_AUDIT', 'AG_TRUST'], seats: 4 },
      { name: '셋(CEO까지)', ids: ['AG_AUDIT', 'AG_TRUST', 'AG_SCALE'], seats: 5 },
    ],
    for: [
      { name: '조건 없음', ids: [], seats: 2 },
      { name: '사유 기록(CAIO)', ids: ['LOG'], seats: 3 },
      { name: '+ 책임자(CISO)', ids: ['LOG', 'OWNER'], seats: 4 },
      { name: '+ 한도와 다시 보기(CFO)', ids: ['LOG', 'OWNER', 'LIMIT', 'REVIEW'], seats: 5 },
      { name: '함정', ids: ['FULL_AUTO'], seats: 1 },
    ],
  },
  {
    scenario: experienceFirstScenario,
    against: [
      { name: '근거 없음', ids: [], seats: 2 },
      { name: '실패 사례(CAIO)', ids: ['AG_WARN'], seats: 3 },
      { name: '베테랑 인터뷰(CISO)', ids: ['AG_WHY'], seats: 3 },
      { name: '둘', ids: ['AG_WARN', 'AG_WHY'], seats: 4 },
      { name: '셋(CEO까지)', ids: ['AG_WARN', 'AG_WHY', 'AG_SPLIT'], seats: 5 },
    ],
    for: [
      { name: '조건 없음', ids: [], seats: 2 },
      { name: '처음 겪는 상황(CAIO)', ids: ['SCOPE'], seats: 3 },
      { name: '+ 경고하면 멈춤(CFO)', ids: ['SCOPE', 'DATA_VETO'], seats: 4 },
      { name: '+ 기록과 돌아보기(CISO)', ids: ['SCOPE', 'DATA_VETO', 'RECORD', 'REVIEW'], seats: 5 },
      { name: '함정', ids: ['EXP_ONLY'], seats: 1 },
    ],
  },
];

describe.each(TABLES)('T137 결과표 — $scenario.id', ({ scenario, against, for: forRows }) => {
  it.each(against)('반대 참가자: $name → $seats석', (row) => {
    expect(seats(scenario, 'AGAINST', row.ids)).toBe(row.seats);
  });

  it.each(forRows)('찬성 참가자: $name → $seats석', (row) => {
    expect(seats(scenario, 'FOR', row.ids)).toBe(row.seats);
  });

  it('처음 입장은 1 찬성·1 반대·2 고민 중이다', () => {
    const counts = { FOR: 0, AGAINST: 0, UNDECIDED: 0 };
    for (const opinion of scenario.initialOpinions) counts[opinion.openingStance] += 1;
    expect(counts).toEqual({ FOR: 1, AGAINST: 1, UNDECIDED: 2 });
  });

  it('추가 질문에 답하기 전에는 반대 쪽 조건으로 돌린 임원도 처음 표(찬성)에 머문다', () => {
    const ctx = (ids: string[]) => ({
      conditionIds: ids,
      executionMode: 'DEFAULT',
      participantStance: 'AGAINST' as const,
      followUpAnswered: false,
    });
    const all = scenario.conditions.filter((c) => c.side === 'AGAINST').map((c) => c.id);
    const noCount = EXEC_MEMBER_ORDER.filter(
      (memberId) => decideMember(scenario.voteRules[memberId], ctx(all)) === 'NO',
    ).length;
    expect(noCount).toBe(1);
  });

  it('반대 쪽에는 함정이 없다(T138): 어떤 반대 쪽 조건도 반대표 좌석을 줄이지 않는다', () => {
    const against = scenario.conditions.filter((c) => c.side === 'AGAINST').map((c) => c.id);
    for (const id of against) expect(seats(scenario, 'AGAINST', [id])).toBeGreaterThanOrEqual(seats(scenario, 'AGAINST', []));
    expect(seats(scenario, 'AGAINST', against)).toBe(5);
  });

  it('반대 근거는 모두 side가 AGAINST이고 라벨·키워드가 있다', () => {
    const objections = scenario.conditions.filter((c) => c.side === 'AGAINST');
    expect(objections).toHaveLength(3);
    for (const condition of objections) {
      expect(condition.label.length).toBeGreaterThan(0);
      expect(condition.keywords.length).toBeGreaterThan(0);
    }
  });
});
