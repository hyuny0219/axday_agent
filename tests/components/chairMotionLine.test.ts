import { describe, expect, it } from 'vitest';
import { chairMotionLine } from '../../src/components/chairMotionLine';
import { aiApprovalScenario } from '../../src/content/scenarios/aiApproval';

const scenario = aiApprovalScenario;

describe('chairMotionLine', () => {
  it('조건이 없으면 "원안 그대로 표결에 부칩니다"(입장과 무관)', () => {
    expect(chairMotionLine(scenario, [])).toBe('원안 그대로 표결에 부칩니다');
    expect(chairMotionLine(scenario, [], 'AGAINST')).toBe('원안 그대로 표결에 부칩니다');
  });

  it('입장을 생략하거나 찬성이면 기존 "조건을 달아 표결에 부칩니다" 문장', () => {
    expect(chairMotionLine(scenario, ['LIMIT'])).toBe('결재 금액 한도 조건을 달아 표결에 부칩니다');
    expect(chairMotionLine(scenario, ['LIMIT'], 'FOR')).toBe('결재 금액 한도 조건을 달아 표결에 부칩니다');
  });

  // T92: 반대 입장 + 조건 있음(조건부 반대)이면 "이사님의 반대 의견과 요구 조건"으로.
  it('반대 입장 + 조건 1개면 "이사님의 반대 의견과 요구 조건(라벨)을 달아"', () => {
    expect(chairMotionLine(scenario, ['LIMIT'], 'AGAINST')).toBe(
      '이사님의 반대 의견과 요구 조건(결재 금액 한도)을 달아 표결에 부칩니다',
    );
  });

  it('반대 입장 + 조건 2개 이상이면 개수로 말한다', () => {
    expect(chairMotionLine(scenario, ['LIMIT', 'LOG'], 'AGAINST')).toBe(
      '이사님의 반대 의견과 요구 조건 2개를 달아 표결에 부칩니다',
    );
  });
});
