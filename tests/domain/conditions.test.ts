import { describe, expect, it } from 'vitest';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import {
  confirmConditions,
  findConflicts,
  proposeFromPhrases,
  proposeFromText,
} from '../../src/domain/conditions';

const scenario = anonBoardScenario;

describe('proposeFromPhrases', () => {
  it('선택한 문구에 연결된 조건 ID를 중복 없이 모은다', () => {
    expect(proposeFromPhrases(scenario, ['P1', 'P4'])).toEqual(['PILOT', 'MEASURE']);
  });

  it('조건이 없는 문구(요청형)는 제안하지 않는다', () => {
    expect(proposeFromPhrases(scenario, ['P6'])).toEqual([]);
  });

  it('같은 조건에 연결된 문구를 여러 개 골라도 조건은 한 번만 나온다', () => {
    expect(proposeFromPhrases(scenario, ['P1', 'P1'])).toEqual(['PILOT']);
  });
});

describe('proposeFromText', () => {
  it('문서 예: "검토 없이 공유"에서 REVIEW를 제안하지 않는다', () => {
    const proposed = proposeFromText(scenario, '검토 없이 공유합시다.');
    expect(proposed).not.toContain('SCREEN');
  });

  it('부정어 없이 조건 라벨 키워드를 언급하면 제안한다', () => {
    const proposed = proposeFromText(
      scenario,
      '게시 전 검수 절차를 두고 시작합시다.',
    );
    expect(proposed).toContain('SCREEN');
  });

  it('조건과 무관한 문장은 아무 조건도 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('"생략" 근처의 언급도 부정문으로 보고 제안하지 않는다', () => {
    const proposed = proposeFromText(scenario, '권한 확인은 생략하고 진행합시다.');
    expect(proposed).not.toContain('TRACE');
  });

  it('P1~P5 각 문구 문장은 정확히 자기 조건 하나만 제안한다', () => {
    expect(proposeFromText(scenario, '한 게시판에서 먼저 시범 운영합시다.')).toEqual([
      'PILOT',
    ]);
    expect(
      proposeFromText(scenario, '게시 전 검수 절차를 두고 시작합시다.'),
    ).toEqual(['SCREEN']);
    expect(
      proposeFromText(scenario, '문제가 생기면 작성자를 확인할 수 있게 해 둡시다.'),
    ).toEqual(['TRACE']);
    expect(proposeFromText(scenario, '운영 효과를 측정한 뒤 전사로 넓힙시다.')).toEqual([
      'MEASURE',
    ]);
    expect(
      proposeFromText(scenario, '작성자를 누구도 추적할 수 없는 완전 익명으로 합시다.'),
    ).toEqual(['ANON_FULL']);
  });

  it('P6 문장과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(
      proposeFromText(scenario, '아직 확인할 것이 많습니다. 검증 자료를 더 요청합시다.'),
    ).toEqual([]);
    expect(proposeFromText(scenario, '확인 부탁드립니다.')).toEqual([]);
  });

  it('"작성자를 누구도 추적할 수 없는 완전 익명으로 합시다."는 ANON_FULL만 제안한다', () => {
    expect(
      proposeFromText(scenario, '작성자를 누구도 추적할 수 없는 완전 익명으로 합시다.'),
    ).toEqual(['ANON_FULL']);
  });

  // 후속 빠른 답은 선택 즉시 초안(textValue)이 되어 proposeFromText()를 거친다
  // (ReactionsScreen). 그래서 문구 자체가 키워드에 걸리면 proposeConditionId가 null인
  // 답에서도 조건이 제안·자동 승인된다 — "신고가 들어온 뒤에 처리해도 충분합니다."가
  // TRACE 키워드 '신고가 들어온'에 걸려 추적 조건이 몰래 확정됐다(PR #10 Codex 5차 검토 P1).
  it('후속 빠른 답 문구는 각각 proposeConditionId와 정확히 같은 조건만 제안한다', () => {
    expect(scenario.followUp.options.length).toBeGreaterThanOrEqual(3);
    for (const option of scenario.followUp.options) {
      const expected = option.proposeConditionId ? [option.proposeConditionId] : [];
      expect(proposeFromText(scenario, option.text), option.text).toEqual(expected);
    }
  });

  // 후속 직접 답변 "작성자를 확인하지 않겠습니다."가 TRACE 키워드 '작성자를 확인'에 걸려,
  // 참가자가 추적을 거부했는데도 ReactionsScreen이 새 제안을 자동 승인해 최종안에 "문제
  // 발생 시 추적 가능"이 들어가고 표결까지 바뀌었다(PR #10 Codex 12차 검토 P1). 부정
  // 표지는 없이·생략·말고만이 아니다.
  it('"-지 않-"·"없-"·"안 -"·"못 하-"·"반대"로 부정한 언급은 제안하지 않는다', () => {
    const negated = [
      '작성자를 확인하지 않겠습니다.',
      '문제가 생겨도 작성자를 확인하지는 않을 것입니다.',
      '작성자를 확인할 수 있게 하는 것에는 반대합니다.',
      '추적 가능 조건은 없어야 합니다.',
      '추적 가능하게 안 하겠습니다.',
      '작성자를 확인 못 하게 합시다.',
    ];
    for (const text of negated) {
      expect(proposeFromText(scenario, text), text).not.toContain('TRACE');
    }
  });

  // "효과를 측정하지 않고 바로 확대합시다."는 '효과'·'측정'이 부정돼도 '확대'가 긍정으로 남아
  // MEASURE가 제안·자동 승인됐다(PR #10 Codex 16차 검토 P1). 한 조건의 키워드가 하나라도
  // 부정되면 그 조건은 제안하지 않는다.
  it('같은 조건의 키워드 하나가 부정되면 다른 키워드가 긍정이어도 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '효과를 측정하지 않고 바로 확대합시다.')).toEqual([]);
    expect(proposeFromText(scenario, '측정 없이 전사로 넓힙시다.')).toEqual([]);
    // 쉼표로 절이 나뉘면 앞 절의 PILOT은 남고 뒤 절의 MEASURE만 빠진다
    expect(
      proposeFromText(scenario, '한 게시판에서 시범 운영하되, 효과 측정은 하지 않고 확대합시다.'),
    ).toEqual(['PILOT']);
    // 부정 없는 P4 문구는 그대로 MEASURE
    expect(proposeFromText(scenario, '운영 효과를 측정한 뒤 전사로 넓힙시다.')).toEqual([
      'MEASURE',
    ]);
  });

  // "효과 측정은 빼고 바로 확대합시다."가 MEASURE로 자동 승인됐다(PR #10 Codex 17차 검토 P1).
  // 조건을 명시적으로 배제하는 표현도 부정이다.
  it('"빼고"·"제외"·"아니"·"금지"·"-지 말-"로 배제한 조건은 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '효과 측정은 빼고 바로 확대합시다.')).toEqual([]);
    expect(proposeFromText(scenario, '게시 전 검수는 제외하고 시범만 합시다.')).toEqual(['PILOT']);
    expect(proposeFromText(scenario, '추적 가능은 아니고 완전 익명으로 합시다.')).toEqual([
      'ANON_FULL',
    ]);
    expect(proposeFromText(scenario, '작성자를 확인하는 것은 금지합시다.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인할 수 있게 하지 말아 주십시오.')).toEqual([]);
  });

  // '뿐 아니라'는 배제가 아니라 긍정 병렬인데 '아니' 표지가 부분 문자열로 걸려 "효과 측정뿐 아니라
  // 확대도 합시다."에서 MEASURE가 사라졌다(PR #10 Codex 30차 검토 P1). 대조 부정("가 아니라")은
  // 그대로 부정이다.
  it('"뿐 아니라"·"뿐만 아니라"의 긍정 병렬은 부정이 아니고, "가 아니라"의 대조 부정은 그대로다', () => {
    expect(proposeFromText(scenario, '효과 측정뿐 아니라 확대도 합시다.')).toEqual(['MEASURE']);
    expect(proposeFromText(scenario, '게시 전 검수뿐만 아니라 시범 운영도 합시다.')).toEqual([
      'PILOT',
      'SCREEN',
    ]);
    expect(proposeFromText(scenario, '효과 측정뿐아니라 확대도 합시다.')).toEqual(['MEASURE']);
    // 조사 '이'가 붙은 형("뿐만이 아니라"·"뿐이 아니라")도 긍정 병렬이다(31차 P1).
    expect(proposeFromText(scenario, '효과 측정뿐만이 아니라 확대도 합시다.')).toEqual(['MEASURE']);
    expect(proposeFromText(scenario, '게시 전 검수뿐이 아니라 시범 운영도 합시다.')).toEqual([
      'PILOT',
      'SCREEN',
    ]);
    expect(proposeFromText(scenario, '효과 측정뿐만이아니라 확대도 합시다.')).toEqual(['MEASURE']);
    // 보조사 '은'이 붙은 형("뿐만은 아니라/아니고")도 긍정 병렬이다(32차 P1).
    expect(proposeFromText(scenario, '효과 측정뿐만은 아니라 확대도 합시다.')).toEqual(['MEASURE']);
    expect(proposeFromText(scenario, '게시 전 검수뿐만은 아니고 시범 운영도 합시다.')).toEqual([
      'PILOT',
      'SCREEN',
    ]);
    // '뿐' 없는 "는 아니고"는 대조 부정이다.
    expect(proposeFromText(scenario, '게시 전 검수는 아니고 효과 측정을 합시다.')).toEqual(['MEASURE']);
    expect(proposeFromText(scenario, '게시 전 검수가 아니라 효과 측정을 합시다.')).toEqual(['MEASURE']);
    expect(proposeFromText(scenario, '추적 가능은 아니고 완전 익명으로 합시다.')).toEqual([
      'ANON_FULL',
    ]);
  });

  // "게시 전 검수 안하고 시범만 합시다."의 붙여 쓴 '안하고'가 '안 '에 걸리지 않아 SCREEN이 자동
  // 승인됐다(PR #10 Codex 18차 검토 P1). '안'은 어절 시작에서만 부정이다 — "불안하면"은 아니다.
  it('붙여 쓴 "안하-"·"안함"·"안되-"도 부정이고, "불안하-"의 "안하"는 부정이 아니다', () => {
    expect(proposeFromText(scenario, '게시 전 검수 안하고 시범만 합시다.')).toEqual(['PILOT']);
    expect(proposeFromText(scenario, '게시 전 검수안하고 시범만 합시다.')).toEqual(['PILOT']);
    expect(proposeFromText(scenario, '효과 측정은 안함. 바로 확대합시다.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인 안 해도 됩니다.')).toEqual([]);
    expect(proposeFromText(scenario, '추적 가능 상태가 안되면 곤란합니다.')).toEqual([]);
    // 활용형 안할·안해·안했·안한·안됐도 부정이다(22차)
    expect(proposeFromText(scenario, '게시 전 검수는 안할게요.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인 안해요.')).toEqual([]);
    expect(proposeFromText(scenario, '효과 측정은 안했으면 합니다.')).toEqual([]);
    expect(proposeFromText(scenario, '추적 가능하게 안한다고 합시다.')).toEqual([]);
    expect(proposeFromText(scenario, '완전 익명은 안됐으면 합니다.')).toEqual([]);
    // 조사와 '안'을 붙여 써도 부정이다(23차) — "검수는안할게요"·"측정은안했"·"확인도안하고"
    expect(proposeFromText(scenario, '게시 전 검수는안할게요.')).toEqual([]);
    expect(proposeFromText(scenario, '효과 측정은안했으면 합니다.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인도안하고 넘어갑시다.')).toEqual([]);
    // 열거되지 않은 조사(조차·마저·부터·까지·밖에) 뒤에 붙여 써도 부정이다(24차)
    expect(proposeFromText(scenario, '게시 전 검수조차안할게요.')).toEqual([]);
    expect(proposeFromText(scenario, '효과 측정마저안했으면 합니다.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인부터안하고 넘어갑시다.')).toEqual([]);
    // 조사가 아닌 글자 뒤의 '안하-'(제안·고안·감안·불안·미안·보안·편안)는 부정이 아니다(24·25차)
    expect(proposeFromText(scenario, '게시 전 검수를 제안합니다.')).toEqual(['SCREEN']);
    expect(proposeFromText(scenario, '한 게시판에서 시범 운영을 고안했습니다.')).toEqual(['PILOT']);
    expect(proposeFromText(scenario, '운영 효과 측정을 감안하면 확대할 수 있습니다.')).toEqual([
      'MEASURE',
    ]);
    expect(proposeFromText(scenario, '게시 전 검수가 미안하지만 필요합니다.')).toEqual(['SCREEN']);
    expect(proposeFromText(scenario, '작성자를 확인할 수 있게 보안해야 합니다.')).toEqual(['TRACE']);
    expect(proposeFromText(scenario, '한 게시판에서 시범 운영하면 편안하게 볼 수 있습니다.')).toEqual([
      'PILOT',
    ]);
    expect(proposeFromText(scenario, '시범 운영이 불안하면 검수를 넣읍시다.')).toEqual([
      'PILOT',
      'SCREEN',
    ]);
  });

  // "완전 익명으로 하지 맙시다."의 축약 청유형 '-지 맙-'이 '지 말'에 걸리지 않아 ANON_FULL이 자동
  // 승인됐다(PR #10 Codex 20차 검토 P1). '-지 마-'·'-지 맙-' 활용 전체가 부정이다.
  it('"-지 맙시다"·"-지 마세요"·"-지 마십시오"도 부정이다 — 붙여 써도 같다(21차)', () => {
    expect(proposeFromText(scenario, '완전 익명으로 하지 맙시다.')).toEqual([]);
    expect(proposeFromText(scenario, '완전 익명으로 하지맙시다.')).toEqual([]);
    expect(proposeFromText(scenario, '게시 전 검수는 하지마세요.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인할 수 있게 하지말아 주십시오.')).toEqual([]);
    expect(proposeFromText(scenario, '게시 전 검수는 하지 마세요.')).toEqual([]);
    expect(proposeFromText(scenario, '작성자를 확인할 수 있게 하지 마십시오.')).toEqual([]);
    expect(proposeFromText(scenario, '완전 익명은 하지 말고 시범만 합시다.')).toEqual(['PILOT']);
  });

  it('부정 표지는 같은 절 안에서만 본다 — 쉼표·마침표 뒤의 부정어는 앞 언급을 지우지 않는다', () => {
    expect(
      proposeFromText(scenario, '작성자를 확인할 수 있게 합시다. 다만 완전 익명은 반대합니다.'),
    ).toEqual(['TRACE']);
    expect(
      proposeFromText(scenario, '한 게시판에서 시범 운영하되, 게시 전 검수는 두지 않겠습니다.'),
    ).toEqual(['PILOT']);
  });

  it('부정 표지를 넓혀도 P1~P5 문구와 후속 빠른 답의 제안은 그대로다', () => {
    expect(proposeFromText(scenario, '작성자를 누구도 확인 못 하게 합시다.')).toEqual([
      'ANON_FULL',
    ]);
    expect(
      proposeFromText(scenario, '작성자를 누구도 확인할 수 없는 완전 익명으로 합시다.'),
    ).toEqual(['ANON_FULL']);
  });

  it('"검토 없이 공유"는 REVIEW를 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '검토 없이 공유')).not.toContain('SCREEN');
  });
});

describe('findConflicts', () => {
  it('선택 집합 안에서 실제로 겹치는 충돌쌍만 반환한다', () => {
    expect(findConflicts(scenario, ['TRACE', 'ANON_FULL', 'PILOT'])).toEqual([
      ['TRACE', 'ANON_FULL'],
    ]);
  });

  it('충돌쌍의 한쪽만 있으면 반환하지 않는다', () => {
    expect(findConflicts(scenario, ['TRACE', 'PILOT'])).toEqual([]);
  });
});

describe('confirmConditions', () => {
  it('제안된 조건 중 accepted에 있는 것만 confirmed가 된다', () => {
    const result = confirmConditions(scenario, ['PILOT', 'MEASURE'], ['PILOT']);
    expect(result).toEqual([
      { id: 'PILOT', status: 'confirmed' },
      { id: 'MEASURE', status: 'proposed' },
    ]);
  });

  it('충돌쌍을 동시에 accepted로 넘기면 둘 다 확정을 거부한다', () => {
    const result = confirmConditions(
      scenario,
      ['TRACE', 'ANON_FULL'],
      ['TRACE', 'ANON_FULL'],
    );
    expect(result).toEqual([
      { id: 'TRACE', status: 'proposed' },
      { id: 'ANON_FULL', status: 'proposed' },
    ]);
  });

  it('충돌하지 않는 조건은 정상적으로 confirmed가 된다', () => {
    const result = confirmConditions(scenario, ['TRACE'], ['TRACE']);
    expect(result).toEqual([{ id: 'TRACE', status: 'confirmed' }]);
  });
});
