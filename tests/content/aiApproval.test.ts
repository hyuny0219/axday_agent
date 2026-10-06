// T78: anonBoard의 콘텐츠 검증 테스트를 안건 ①(ai-approval)에 적용한다 — 조건 키워드가
// 다른 조건 문구에 걸리지 않는지(키워드 격리), 후속 선택지가 정확히 하나의 조건만
// 제안하는지, 상충쌍이 올바른지, 그리고 anonBoard.test.ts와 같은 기본 구조 검증.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';
import { findConflicts, proposeFromText } from '../../src/domain/conditions';
import type { ExecMemberId, Predicate } from '../../src/content/types';

const scenario = aiApprovalScenario;

function collectHasIds(predicate: Predicate): string[] {
  if ('has' in predicate) return [predicate.has];
  if ('all' in predicate) return predicate.all.flatMap(collectHasIds);
  if ('any' in predicate) return predicate.any.flatMap(collectHasIds);
  if ('not' in predicate) return collectHasIds(predicate.not);
  return [];
}

describe('aiApprovalScenario 기본 구조', () => {
  const evidenceIds = new Set(scenario.evidence.map((e) => e.id));
  const conditionIds = new Set(scenario.conditions.map((c) => c.id));

  it('자료 카드가 4개, 추천 문구가 6개, 조건이 5개다', () => {
    expect(scenario.evidence).toHaveLength(4);
    expect(scenario.phrases).toHaveLength(6);
    expect(scenario.conditions).toHaveLength(5);
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

  it('상충쌍은 REVIEW ↔ FULL_AUTO 하나다', () => {
    expect(scenario.conflicts).toEqual([['REVIEW', 'FULL_AUTO']]);
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
    expect(proposeFromText(scenario, '결재 금액 한도를 정해 소액부터 자동 승인합시다.')).toEqual([
      'LIMIT',
    ]);
    expect(proposeFromText(scenario, '자동 승인마다 승인 사유를 기록합시다.')).toEqual(['LOG']);
    expect(proposeFromText(scenario, '승인 뒤 사람이 표본 재검토를 하도록 합시다.')).toEqual([
      'REVIEW',
    ]);
    expect(
      proposeFromText(scenario, '잘못된 승인에 책임질 결재 규칙 책임자를 지정합시다.'),
    ).toEqual(['OWNER']);
    expect(proposeFromText(scenario, '사람 검토를 전면 생략하고 전부 자동 승인합시다.')).toEqual([
      'FULL_AUTO',
    ]);
  });

  it('P6(요청형)과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(proposeFromText(scenario, '맡겨도 될지 판단할 근거를 더 제시해 주십시오.')).toEqual([]);
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('후속 선택지는 각각 proposeConditionId와 정확히 같은 조건만(또는 빈 배열을) 제안한다', () => {
    expect(scenario.followUp.options.length).toBeGreaterThanOrEqual(3);
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });

  it('"검토 없이 공유"류 부정문은 REVIEW를 제안하지 않는다(기존 부정 규칙이 그대로 적용된다)', () => {
    expect(proposeFromText(scenario, '표본 재검토 없이 바로 넘깁시다.')).not.toContain('REVIEW');
  });

  // PR #13 Codex 1차 검토 P1: OWNER 키워드가 '책임자' 한 단어였을 때 정보성 질문에도
  // 걸려 ReactionsScreen이 묻지도 않은 조건을 확정으로 제안했다. '책임자를 지정'하겠다는
  // 약속형 표현으로 좁힌 뒤에는 단순히 책임자가 누구인지 묻는 문장에서 제안하지 않는다.
  it('"현재 책임자가 누구인지" 같은 정보성 질문은 OWNER를 제안하지 않는다', () => {
    expect(
      proposeFromText(scenario, '현재 책임자가 누구인지 먼저 알려 주세요.'),
    ).not.toContain('OWNER');
  });

  // PR #13 Codex 4차 검토: OWNER와 같은 문제(명사만 있는 키워드가 정보성 질문에도
  // 걸림)를 LIMIT·LOG·REVIEW·FULL_AUTO에서도 전수 점검해 약속형 어구로 좁혔다.
  // 각 조건의 라벨 명사를 그대로 쓴 정보성 질문이 제안되지 않는지 확인한다.
  it('조건마다 명사만 묻는 정보성 질문은 아무 조건도 제안하지 않는다(PR #13 Codex 4차 검토)', () => {
    const informationalQuestions = [
      '금액 한도가 얼마입니까?',
      '승인 사유가 무엇인지 알려 주세요.',
      '표본 재검토는 누가 합니까?',
      '전면 생략이 무슨 뜻입니까?',
    ];
    for (const text of informationalQuestions) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
  });

  // PR #13 Codex 5차 검토 P1: 4차에서 좁힌 약속형 어간도 정보성 질문의 부분 문자열이다
  // — "금액 한도를 정하는 기준이 무엇입니까?"가 '금액 한도를 정'에 걸린다. 조건 5개
  // 전부, 키워드가 둘인 조건(REVIEW·OWNER·FULL_AUTO)은 키워드별로, 물음표 있는 꼴·
  // 없는 꼴(간접 의문)·정보 요청 서술어 꼴을 섞어 확인한다.
  it('약속형 어간을 그대로 포함한 의문·정보 요청 문장은 아무 조건도 제안하지 않는다(PR #13 Codex 5차 검토)', () => {
    const negativeQuestions = [
      // LIMIT: '금액 한도를 정' — Codex 1차 예문
      '금액 한도를 정하는 기준이 무엇입니까?',
      '금액 한도를 정하는 기준이 무엇인지 모르겠습니다.',
      '금액 한도를 정할지 고민입니다.',
      '금액 한도를 정하는 방법을 알려 주세요.',
      // LOG: '승인 사유를 기록' — Codex 2차 예문
      '승인 사유를 기록하는 방법이 무엇입니까?',
      '승인 사유를 기록하는 이유가 무엇인지 설명해 주십시오.',
      '승인 사유를 기록할지 고민입니다.',
      '승인 사유를 기록하는 기준이 궁금합니다.',
      // REVIEW: 키워드 2개 — '표본 재검토를 하'·'사람이 다시 보도록'
      '표본 재검토를 하는 기준이 무엇입니까?',
      '표본 재검토를 할지 고민입니다.',
      '사람이 다시 보도록 하는 절차가 무엇입니까?',
      '사람이 다시 보도록 하는 방법을 알려 주세요.',
      // OWNER: 키워드 2개 — '책임자를 지정'·'결재 규칙 책임자'
      '책임자를 지정하는 기준이 무엇입니까?',
      '책임자를 지정할지 고민입니다.',
      '결재 규칙 책임자가 누구인지 알려 주세요.',
      '결재 규칙 책임자를 정하는 방법이 무엇입니까?',
      // FULL_AUTO: 키워드 2개 — '검토를 전면 생략'·'전부 자동 승인'
      '검토를 전면 생략하는 기준이 무엇입니까?',
      '검토를 전면 생략할지 고민입니다.',
      '전부 자동 승인하는 기준이 무엇입니까?',
      '전부 자동 승인하는 방법을 설명해 주십시오.',
    ];
    for (const text of negativeQuestions) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
  });

  // 혼합 문장: 질문 뒤에 다른 조건/같은 조건의 청유가 이어지면 청유한 쪽만 본다.
  it('질문과 청유가 섞인 문장은 질문은 무시하고 청유한 조건만 제안한다(PR #13 Codex 5차 검토)', () => {
    expect(
      proposeFromText(scenario, '금액 한도를 정하는 기준이 무엇입니까? 승인 사유를 기록합시다.'),
    ).toEqual(['LOG']);
    expect(
      proposeFromText(scenario, '금액 한도를 정하는 기준이 무엇입니까? 금액 한도를 정합시다.'),
    ).toEqual(['LIMIT']);
    // 부정 의문("…하지 않는 이유가 무엇입니까?") 뒤의 같은 조건 청유 — 의문 판정이
    // 부정 판정보다 먼저이므로 '않'이 조건 전체를 거부하지 않는다.
    expect(
      proposeFromText(
        scenario,
        '금액 한도를 정하지 않는 이유가 무엇입니까? 금액 한도를 정합시다.',
      ),
    ).toEqual(['LIMIT']);
    // 문장 부호 없이 "청유 + 의문"을 이어 써도 약한 문장 경계(격식 청유 종결+공백)로
    // 갈라 첫 문장(청유)만 본다.
    expect(proposeFromText(scenario, '금액 한도를 정합시다 기준은 무엇입니까')).toEqual([
      'LIMIT',
    ]);
  });

  // 회귀: 긍정 언급이 의문 규칙 때문에 사라지면 안 된다.
  it('의문 규칙을 추가해도 긍정 언급은 그대로 제안한다(PR #13 Codex 5차 검토 회귀)', () => {
    expect(proposeFromText(scenario, '어떤 경우에도 금액 한도를 정합시다.')).toEqual([
      'LIMIT',
    ]);
    expect(proposeFromText(scenario, '설명드리자면 금액 한도를 정해야 합니다.')).toEqual([
      'LIMIT',
    ]);
    expect(proposeFromText(scenario, '위험하니까 금액 한도를 정합시다.')).toEqual(['LIMIT']);
    // LOG 키워드('승인 사유를 기록')의 부분 문자열 '기록'을 포함한 '일지'(명사)가
    // 간접 의문 표지 'ㄹ받침+지'와 겹치지 않는지도 확인한다 — rule3는 '일지'를 제외한다.
    expect(proposeFromText(scenario, '승인 사유를 기록한 일지를 남깁시다.')).toEqual(['LOG']);
  });

  // 5차 수정 내부 검토: 간접 의문 표지·정보 요청 서술어를 문장 끝까지 보면 연결어미로
  // 이어진 뒤 절의 무관한 '질문'·'설명'·'-인지'가 앞 절의 분명한 청유를 지웠다. 키워드가
  // 든 절이 닫힌 뒤는 보지 않는다. 반면 키워드가 관형절로 이어진 진짜 질문은 그대로 거른다.
  it('연결어미로 이어진 뒤 절의 질문·설명 어구는 앞 절의 청유를 지우지 않는다', () => {
    const affirmedThenUnrelated = [
      '금액 한도를 정해서 설명자료를 준비합시다.',
      '금액 한도를 정하고 질문은 나중에 받겠습니다.',
      '금액 한도를 정하되 궁금한 점은 따로 묻겠습니다.',
      '금액 한도를 정하고 다음 안건이 무엇인지 봅시다.',
      '금액 한도를 정한 뒤 담당자가 누구인지 확인합시다.',
    ];
    for (const text of affirmedThenUnrelated) {
      expect(proposeFromText(scenario, text), text).toEqual(['LIMIT']);
    }
    // 앞 절은 청유(LIMIT), 뒤 절은 관형절 질문(LOG 아님).
    expect(
      proposeFromText(scenario, '금액 한도를 정하며 승인 사유를 기록하는 양식도 설명해 주십시오.'),
    ).toEqual(['LIMIT']);
    // 조사 '에서'는 절 끝이 아니다 — 관형절 질문은 끝까지 봐서 거른다.
    expect(
      proposeFromText(scenario, '금액 한도를 정하는 기준이 어디에서 나오는지 알려 주세요.'),
    ).toEqual([]);
    // 의도·인용의 '-려고/-자고'와 '-고 보니'는 아직 묻는 중이라 절 끝이 아니다.
    for (const text of [
      '금액 한도를 정하려고 하는데 기준이 무엇인지 궁금합니다.',
      '금액 한도를 정하고 보니 기준이 무엇인지 모르겠습니다.',
      '금액 한도를 정하자고 하는데 어떻게 정하는지 알려 주세요.',
    ]) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
    // '-고 나서'는 끝난 일이라 절 끝이다.
    expect(
      proposeFromText(scenario, '금액 한도를 정하고 나서 질문을 받겠습니다.'),
    ).toEqual(['LIMIT']);
  });

  // PR #13 Codex 6차 검토 P1: 의문사 + 해요체 규칙이 '예요·에요·데요'만 열거해 가장 흔한
  // '-해요/-어요/-아요'가 빠졌다 — 물음표 없는 "…어떻게 정해요"가 LOG로 잡혔다. '-요'
  // 종결 전체를 받되 약속('-ㄹ게요')·요청('-세요')은 질문이 아니다.
  it('의문사 + 해요체(-해요/-어요/-아요) 문장은 물음표가 없어도 제안하지 않는다(PR #13 Codex 6차 검토)', () => {
    for (const text of [
      '승인 사유를 기록하는 방식은 어떻게 정해요',
      '금액 한도는 누가 정해요',
      '표본 재검토를 하는 주기는 얼마나 돼요',
      '결재 규칙 책임자를 왜 따로 둬요',
    ]) {
      expect(proposeFromText(scenario, text), text).toEqual([]);
    }
    // 의문사 없는 해요체 평서, 부정칭, 약속형은 그대로 제안한다.
    for (const text of [
      '금액 한도를 정해요.',
      '어떤 기준이든 금액 한도를 정해요.',
      '누가 뭐라 해도 금액 한도를 정할게요.',
    ]) {
      expect(proposeFromText(scenario, text), text).toEqual(['LIMIT']);
    }
  });
});

describe('findConflicts', () => {
  it('REVIEW·FULL_AUTO가 함께 있을 때만 상충쌍을 반환한다', () => {
    expect(findConflicts(scenario, ['REVIEW', 'FULL_AUTO', 'LIMIT'])).toEqual([
      ['REVIEW', 'FULL_AUTO'],
    ]);
    expect(findConflicts(scenario, ['REVIEW', 'LIMIT'])).toEqual([]);
  });
});
