// T138: 서버 roleLenses.opening(live 처음 입장 지시의 출처)과 화면 콘텐츠 initialOpinions.openingStance는 같은 값이어야 한다.
// 처음 입장을 바꿀 때(예: 반대 임원 교체) 콘텐츠와 서버 사본 중 한쪽만 고치는 실수를 막는다.
import { describe, expect, it } from 'vitest';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import { getScenarioMaterials } from '../../server/scenario-data';
import { EXEC_ROLE_IDS } from '../../server/validate';

describe.each([aiApprovalScenario, experienceFirstScenario])('$id 처음 입장 일치', (scenario) => {
  it('roleLenses.opening이 initialOpinions.openingStance와 같고, 1 찬성·1 반대·2 고민 중이다', () => {
    const materials = getScenarioMaterials(scenario.id);
    const counts = { FOR: 0, AGAINST: 0, UNDECIDED: 0 };
    for (const roleId of EXEC_ROLE_IDS) {
      const fromContent = scenario.initialOpinions.find((o) => o.memberId === roleId)?.openingStance;
      expect(materials?.roleLenses?.[roleId].opening, roleId).toBe(fromContent);
      if (fromContent) counts[fromContent] += 1;
    }
    expect(counts).toEqual({ FOR: 1, AGAINST: 1, UNDECIDED: 2 });
    expect(scenario.initialOpinions.find((o) => o.memberId === 'CISO')?.openingStance).toBe('AGAINST');
    expect(scenario.initialOpinions.find((o) => o.memberId === 'CFO')?.openingStance).toBe('UNDECIDED');
  });
});
