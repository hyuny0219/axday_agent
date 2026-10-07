// 시나리오 데이터 스키마. 규칙은 코드가 아니라 데이터로 표현한다 (DEV_PLAN.md 4절).

export type ExecMemberId = 'CEO' | 'CFO' | 'CAIO' | 'CISO';

export type Vote = 'YES' | 'NO' | 'UNCAST';

export type Predicate =
  | { has: string }
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | { mode: string }
  /** 참가자가 이번 표결까지 가장 최근에 밝힌 입장(T92, 사용자 지적 "AI 임원들이 찬성
   * 쪽으로 몰고 가는 경향"). null은 "입장을 고르지 않음". */
  | { participantStance: 'FOR' | 'AGAINST' | null }
  | { always: true };

export interface EvidenceCard {
  id: string;
  title: string;
  content: string;
  /** 자료 해석 한 줄(v0.9). 새 수치·확정 사실을 만들지 않는다. 화면에서는 라벨 없이 자료명 아래에 바로 보여준다(T52). */
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

/** 미정 항목 한 줄(T84). `resolvedBy`가 있으면 그 조건이 확정되는 순간 이 항목은 더
 * 미정이 아니다 — BriefingScreen(조건 확정 전, 항상 전체 표시)과 달리 MotionScreen·
 * VoteScreen·ResultScreen은 확정 조건에 대응하는 항목을 걸러내고 남은 것만 보여준다
 * (`src/content/motionDisplay.ts`). 새 사실을 만들지 않고 기존 undecidedItems·
 * remainingTasks 문자열에 대응 조건 id만 더한 것이다. */
export interface UndecidedItem {
  text: string;
  /** 하나 또는 여럿 — 상반된 방향의 조건이 같은 미정 항목을 해소할 수 있다(예: "사람이 다시
   * 보는 절차"는 REVIEW(표본 재검토)로도, FULL_AUTO(검토 전면 생략 = 절차 없음)로도
   * 결정된다, PR #20 Codex 5차 검토 P2). */
  resolvedBy?: string | readonly string[];
}

/** 원안을 "제안"과 "아직 정하지 않은 것"으로 나눠 보여줄 표시용 필드(T52, 브리핑 오른쪽
 * 열 2번 블록). 기존 원안 문장(`originalMotion.text`/`subtitle`)을 쪼개 채우며 새 사실을
 * 만들지 않는다. `originalMotion.text`는 표결·프롬프트가 그대로 쓰므로 건드리지 않는다. */
export interface MotionBreakdown {
  proposal: string;
  undecidedItems: UndecidedItem[];
}

/** 임원 "지금 기울어 있는 쪽"의 값 집합(src/domain/types.ts의 Stance와 같은 리터럴).
 * content가 domain에 의존하지 않도록 여기서 따로 둔다(domain이 content를 쓰는 방향만
 * 유지, PR #13 Codex 3차 검토). */
export type OpeningStance = 'FOR' | 'AGAINST' | 'UNDECIDED';

export interface InitialOpinion {
  memberId: ExecMemberId;
  text: string;
  evidenceIds: string[];
  /** OPINIONS 단계(아직 참가자가 말하지 않은 동안, DISCUSS 포함) "출발 성향"(PR #13
   * Codex 3차 검토 — server/scenario-data.ts의 roleLenses[role].opening과 같은 값을
   * 쓴다). domain/stance.ts의 scriptedStances가 조건이 아직 없는 동안 이 값을 그대로
   * 쓰고, 참가자가 의견을 전달한 뒤(REACTIONS~)에는 voteRules 기반 계산으로 넘어간다 —
   * 정답표가 아니라 "첫 반응"일 뿐이며 voteRules의 always 분기와 다를 수 있다(의도적,
   * SCENARIO_AI_APPROVAL.md·SCENARIO_EXPERIENCE_FIRST.md "첫 stance" 열). */
  openingStance: OpeningStance;
}

/** 추천 문구가 어느 입장에서 하는 말인지(T87, 사용자 지적 "추천 문구가 찬성 쪽에
 * 편중"). 'BOTH'는 입장과 무관한 요청형 문구(P6류)에 쓴다. 과거 시나리오(anonBoard·
 * aiAssistant, 레지스트리에서 뺀 파일)는 이 필드가 아직 없어도 되게 선택값으로
 * 둔다 — DiscussScreen은 없는 값을 'FOR'로 본다(그 문구들이 전부 제안형 톤이라
 * 기존 동작과 같다). */
export type PhraseSide = 'FOR' | 'AGAINST' | 'BOTH';

export interface Phrase {
  id: string;
  text: string;
  conditionId: string | null;
  tag?: string;
  side?: PhraseSide;
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

/** 추천 답변이 어느 입장에서 하는 말인지(T89, 사용자 지시 "반응에 답하기에서도 내
 * 의견에서와 마찬가지로 선택할 수 있도록"). Phrase.side와 같은 뜻·같은 기본값
 * 규칙이다 — 값이 없는 과거 시나리오(anonBoard·aiAssistant, 레지스트리에서 뺀 파일)는
 * ReactionsScreen이 'FOR'로 본다. */
export type FollowUpSide = 'FOR' | 'AGAINST' | 'BOTH';

export interface FollowUpOption {
  text: string;
  proposeConditionId: string | null;
  keepPrevious?: boolean;
  side?: FollowUpSide;
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
  /** 판단 이유 한 줄(v1.0 T48). 결과 화면 "이사회 한 장 요약"에 표시한다. 조건 라벨을
   * 그대로 인용하고 새 수치·확정 사실을 만들지 않는다(SCENARIO_AI_ASSISTANT.md). 없는
   * 규칙은 표 텍스트만 쓴다(기존 테스트·준비 중 안건 호환). */
  reason?: string;
}

/** "6개월 뒤" 에필로그(v1.0 T47). 결과 화면 왼쪽 열, '체험용 가상 전망' 배지와 함께
 * 쓴다. 수치·비율·금액 없이 상태만 묘사한다(SCENARIO_AI_ASSISTANT.md). */
/** "6개월 뒤" 에필로그 문구(v1.0 T47, T62에서 가결·부결 두 갈래로 정리). pass는 이사회가
 * 붙인 조건이 최종안에 반영된 가결(도장 "조건부 가결"과 같은 기준), passOriginal은 반영
 * 조건 없이 원안이 그대로 가결된 경우 — live에서는 조건 없는 원안도 임원 모델 표로
 * PASS가 될 수 있으므로 "붙인 조건이 점검표가 되었다"는 문구를 쓰면 안 된다(PR #8 Codex
 * 2차 검토). */
export interface SixMonthsLaterCopy {
  pass: string;
  passOriginal: string;
  reject: string;
}

export interface ResultCopy {
  pass: string;
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
  motionBreakdown: MotionBreakdown;
  initialOpinions: InitialOpinion[];
  phrases: Phrase[];
  conditions: Condition[];
  conflicts: ConflictPair[];
  reactions: Reaction[];
  /** 순수 반대(조건 없이 안건 자체에 반대, T92)에 대한 임원 4명의 반응 한 문장씩. 기존
   * reactions의 conditionId: 'none'은 "말씀은 기록했습니다" 같은 입장 무관 문구라, 참가자가
   * 반대 입장이면 대신 이 문구를 쓴다(ReactionsScreen·minutes.ts). 없으면(과거 시나리오)
   * 기존 'none' 반응으로 되돌아간다. */
  oppositionReactions?: Record<ExecMemberId, string>;
  followUp: FollowUp;
  voteRules: Record<ExecMemberId, VoteRule[]>;
  resultCopy: ResultCopy;
  remainingTasks: UndecidedItem[];
  baseConditionIds: string[];
  status: ScenarioStatus;
}
