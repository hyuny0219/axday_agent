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
