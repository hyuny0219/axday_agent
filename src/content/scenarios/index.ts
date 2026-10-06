// 안건 레지스트리(T78, 2026-10-02 사용자 확정 — 안건 두 개 교체). 활성 카드는
// ① AI 에이전트 결재권(aiApproval, 사건 01)과 ② 데이터보다 경험(experienceFirst, 사건
// 02) 둘 다이며, 시안(S1_Select.html)의 카드 2장이 모두 선택 가능하다. T70의 "준비
// 중" 카드 분기(status: 'preparing')는 SelectScreen·Scenario 타입에 그대로 남겨
// 두지만 지금은 두 카드 모두 active라 쓰이지 않는다.
// 이전 안건들(aiAssistant.ts·anonBoard.ts)은 되돌릴 수 있게 파일로 남겨 두되
// 레지스트리에서는 뺀다(T53과 같은 처리).

import type { Scenario } from '../types';
import { aiApprovalScenario } from './aiApproval';
import { experienceFirstScenario } from './experienceFirst';
import { anonBoardScenario } from './anonBoard';

export const scenarios: Scenario[] = [aiApprovalScenario, experienceFirstScenario];

export { aiApprovalScenario, experienceFirstScenario, anonBoardScenario };
