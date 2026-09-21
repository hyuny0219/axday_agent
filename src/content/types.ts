// 시나리오 데이터 스키마. 규칙은 코드가 아니라 데이터로 표현한다 (DEV_PLAN.md 4절).

export type ExecMemberId = 'CEO' | 'CFO' | 'CAIO' | 'CISO';

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
  /** "이 자료가 말하는 것" 한 줄(v0.9). 새 수치·확정 사실을 만들지 않는다. */
  insight: string;
  /** 이 자료와 관련된 임원(브리핑 카드에 아바타로 표시). */
  relatedMemberIds: ExecMemberId[];
}

export interface Motion {
  id: string;
  text: string;
}

export interface BriefingSummary {
  text: string;
  evidenceIds: string[];
}

/** 의장 브리핑 3문장(v0.9): 상황 → 결정 질문 → 참가자 역할. */
export interface ChairBriefing {
  situation: string;
  question: string;
  role: string;
}

/** 핵심 쟁점 카드(v0.9). 기존 briefingSummary 문장을 쟁점 단위로 나눈 것이며
 * briefingSummary는 자동 정리 기록(SUMMARY_SHOWN)을 위해 그대로 유지한다. */
export interface BriefingIssue {
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
  /** 후속 질문을 던지는 임원(v0.9: CAIO, docs/SCENARIO_AI_ASSISTANT.md "첫 반응 및 후속 질문"). */
  askedBy: ExecMemberId;
  options: FollowUpOption[];
}

export interface VoteRule {
  when: Predicate;
  vote: Vote;
}

/** "6개월 뒤" 에필로그(v1.0 T47). 결과 화면 왼쪽 열, '체험용 가상 전망' 배지와 함께
 * 쓴다. 수치·비율·금액 없이 상태만 묘사한다(SCENARIO_AI_ASSISTANT.md). */
/** "6개월 뒤" 에필로그 문구(v1.0 T47). pass는 이사회가 붙인 조건이 최종안에 반영된
 * 가결(도장 "조건부 가결"과 같은 기준), passOriginal은 반영 조건 없이 원안이 그대로
 * 가결된 경우 — live에서는 조건 없는 원안도 임원 모델 표로 PASS가 될 수 있으므로
 * "붙인 조건이 점검표가 되었다"는 문구를 쓰면 안 된다(PR #8 Codex 2차 검토). */
export interface SixMonthsLaterCopy {
  pass: string;
  passOriginal: string;
  hold: string;
  reject: string;
}

export interface ResultCopy {
  pass: string;
  hold: string;
  reject: string;
  sixMonthsLater: SixMonthsLaterCopy;
}

/** 안건 사건화 문구(v1.0 T47). SELECT 카드와 BRIEFING 상단 eyebrow에 쓴다. 자료
 * E1~E4에 있는 사실만 쓰고 새 수치를 만들지 않는다. */
export interface Incident {
  caseLabel: string;
  headline: string;
  hook: string;
}

export type ScenarioStatus = 'active' | 'preparing';

export interface Scenario {
  id: string;
  title: string;
  selectLine: string;
  subtitle: string;
  incident: Incident;
  originalMotion: Motion;
  evidence: EvidenceCard[];
  briefingSummary: BriefingSummary;
  chairBriefing: ChairBriefing;
  briefingIssues: BriefingIssue[];
  /** 브리핑 시점에 읽기 전용으로 미리 보여줄 조건 ID(v0.9). `conditions`에는 위험
   * 대안(OPEN_ALL)까지 포함되지만 이 목록에는 두지 않는다 — 화면은 이 필드만 읽고
   * 조건 목록을 하드코딩하지 않는다. */
  previewConditionIds: string[];
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
