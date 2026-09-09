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
