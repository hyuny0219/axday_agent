// 표결 엔진이 쓰는 데이터 형태. CLAUDE_IMPLEMENTATION.md 6장 인터페이스를 그대로 옮기되
// 이 카드(T04)에서는 표결 평가·집계에 필요한 타입만 추가한다.

import type { ExecMemberId, Vote } from '../content/types';

export type MemberId = ExecMemberId | 'PARTICIPANT';

export interface Motion {
  id: string;
  scenarioId: string;
  kind: 'original' | 'amended';
  conditionIds: string[];
  baseConditionIds: string[];
  effectiveConditionIds: string[];
  executionMode: string;
  frozenAt: number;
}

export interface Ballot {
  memberId: MemberId;
  motionId: string;
  vote: Vote;
  confirmedAt: number | null;
}
