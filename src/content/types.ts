// 시나리오 데이터 스키마. 규칙은 코드가 아니라 데이터로 표현한다 (DEV_PLAN.md 4절).

export type ExecMemberId = 'CEO' | 'CFO_CAIO' | 'CIO' | 'CISO';

export type Vote = 'YES' | 'NO' | 'HOLD' | 'UNCAST';

export type Predicate =
  | { has: string }
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | { mode: string }
  | { always: true };

export interface EvidenceCard {
  id: string;
  title: string;
  content: string;
}

export interface Motion {
  id: string;
  text: string;
}

export interface BriefingSummary {
  text: string;
  evidenceIds: string[];
}

export interface InitialOpinion {
  memberId: ExecMemberId;
  text: string;
  evidenceIds: string[];
}

export interface Phrase {
  id: string;
  text: string;
  conditionId: string | null;
  tag?: string;
}

export interface Condition {
  id: string;
  label: string;
  /** 자유 입력 텍스트에서 이 조건을 제안할 때 찾는 명시 키워드. 라벨·문구 텍스트에서
   * 자동 파생하지 않고 시나리오 데이터에 직접 적는다(CLAUDE_IMPLEMENTATION.md 4장). */
  keywords: string[];
}

export type ConflictPair = [string, string];

export interface Reaction {
  conditionId: string | 'none';
  memberId: ExecMemberId;
  text: string;
}

export interface FollowUpOption {
  text: string;
  proposeConditionId: string | null;
  keepPrevious?: boolean;
}

export interface FollowUp {
  question: string;
  options: FollowUpOption[];
}

export interface VoteRule {
  when: Predicate;
  vote: Vote;
}

export interface ResultCopy {
  pass: string;
  hold: string;
  reject: string;
}

export type ScenarioStatus = 'active' | 'preparing';

export interface Scenario {
  id: string;
  title: string;
  selectLine: string;
  subtitle: string;
  originalMotion: Motion;
  evidence: EvidenceCard[];
  briefingSummary: BriefingSummary;
  chairLine: string;
  initialOpinions: InitialOpinion[];
  phrases: Phrase[];
  conditions: Condition[];
  conflicts: ConflictPair[];
  reactions: Reaction[];
  followUp: FollowUp;
  voteRules: Record<ExecMemberId, VoteRule[]>;
  resultCopy: ResultCopy;
  remainingTasks: string[];
  baseConditionIds: string[];
  status: ScenarioStatus;
}
