import { describe, expect, it } from 'vitest';
import { aiAssistantScenario } from '../../src/content/scenarios/aiAssistant';
import {
  confirmConditions,
  findConflicts,
  proposeFromPhrases,
  proposeFromText,
} from '../../src/domain/conditions';

const scenario = aiAssistantScenario;

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
    expect(proposed).not.toContain('REVIEW');
  });

  it('부정어 없이 조건 라벨 키워드를 언급하면 제안한다', () => {
    const proposed = proposeFromText(
      scenario,
      '출처와 기준일을 표시하고 담당자가 검토한 뒤 공유합시다.',
    );
    expect(proposed).toContain('REVIEW');
  });

  it('조건과 무관한 문장은 아무 조건도 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '오늘 점심 메뉴는 무엇입니까?')).toEqual([]);
  });

  it('"생략" 근처의 언급도 부정문으로 보고 제안하지 않는다', () => {
    const proposed = proposeFromText(scenario, '권한 확인은 생략하고 진행합시다.');
    expect(proposed).not.toContain('ACCESS');
  });

  it('P1~P5 각 문구 문장은 정확히 자기 조건 하나만 제안한다', () => {
    expect(proposeFromText(scenario, '주간 보고 초안부터 작은 범위로 시작합시다.')).toEqual([
      'PILOT',
    ]);
    expect(
      proposeFromText(scenario, '출처와 기준일을 표시하고 담당자가 검토한 뒤 공유합시다.'),
    ).toEqual(['REVIEW']);
    expect(
      proposeFromText(scenario, '사용자 권한과 공유 범위를 확인한 자료만 사용합시다.'),
    ).toEqual(['ACCESS']);
    expect(proposeFromText(scenario, '준비시간과 수정량을 확인한 뒤 확대합시다.')).toEqual([
      'MEASURE',
    ]);
    expect(
      proposeFromText(scenario, '권한 검토 없이 모든 부서 자료를 바로 연결합시다.'),
    ).toEqual(['OPEN_ALL']);
  });

  it('P6 문장과 조건 무관 문장은 빈 배열을 제안한다', () => {
    expect(
      proposeFromText(scenario, '아직 확인할 것이 많습니다. 검증 자료를 더 요청합시다.'),
    ).toEqual([]);
    expect(proposeFromText(scenario, '확인 부탁드립니다.')).toEqual([]);
  });

  it('"권한 검토 없이 모든 부서 자료를 바로 연결합시다."는 OPEN_ALL만 제안한다', () => {
    expect(
      proposeFromText(scenario, '권한 검토 없이 모든 부서 자료를 바로 연결합시다.'),
    ).toEqual(['OPEN_ALL']);
  });

  it('"검토 없이 공유"는 REVIEW를 제안하지 않는다', () => {
    expect(proposeFromText(scenario, '검토 없이 공유')).not.toContain('REVIEW');
  });
});

describe('findConflicts', () => {
  it('선택 집합 안에서 실제로 겹치는 충돌쌍만 반환한다', () => {
    expect(findConflicts(scenario, ['ACCESS', 'OPEN_ALL', 'PILOT'])).toEqual([
      ['ACCESS', 'OPEN_ALL'],
    ]);
  });

  it('충돌쌍의 한쪽만 있으면 반환하지 않는다', () => {
    expect(findConflicts(scenario, ['ACCESS', 'PILOT'])).toEqual([]);
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
      ['ACCESS', 'OPEN_ALL'],
      ['ACCESS', 'OPEN_ALL'],
    );
    expect(result).toEqual([
      { id: 'ACCESS', status: 'proposed' },
      { id: 'OPEN_ALL', status: 'proposed' },
    ]);
  });

  it('충돌하지 않는 조건은 정상적으로 confirmed가 된다', () => {
    const result = confirmConditions(scenario, ['ACCESS'], ['ACCESS']);
    expect(result).toEqual([{ id: 'ACCESS', status: 'confirmed' }]);
  });
});
