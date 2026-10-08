// T78: anonBoard의 콘텐츠 검증 테스트를 안건 ②(experience-first)에 적용한다 — 조건
// 키워드가 다른 조건 문구에 걸리지 않는지(키워드 격리), 후속 선택지(DATA_VETO/
// EXP_ONLY 상충쌍 포함)가 정확히 제안하는 조건을 갖는지, 그리고 anonBoard.test.ts와
// 같은 기본 구조 검증.
import { describe, expect, it } from 'vitest';
import { experienceFirstScenario } from '../../src/content/scenarios/experienceFirst';
import { findConflicts, proposeFromText } from '../../src/domain/conditions';
import type { ExecMemberId, Predicate } from '../../src/content/types';
import {
  MAX_SENTENCE_CHARS,
  findForbiddenWords,
  sentenceCharLengths,
} from '../../server/prompts/plainLanguage';

const scenario = experienceFirstScenario;

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

describe('experienceFirstScenario 기본 구조', () => {
  const evidenceIds = new Set(scenario.evidence.map((e) => e.id));
  const conditionIds = new Set(scenario.conditions.map((c) => c.id));

  it('자료 카드가 4개, 추천 문구가 10개(찬성 5·반대 4·요청 1), 조건이 5개다', () => {
    expect(scenario.evidence).toHaveLength(4);
    expect(scenario.phrases).toHaveLength(10);
    expect(scenario.conditions).toHaveLength(5);
  });

  it('추천 문구의 side가 FOR/AGAINST/BOTH 중 하나이고, AGAINST가 정확히 4개다(T87)', () => {
    for (const phrase of scenario.phrases) {
      expect(['FOR', 'AGAINST', 'BOTH']).toContain(phrase.side);
    }
    expect(scenario.phrases.filter((p) => p.side === 'AGAINST')).toHaveLength(4);
    expect(scenario.phrases.filter((p) => p.side === 'FOR')).toHaveLength(5);
    expect(scenario.phrases.filter((p) => p.side === 'BOTH')).toHaveLength(1);
  });

  it('phrases·reactions·followUp의 조건 참조가 모두 존재한다', () => {
    for (const phrase of scenario.phrases) {
      if (phrase.conditionId !== null) {
        expect(conditionIds.has(phrase.conditionId)).toBe(true);
      }
    }
    for (const reaction of scenario.reactions) {
      if (reaction.conditionId !== 'none') {
        expect(conditionIds.has(reaction.conditionId)).toBe(true);
      }
    }
    for (const option of scenario.followUp.options) {
      if (option.proposeConditionId !== null) {
        expect(conditionIds.has(option.proposeConditionId)).toBe(true);
      }
    }
  });

  it('initialOpinions가 참조하는 자료 ID가 모두 존재한다', () => {
    for (const opinion of scenario.initialOpinions) {
      for (const id of opinion.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it('상충쌍은 DATA_VETO ↔ EXP_ONLY 하나다', () => {
    expect(scenario.conflicts).toEqual([['DATA_VETO', 'EXP_ONLY']]);
  });

  it('voteRules의 has() 참조 조건 ID가 모두 존재하고, 각 임원 규칙의 마지막 행은 always다', () => {
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      const rules = scenario.voteRules[memberId];
      for (const rule of rules) {
        for (const id of collectHasIds(rule.when)) {
          expect(conditionIds.has(id)).toBe(true);
        }
      }
      expect(rules[rules.length - 1]?.when).toEqual({ always: true });
    }
  });

  it('임원별 규칙 행 수가 문서와 일치한다 (CEO 2, CFO 3, CAIO 3, CISO 4)', () => {
    expect(scenario.voteRules.CEO).toHaveLength(2);
    expect(scenario.voteRules.CFO).toHaveLength(3);
    expect(scenario.voteRules.CAIO).toHaveLength(3);
    expect(scenario.voteRules.CISO).toHaveLength(4);
  });

  it('12개 규칙 모두 판단 이유가 있고 수치 표현이 없다', () => {
    const NUMERIC_COPY_PATTERN = /%|절감/;
    let total = 0;
    for (const memberId of Object.keys(scenario.voteRules) as ExecMemberId[]) {
      for (const rule of scenario.voteRules[memberId]) {
        total += 1;
        expect(rule.reason, `${memberId}: ${JSON.stringify(rule.when)}`).toBeTruthy();
        expect(rule.reason).not.toMatch(NUMERIC_COPY_PATTERN);
      }
    }
    expect(total).toBe(12);
  });
});

describe('조건 키워드 격리(proposeFromText)', () => {
  it('P1~P5 각 문구 문장은 정확히 자기 조건 하나만 제안한다', () => {
    expect(proposeFromText(scenario, '처음 겪는 상황에서만 경험을 우선합시다.')).toEqual([
      'SCOPE',
    ]);
    expect(proposeFromText(scenario, '경험으로 결정할 때는 판단 근거를 기록합시다.')).toEqual([
      'RECORD',
    ]);
    expect(
      proposeFromText(scenario, '데이터가 경고하면 결정을 잠시 멈추고 다시 봅시다.'),
    ).toEqual(['DATA_VETO']);
    expect(
      proposeFromText(scenario, '결정 결과를 돌아보고 다음 판단 기준으로 삼읍시다.'),
    ).toEqual(['REVIEW']);
    expect(proposeFromText(scenario, '최종 결정은 언제나 경험 판단을 따르도록 합시다.')).toEqual([
      'EXP_ONLY',
    ]);
  });

  it('P6(요청형)과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(proposeFromText(scenario, '경험을 먼저 믿어야 할 이유를 더 설명해 주십시오.')).toEqual(
      [],
    );
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('후속 선택지(DATA_VETO·EXP_ONLY 상충쌍 포함)는 각각 proposeConditionId와 정확히 같은 조건만 제안한다', () => {
    expect(scenario.followUp.options.length).toBeGreaterThanOrEqual(3);
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });

  it('REVIEW("결정 결과를 돌아보")와 RECORD("판단 근거")는 서로의 문구에 걸리지 않는다', () => {
    expect(
      proposeFromText(scenario, '결정 결과를 돌아보고 다음 판단 기준으로 삼읍시다.'),
    ).not.toContain('RECORD');
    expect(
      proposeFromText(scenario, '경험으로 결정할 때는 판단 근거를 기록합시다.'),
    ).not.toContain('REVIEW');
  });

  // PR #13 Codex 1차 검토 P1: REVIEW 키워드가 '복기' 한 단어였을 때 정보성 질문에도
  // 걸려 묻지도 않은 조건이 확정으로 제안됐다(ai-approval OWNER '책임자'와 같은 문제).
  // '결정 결과를 돌아보'라는 약속형 어구로 좁힌 뒤에는 단순히 누가 하는지 묻는 문장에서
  // 제안하지 않는다.
  it('"돌아보는 건 누가 합니까?" 같은 정보성 질문은 REVIEW를 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '돌아보는 건 누가 합니까?')).not.toContain('REVIEW');
  });

  // PR #13 Codex 4차 검토: REVIEW와 같은 문제(명사·시점구만 있는 키워드가 정보성
  // 질문에도 걸림)를 SCOPE·RECORD·DATA_VETO·EXP_ONLY에서도 전수 점검해 약속형 어구로
  // 좁혔다. 각 조건의 라벨 명사를 그대로 쓴 정보성 질문이 제안되지 않는지 확인한다.
  it('조건마다 명사만 묻는 정보성 질문은 아무 조건도 제안하지 않는다(PR #13 Codex 4차 검토)', () => {
    const informationalQuestions = [
      '처음 겪는 상황이란 무엇입니까?',
      '판단 근거는 어디에 있습니까?',
      '데이터 경고는 어떻게 받습니까?',
      '경험 판단이란 무엇입니까?',
    ];
    for (const text of informationalQuestions) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
  });

  // PR #13 Codex 5차 검토 P1: 4차에서 좁힌 약속형 어간도 정보성 질문의 부분 문자열이다.
  // 조건 5개 전부, 키워드가 둘인 조건(EXP_ONLY)은 키워드별로, 물음표 있는 꼴·없는 꼴
  // (간접 의문)·정보 요청 서술어 꼴을 섞어 확인한다.
  it('약속형 어간을 그대로 포함한 의문·정보 요청 문장은 아무 조건도 제안하지 않는다(PR #13 Codex 5차 검토)', () => {
    const negativeQuestions = [
      // SCOPE: '상황에서만 경험을 우선'
      '상황에서만 경험을 우선하는 기준이 무엇입니까?',
      '상황에서만 경험을 우선할지 고민입니다.',
      // RECORD: '판단 근거를 기록'
      '판단 근거를 기록하는 방법이 무엇입니까?',
      '판단 근거를 기록하는 기준이 궁금합니다.',
      // DATA_VETO: '경고하면 결정을 잠시 멈추'
      '경고하면 결정을 잠시 멈추는 기준이 무엇입니까?',
      '경고하면 결정을 잠시 멈추는지 궁금합니다.',
      // REVIEW: '결정 결과를 돌아보'
      '결정 결과를 돌아보는 기준이 무엇입니까?',
      '결정 결과를 돌아보는 방법을 알려 주세요.',
      // EXP_ONLY: '언제나 경험 판단'
      '언제나 경험 판단을 따르는 기준이 무엇입니까?',
      '언제나 경험 판단을 따르는 방법을 알려 주세요.',
      // ㄹ 불규칙 활용 '-를지'(따를지)·'-ㄹ지'(둘지)도 간접 의문으로 본다 — 열거한
      // '할지·될지·을지'만 보면 빠지던 꼴.
      '최종 결정을 언제나 경험 판단에 따를지 고민입니다.',
      // 물음표 없는 의문사 + 해요체(PR #13 Codex 6차 검토 P1)
      '판단 근거를 기록하는 방식은 어떻게 정해요',
      '경고하면 결정을 잠시 멈추는 기준은 누가 정해요',
    ];
    for (const text of negativeQuestions) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
  });

  it('질문과 청유가 섞인 문장은 질문은 무시하고 청유한 조건만 제안한다(PR #13 Codex 5차 검토)', () => {
    expect(
      proposeFromText(scenario, '처음 겪는 상황이란 무엇입니까? 판단 근거를 기록합시다.'),
    ).toEqual(['RECORD']);
    expect(
      proposeFromText(scenario, '상황에서만 경험을 우선하는 기준이 무엇입니까? 상황에서만 경험을 우선합시다.'),
    ).toEqual(['SCOPE']);
    expect(
      proposeFromText(
        scenario,
        '상황에서만 경험을 우선하지 않는 이유가 무엇입니까? 상황에서만 경험을 우선합시다.',
      ),
    ).toEqual(['SCOPE']);
    expect(proposeFromText(scenario, '상황에서만 경험을 우선합시다 기준은 무엇입니까')).toEqual([
      'SCOPE',
    ]);
  });

  // 회귀: 긍정 언급이 의문 규칙 때문에 사라지면 안 된다. EXP_ONLY의 '언제나'가 의문사
  // '언제'의 부정칭 꼴로 걸려 의문사로 잡히면 안 된다.
  it('의문 규칙을 추가해도 긍정 언급은 그대로 제안한다(PR #13 Codex 5차 검토 회귀)', () => {
    expect(
      proposeFromText(scenario, '최종 결정은 언제나 경험 판단을 따르도록 합시다.'),
    ).toEqual(['EXP_ONLY']);
  });
});

describe('findConflicts', () => {
  it('DATA_VETO·EXP_ONLY가 함께 있을 때만 상충쌍을 반환한다', () => {
    expect(findConflicts(scenario, ['DATA_VETO', 'EXP_ONLY', 'SCOPE'])).toEqual([
      ['DATA_VETO', 'EXP_ONLY'],
    ]);
    expect(findConflicts(scenario, ['DATA_VETO', 'SCOPE'])).toEqual([]);
  });
});

// T93(2026-10-07 사용자 지시 "초중학생이 봐도 이해할 수 있는 수준으로"): aiApproval.test.ts와
// 같은 검사 — scripted 임원 발언이 금지 어휘를 쓰지 않고 문장당 글자 수 상한을 넘지 않는지.
describe('쉬운 말(T93)', () => {
  const execStatements: string[] = [
    ...scenario.initialOpinions.map((o) => o.text),
    ...scenario.reactions.map((r) => r.text),
    ...Object.values(scenario.oppositionReactions ?? {}),
    // T96: REACTIONS "유지" 카드의 빈 대사 대신 쓰는 역할별 유지 이유도 임원 발언이다.
    ...Object.values(scenario.holdReasons ?? {}),
    ...Object.values(scenario.voteRules).flatMap((rules) => rules.map((r) => r.reason ?? '')),
    scenario.followUp.question,
    ...(scenario.followUp.byStance
      ? [scenario.followUp.byStance.FOR.question, scenario.followUp.byStance.AGAINST.question]
      : []),
  ];

  it('금지 어휘를 쓰지 않는다', () => {
    for (const text of execStatements) {
      expect(findForbiddenWords(text), text).toEqual([]);
    }
  });

  it(`문장당 글자 수가 ${MAX_SENTENCE_CHARS}자를 넘지 않는다`, () => {
    for (const text of execStatements) {
      for (const length of sentenceCharLengths(text)) {
        expect(length, text).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
      }
    }
  });
});

// T94(2026-10-08 사용자 지시 "상황·제안·미정 문장도 같은 톤으로"): aiApproval.test.ts와
// 같은 검사 — 상황 파악·안건 분해·결과 문구의 금지 어휘, 발언형 문구의 문장당 글자 수 상한.
describe('쉬운 말(T94)', () => {
  const structuralStatements: string[] = [
    scenario.subtitle,
    scenario.motionBreakdown.proposal,
    ...scenario.motionBreakdown.undecidedItems.map((item) => item.text),
  ];
  const conversationalStatements: string[] = [
    scenario.chairBriefing.situation,
    scenario.chairBriefing.role,
    scenario.incident.headline,
    scenario.incident.hook,
    ...scenario.remainingTasks.map((item) => item.text),
    scenario.resultCopy.pass,
    scenario.resultCopy.reject,
    scenario.resultCopy.sixMonthsLater.pass,
    scenario.resultCopy.sixMonthsLater.passOriginal,
    scenario.resultCopy.sixMonthsLater.reject,
  ];

  it('구조적 문구(subtitle·motionBreakdown)에 금지 어휘가 없다', () => {
    for (const text of structuralStatements) {
      expect(findForbiddenWords(text), text).toEqual([]);
    }
  });

  it('상황·결과 문구에 금지 어휘가 없고 문장당 글자 수 상한을 넘지 않는다', () => {
    for (const text of conversationalStatements) {
      expect(findForbiddenWords(text), text).toEqual([]);
      for (const length of sentenceCharLengths(text)) {
        expect(length, text).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
      }
    }
  });
});

describe('근거 자료 content는 쉬운 짧은 문장이다(T99)', () => {
  it('문장 수가 2개 이하이고 문장당 45자 이하이며 금지어가 없다', () => {
    for (const card of scenario.evidence) {
      const lengths = sentenceCharLengths(card.content);
      expect(lengths.length, card.id).toBeLessThanOrEqual(2);
      for (const length of lengths) {
        expect(length, `${card.id}: ${card.content}`).toBeLessThanOrEqual(45);
      }
      expect(findForbiddenWords(card.content), card.id).toEqual([]);
    }
  });

  it('핵심 말(highlightTerms)이 4~6개이고 상황·제안·미정 문장에 실제로 들어 있다', () => {
    const terms = scenario.highlightTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(4);
    expect(terms.length).toBeLessThanOrEqual(6);
    const haystack = [
      scenario.chairBriefing.situation,
      scenario.motionBreakdown.proposal,
      ...scenario.motionBreakdown.undecidedItems.map((i) => i.text),
    ].join(' ');
    for (const term of terms) {
      expect(haystack, term).toContain(term);
    }
  });
});

// T100(2026-10-08 규칙 점검): 참가자 눈에 보이는 조건 라벨·추천 문구·키워드·자료 제목·
// 후속 답변·결과 문구까지 금지 어휘 0을 고정한다. 금지 목록에 없지만 같은 어려운 말인
// 단어도 함께 막는다.
describe('쉬운 말(T100) — 라벨·추천 문구·키워드·제목', () => {
  const EXTRA_HARD_WORDS = ['복기', '재검토', '전례 없는', '절대 우선', '양식', '전면'];
  const visibleTexts: string[] = [
    scenario.originalMotion.text,
    scenario.subtitle,
    scenario.briefingSummary.text,
    ...scenario.evidence.flatMap((e) => [e.title, e.content, e.insight]),
    ...scenario.conditions.flatMap((c) => [c.label, ...c.keywords]),
    ...scenario.phrases.map((p) => p.text),
    ...scenario.followUp.options.map((o) => o.text),
    ...Object.values(scenario.holdReasons ?? {}),
    scenario.resultCopy.pass,
    scenario.resultCopy.reject,
    scenario.resultCopy.sixMonthsLater.pass,
    scenario.resultCopy.sixMonthsLater.passOriginal,
    scenario.resultCopy.sixMonthsLater.reject,
  ];

  it('금지 어휘와 같은 수준의 어려운 말이 하나도 없다', () => {
    for (const text of visibleTexts) {
      expect(findForbiddenWords(text), text).toEqual([]);
      for (const word of EXTRA_HARD_WORDS) {
        expect(text.includes(word), `${word} :: ${text}`).toBe(false);
      }
    }
  });

  it('안건 번호 라벨이 "안건 0N" 꼴이다', () => {
    expect(scenario.incident.caseLabel).toMatch(/^안건 0\d$/);
  });
});
