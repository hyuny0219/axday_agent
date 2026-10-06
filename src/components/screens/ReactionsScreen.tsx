// 반응 화면: 내 발언을 인용하고, 확정 조건에 연결된 임원만 반응을 바꾼다. 나머지
// 임원은 기존 의견을 유지한다(docs/SCENARIO_AI_ASSISTANT.md "첫 반응 및 후속 질문").
// 후속 질문은 세션당 1회이며 조건 제안·충돌·확정은 discuss와 동일하게
// domain/conditions.ts에 위임한다. T12에서 AssistantPanel을 붙였다. live 모드에서는
// 상단 임원 카드 행을 scenario.reactions 대신 실제 REACTIONS 라운드 결과(roleStatus·
// statements)로 바꾼다(T30). T31에서 draftRevision·transcript·assistantAdapter를
// AssistantPanel에 추가로 넘긴다(statements를 그대로 transcript로 재사용한다).
//
// T74(docs/design/mockups/S4_Reactions.html 시안 그대로): 왼쪽 열은 무대(App.tsx가
// 그린다) 아래 HUD 입력 상자("MY REPLY · 내 답변" — DiscussScreen의 DraftEditor를
// label·testid만 바꿔 그대로 재사용) + CONDITIONS 칩(ConditionChips 그대로 재사용) +
// 버튼 줄([AI 비서실장 열기][답변 전달 ▶]). 오른쪽 종이는 STEP 04 + 제목 + 반응 카드
// 2×2(live는 LiveStatementCards variant='reaction', scripted는 이 파일의
// .reaction-card) + 점선 FOLLOW-UP 상자 + 추천 답변 체크 카드 2열(PhraseCard를
// followUp.options에 재사용 — 여러 개 선택 가능, 고르면 왼쪽 답변에 이어 붙는다,
// DISCUSS 추천 문구와 같은 조합 규칙) + "근거 자료 · 임원 발언 보기" 버튼(T73
// EvidenceDialog 재사용, STATEMENTS에 02 의견 + 04 반응을 단계 태그와 함께 보여준다).
// 옛 "직접 답하기 열기 → 빠른 답 3버튼/직접 입력" 토글 구조는 걷어냈다 — textarea는
// 이제 늘 보인다. "앞서 전달한 의견을 유지하겠습니다"(followUp.options의
// keepPrevious) 체크 카드는 조합에 끼지 않고 그대로 onKeepPrevious를 즉시 부른다
// (T40 이후 바뀌지 않은 KEEP_PREVIOUS 동작). testid followup-option-N·
// followup-textarea·submit-followup·retry-failed-roles·condition-chip-*·
// reactions-info(inert)는 모두 그대로 유지한다.
// 2026-10-02 검토 반영(제로 이탈 지시): 옛 "내 발언 인용" 인용문(blockquote)은
// S4_Reactions 시안에 없어 뺐다 — 참가자 본인 발언은 이미 무대 참가자 말풍선
// (StageBand)이 보여주므로 중복이었다. 그 testid·2줄 클램프에 기대던 e2e 단언은
// 모두 지우거나 다른 신호로 바꿨다.
// 2026-10-02 2차 검토 반영: 다만 StageBand 전체가 aria-hidden(장식)이고 REACTIONS는
// 발언 흐름 패널도 없어(DISCUSS와 같은 이유), 인용문을 빼기만 하면 스크린리더가 이
// 화면에서 참가자 본인의 이전 의견을 읽을 자리가 없어진다. 시각은 그대로 두고
// `ExecStanceList`와 같은 sr-only 기법(`.reactions-screen__sr-only`)으로 MY REPLY
// 편집기 바로 앞에 숨은 문단 하나만 되돌렸다 — 화면 모양은 전혀 바뀌지 않는다.
// PR #12 Codex 1차 검토(P1-a·P1-b): 추천 답변 체크 → 직접 수정 → 다시 체크의 편집
// 손실 방지를 DISCUSS(domain/draft.ts의 dirty 플래그 + RebuildConfirm)와 똑같은
// 모양으로 맞췄다. `dirty`는 참가자가 textarea를 직접 고친 뒤(handleTextChange) true가
// 되고, 체크 카드를 눌러 조합을 다시 지을 때(handleToggleOption, dirty=false일 때만
// 바로 적용)만 false로 돌아간다. (P1-a) dirty인 동안은 체크된 옵션의
// proposeConditionId를 조건 제안에서 빼 — 직접 고친 문장이 이미 그 조건 문구를
// 부정했는데도 체크 상태만으로 조건이 남는 일을 막는다(제안은 domain/conditions.ts의
// 키워드 규칙으로만 다시 찾는다). (P1-b) dirty인 동안 체크 카드를 누르면 바로 덮어쓰지
// 않고 DISCUSS와 같은 RebuildConfirm("직접 쓴 내용 유지"/"선택 문구로 다시 구성")을
// 띄운다 — '유지'는 체크만 바꾸고 텍스트는 그대로, '다시 구성'은 전체 선택 기준으로
// 다시 짓고(domain/draft.ts의 buildDraftText와 같은 전체 재구성 방식) dirty를 푼다.
// PR #12 Codex 2차 검토: (1) canSubmit도 pendingOptionIndex === null을 요구하게 해
// RebuildConfirm이 뜬 동안 요청한 체크 변경을 건너뛰고 조용히 전달되는 일을 막았다.
// (2)·(3) 근거 자료 팝업 STATEMENTS의 02(OPINIONS) 행이 04(REACTIONS)와 같은 최신
// stances를 공유하던 것을 각 발언 자체의 Statement.stance로 바꾸고, 02 발언이 아직
// 없을 때의 상태를 roundLog(App.tsx, T41)에서 그 역할의 OPINIONS 결과만 찾아 판정하게
// 했다(자세한 이유는 아래 dialogStatements 바로 위 주석).
// PR #12 Codex 3차 검토 2: live뿐 아니라 scripted도 같은 문제가 있었다 — 02·04 행이
// 둘 다 "현재"(참가자가 확정한 조건까지 반영된) stances를 썼다. scripted의 02(최초
// 의견 단계)는 아직 아무 조건도 확정되지 않았을 때의 입장이어야 하므로,
// domain/stance.ts의 scriptedStances를 opinions=[]로 다시 불러(조건 없는 표결
// 규칙표 결과) 02 전용 stance를 따로 계산한다. 04는 그대로 현재 stances를 쓴다.
// PR #12 Codex 5차 검토: (P2-a) scripted 반응 카드의 유지/바뀜 배지가 "반응 문구가
// 있는지"(reactionsFor 결과)로 갈렸는데, 조건 하나만으로는 표가 안 바뀌어도 그
// 조건에 묶인 반응 문구가 있으면 "바뀜"으로, 반대로 표가 바뀌어도 그 전환을 설명하는
// 반응 문구가 시나리오 데이터에 없으면 "유지"로 잘못 보였다. scriptedBaselineStances
// (조건 없는 기준 입장) vs 현재 stances로 가르게 바꿨다 — 반응 문구는 본문 표시에만
// 쓴다. (P2-b) RebuildConfirm이 뜬 동안에도 추천 답변 카드가 그대로 눌려, 그중
// "앞서 전달한 의견을 유지하겠습니다"(onKeepPrevious로 즉시 다음 단계로 넘어간다)를
// 누르면 확인을 건너뛰고 직접 쓴 답변을 버린 채 넘어갔다. handleToggleOption 맨
// 앞에서 pendingOptionIndex !== null이면 바로 멈추고, PhraseCard에도 disabled를
// 넘겨 시각적으로도 잠근다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { Opinion, RoleStatus, Stance, Statement } from '../../domain/types';
import { DRAFT_MAX_LENGTH } from '../../domain/draft';
import { confirmConditions, findConflicts, proposeFromText } from '../../domain/conditions';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import type { AssistantAdapter } from '../../services/assistant/types';
import { MEMBER_LABELS } from '../memberLabels';
import { STANCE_LABEL } from '../moodLabel';
import { reactionsFor } from '../reactionsFor';
import { scriptedStances } from '../../domain/stance';
import type { RoundLogEntry } from '../minutes';
import { DraftEditor } from '../parts/DraftEditor';
import { PhraseCard } from '../parts/PhraseCard';
import { RebuildConfirm } from '../parts/RebuildConfirm';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import { LiveStatementCards } from '../parts/LiveStatementCards';
import { EvidenceDialog, type EvidenceDialogStatementView } from '../parts/EvidenceDialog';
import '../../styles/screens/reactions.css';

export interface ReactionsFollowupPayload {
  originalText: string;
  selectedPhraseIds: string[];
  confirmedConditionIds: string[];
}

export interface ReactionsScreenProps {
  scenario: Scenario;
  sessionId: string;
  opinions: Opinion[];
  mode: 'live' | 'scripted';
  roleStatus: Record<ExecMemberId, RoleStatus>;
  statements: Statement[];
  /** 라운드별 임원 응답 기록(T41, App.tsx가 SET_ROLE_STATUS dispatch를 가로채 쌓는다).
   * roleStatus는 "지금" 라운드(REACTIONS)만 담아 OPINIONS 결과를 덮어쓰므로, 근거 자료
   * 팝업의 02 임원 의견 행이 아직 응답 전인지(판단 중)·끝내 실패했는지(응답 없음)를
   * 가리려면 이 기록이 필요하다(PR #12 Codex 2차 검토 3). */
  roundLog: RoundLogEntry[];
  /** 무대 표정 배지의 접근 가능한 대응 텍스트(T63). */
  stances: Record<ExecMemberId, Stance>;
  /** AI 비서실장 '의견 한눈에 보기'(live)가 근거로 삼는 실제 회의 기록 revision. */
  transcriptRevision: number;
  onSubmitFollowup: (payload: ReactionsFollowupPayload) => void;
  onKeepPrevious: () => void;
  /** AI 비서실장 결과가 실제로 표시·적용됐을 때만 호출된다(세션 기록용). */
  onAssistantAction: (event: AssistantActionEvent) => void;
  /** live/scripted 중 App.tsx가 session.mode로 고른 비서실장 어댑터. */
  assistantAdapter?: AssistantAdapter;
  /** 실패한 역할만 골라 REACTIONS 라운드를 다시 부른다(T65 "다시 요청"). live에서만 쓴다. */
  onRetryFailedRoles?: (roleIds: ExecMemberId[]) => void;
}

/** 반응 카드(scripted) 왼쪽 띠·stance 글자색에 쓰는 소문자 modifier(DiscussScreen·
 * OpinionsScreen의 STANCE_MODIFIER와 같은 값). */
const STANCE_MODIFIER: Record<Stance, 'for' | 'against' | 'undecided'> = {
  FOR: 'for',
  AGAINST: 'against',
  UNDECIDED: 'undecided',
};

function uniqueInOrder(ids: string[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

/** 자료 ID(E1~E4) 대신 자료명만 쓴다(T52). evidenceIds가 여럿이면 가장 마지막 것
 * (DiscussScreen.lastEvidenceLabel과 같은 규칙 — EvidenceDialog 호출부마다 지역
 * 함수로 둔다). */
function lastEvidenceLabel(scenario: Scenario, evidenceIds: string[]): string | null {
  const lastId = evidenceIds[evidenceIds.length - 1];
  if (!lastId) {
    return null;
  }
  const card = scenario.evidence.find((item) => item.id === lastId);
  return card ? card.title : lastId;
}

export function ReactionsScreen({
  scenario,
  sessionId,
  opinions,
  mode,
  roleStatus,
  statements,
  roundLog,
  stances,
  transcriptRevision,
  onSubmitFollowup,
  onKeepPrevious,
  onAssistantAction,
  assistantAdapter,
  onRetryFailedRoles,
}: ReactionsScreenProps) {
  const lastOpinion = opinions[opinions.length - 1] ?? null;
  const previousConfirmedIds = useMemo(
    () => lastOpinion?.confirmedConditionIds ?? [],
    [lastOpinion],
  );
  // 라운드당 1회(T65) — server/sessionLimit.ts의 호출 상한이 최종 방어선이다.
  const [retryUsed, setRetryUsed] = useState(false);
  // DISCUSS와 같은 이유로(PR #11 Codex 31·32차) AI 비서실장 드로어가 열린 동안 오른쪽 열을
  // inert로 만든다 — 특히 live의 "응답 없는 임원 다시 요청"이 드로어 뒤에서 Tab으로 눌려
  // 유료 재요청이 나가지 않게 한다.
  const [assistantOpen, setAssistantOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const handleAssistantOpenChange = useCallback((open: boolean) => setAssistantOpen(open), []);
  useEffect(() => {
    infoRef.current?.toggleAttribute('inert', assistantOpen);
  }, [assistantOpen]);

  function handleRetry() {
    const failedRoleIds = EXEC_MEMBER_ORDER.filter((roleId) => roleStatus[roleId] === 'failed');
    if (failedRoleIds.length === 0 || !onRetryFailedRoles) {
      return;
    }
    setRetryUsed(true);
    onRetryFailedRoles(failedRoleIds);
  }

  // 추천 답변 체크 카드(T74): 선택된 것(문자열 인덱스)을 followUp.options 순서대로
  // 이어 붙여 textValue를 구성한다 — DISCUSS의 selectedPhraseIds·buildDraftText와 같은
  // 규칙이지만 scenario.phrases가 아니라 followUp.options를 조합 대상으로 쓰므로
  // domain/draft.ts를 그대로 쓸 수 없어 이 화면 안에서 같은 모양으로 다시 짠다.
  // keepPrevious 옵션은 조합에 끼지 않고 onKeepPrevious를 즉시 부른다(기존 동작).
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [textValue, setTextValue] = useState('');
  // DISCUSS의 DraftState.dirty와 같은 뜻: textarea를 직접 고친 뒤(아직 체크 카드로
  // 다시 구성하지 않은 동안) true다. P1-a·P1-b(위 주석) 모두 이 플래그로 가른다.
  const [dirty, setDirty] = useState(false);
  const [pendingOptionIndex, setPendingOptionIndex] = useState<number | null>(null);
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>(previousConfirmedIds);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  // discuss-screen과 같은 이유로 textValue가 바뀔 때마다 늘린다.
  const [draftRevision, setDraftRevision] = useState(0);
  const transcript = useMemo(
    () => ({ revision: transcriptRevision, statements }),
    [transcriptRevision, statements],
  );

  const composeText = useCallback(
    (ids: string[]) =>
      scenario.followUp.options
        .map((option, index) => ({ option, index }))
        .filter(({ index }) => ids.includes(String(index)))
        .map(({ option }) => option.text)
        .join(' '),
    [scenario],
  );

  const newProposedIds = useMemo(() => {
    // P1-a: dirty(직접 수정)인 동안은 체크된 옵션의 조건 제안을 쓰지 않는다 — 고친
    // 문장이 이미 체크 카드 문구와 다를 수 있으므로, 제안은 오직 현재 textValue를
    // 키워드 규칙(proposeFromText)으로 다시 찾은 것만 믿는다.
    const fromOptions = dirty
      ? []
      : selectedOptionIds
          .map((idStr) => scenario.followUp.options[Number(idStr)]?.proposeConditionId ?? null)
          .filter((id): id is string => id !== null);
    const fromText = proposeFromText(scenario, textValue);
    return uniqueInOrder([...fromOptions, ...fromText]);
  }, [scenario, selectedOptionIds, textValue, dirty]);

  const proposedConditionIds = useMemo(
    () => uniqueInOrder([...previousConfirmedIds, ...newProposedIds]),
    [previousConfirmedIds, newProposedIds],
  );

  // CONDITIONS 칩의 "기존 확정"(cyan) vs "새 조건"(앰버) 구분(T74 2차 검토, 시안
  // S4_Reactions): DISCUSS에서 이미 확정한 조건을 이 답변이 다시 제안해도(같은
  // 조건을 가리키는 다른 옵션을 고르는 등) "새 조건"으로 보이면 안 되므로
  // previousConfirmedIds를 뺀다.
  const newlyProposedConditionIds = useMemo(
    () => newProposedIds.filter((id) => !previousConfirmedIds.includes(id)),
    [newProposedIds, previousConfirmedIds],
  );

  // 후속 보완은 이전에 확정한 조건을 그대로 보여주고 유지·해제할 수 있게 하며,
  // 새로 제안된 조건은 문구 선택 때와 같이 미리 확인된 상태로 보여준다.
  useEffect(() => {
    setAcceptedConditionIds((previous) => {
      const stillProposed = previous.filter((id) => proposedConditionIds.includes(id));
      const autoAccepted = newProposedIds.filter((id) => !stillProposed.includes(id));
      return uniqueInOrder([...stillProposed, ...autoAccepted]);
    });
  }, [proposedConditionIds, newProposedIds]);

  const conflictPairs = useMemo(
    () => findConflicts(scenario, acceptedConditionIds),
    [scenario, acceptedConditionIds],
  );

  const confirmedConditionIds = useMemo(
    () =>
      confirmConditions(scenario, proposedConditionIds, acceptedConditionIds)
        .filter((confirmation) => confirmation.status === 'confirmed')
        .map((confirmation) => confirmation.id),
    [scenario, proposedConditionIds, acceptedConditionIds],
  );

  const showNoMatchHint = textValue.trim() !== '' && proposedConditionIds.length === 0;
  // 조건 확인은 답을 시작한 뒤(추천 답변 체크, 직접 입력)에만 보여준다. 이전 의견의
  // 조건은 그 전까지 그대로 유지된다(PR #4 Codex 2차 검토).
  const hasStartedAnswer = selectedOptionIds.length > 0 || textValue.trim() !== '';
  // PR #12 Codex 2차 검토 1: RebuildConfirm이 뜬 동안(pendingOptionIndex !== null)은
  // 참가자가 요청한 체크 변경이 아직 반영되지 않았으므로 전달을 막는다 — DiscussScreen의
  // `pendingPhraseId === null && isSubmittable(draft)`와 같은 규칙이다.
  const canSubmit =
    pendingOptionIndex === null &&
    textValue.trim() !== '' &&
    textValue.length <= DRAFT_MAX_LENGTH &&
    conflictPairs.length === 0;

  function handleToggleOption(index: number) {
    // PR #12 Codex 5차 검토 P2: RebuildConfirm이 뜬 동안(pendingOptionIndex !== null)은
    // 아직 "직접 쓴 내용 유지/다시 구성"을 고르지 않았으므로 추천 답변 카드를 모두
    // 잠근다 — 특히 "앞서 전달한 의견을 유지하겠습니다"(keepPrevious)는 onKeepPrevious로
    // 즉시 다음 단계로 넘어가므로, 이 가드가 없으면 확인을 건너뛰고 직접 쓴 답변을
    // 그대로 버리게 된다. PhraseCard에도 disabled를 넘겨 시각적으로도 잠근다(이중 방어).
    if (pendingOptionIndex !== null) {
      return;
    }
    const option = scenario.followUp.options[index];
    if (!option) {
      return;
    }
    if (option.keepPrevious) {
      onKeepPrevious();
      return;
    }
    // P1-b: 직접 고친 내용이 있으면(dirty) 조용히 덮어쓰지 않고 DISCUSS와 같은 확인
    // UI를 먼저 띄운다.
    if (dirty) {
      setPendingOptionIndex(index);
      return;
    }
    const idStr = String(index);
    setSelectedOptionIds((previous) => {
      const next = previous.includes(idStr)
        ? previous.filter((id) => id !== idStr)
        : [...previous, idStr];
      setTextValue(composeText(next));
      return next;
    });
    setDraftRevision((value) => value + 1);
  }

  /** RebuildConfirm '직접 쓴 내용 유지': 체크 상태만 바꾸고 textValue는 그대로 둔다
   * (dirty 유지). */
  function handleKeepCustomText() {
    if (pendingOptionIndex === null) {
      return;
    }
    const idStr = String(pendingOptionIndex);
    setSelectedOptionIds((previous) =>
      previous.includes(idStr) ? previous.filter((id) => id !== idStr) : [...previous, idStr],
    );
    setPendingOptionIndex(null);
  }

  /** RebuildConfirm '선택 문구로 다시 구성': 새 선택 전체 기준으로 textValue를 다시
   * 짓고(domain/draft.ts의 buildDraftText와 같은 전체 재구성) dirty를 푼다. */
  function handleRebuildFromOptions() {
    if (pendingOptionIndex === null) {
      return;
    }
    const idStr = String(pendingOptionIndex);
    setSelectedOptionIds((previous) => {
      const next = previous.includes(idStr)
        ? previous.filter((id) => id !== idStr)
        : [...previous, idStr];
      setTextValue(composeText(next));
      return next;
    });
    setDirty(false);
    setDraftRevision((value) => value + 1);
    setPendingOptionIndex(null);
  }

  function handleTextChange(text: string) {
    setTextValue(text);
    setDirty(true);
    setDraftRevision((value) => value + 1);
  }

  function handleToggleCondition(conditionId: string) {
    setAcceptedConditionIds((previous) =>
      previous.includes(conditionId)
        ? previous.filter((id) => id !== conditionId)
        : [...previous, conditionId],
    );
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    onSubmitFollowup({
      originalText: textValue,
      selectedPhraseIds: [],
      confirmedConditionIds,
    });
  }

  // 사건 칩(시안 "CASE 02", T83에서 한국어화): DiscussScreen과 같은 규칙으로
  // scenario.incident.caseLabel을 그대로 쓴다("사건 02" 형식).
  const caseTag = scenario.incident.caseLabel;

  // scripted 전용 "기준" 입장(아직 아무 조건도 확정되지 않았을 때의 stance) —
  // 반응 카드 유지/바뀜 배지(아래 .reaction-card)와 근거 자료 팝업 02 행이 함께
  // 쓴다(PR #12 Codex 5차 검토 P2: dialogStatements의 scripted 02 stance 계산을
  // 여기로 끌어올려 두 곳이 같은 값을 쓰게 했다).
  const scriptedBaselineStances = useMemo(
    () => scriptedStances(scenario, { stage: 'OPINIONS', opinions: [] }),
    [scenario],
  );

  // 근거 자료 팝업의 STATEMENTS 열(T74): DISCUSS는 02 임원 의견만 보여줬지만 REACTIONS는
  // 02 의견 + 04 반응을 함께(단계 태그로 구분) 보여준다.
  // PR #12 Codex 2차 검토 2: 두 행이 같은 stances[memberId](현재·최신 stance)를 쓰면
  // REACTIONS에서 입장이 바뀐 임원의 02 행까지 덩달아 다시 라벨된다 — 각 발언이 실제로
  // 실린 Statement.stance(live 응답이 그대로 옮겨 싣는 값, T63)를 먼저 쓰고, 그 발언
  // 자체가 없을 때만(응답 전·실패) 현재 stances로 근사한다.
  // PR #12 Codex 2차 검토 3: 02 발언이 없다고 바로 "실패"로 보여주면, 참가자가 OPINIONS
  // 라운드가 아직 끝나기 전에 다음 단계로 넘어간 경우에도 "응답 지연·확인 필요"로 잘못
  // 보인다. roleStatus(REACTIONS용)로는 OPINIONS 단계의 실제 결과를 알 수 없으므로,
  // App.tsx가 SET_ROLE_STATUS(stage 포함)를 가로채 쌓아 둔 roundLog(T41, 회의록 패널과
  // 같은 근거)에서 그 역할의 OPINIONS 결과만 찾아 실패일 때만 "실패", 그 밖에는(아직
  // 기록이 없음 포함) "판단 중"으로 둔다.
  const dialogStatements = useMemo<EvidenceDialogStatementView[]>(() => {
    if (mode === 'live') {
      return EXEC_MEMBER_ORDER.flatMap((memberId) => {
        const stance = stances[memberId];
        const opinionStatement = statements.find(
          (item) => item.roleId === memberId && item.stage === 'OPINIONS',
        );
        const opinionStance = opinionStatement?.stance ?? stance;
        const opinionRoundStatus = roundLog.find(
          (entry) => entry.stage === 'OPINIONS' && entry.roleId === memberId,
        )?.status;
        const opinionEntry: EvidenceDialogStatementView = opinionStatement
          ? {
              memberId,
              stance: opinionStance,
              status: 'answered',
              text: opinionStatement.text,
              evidenceLabel: lastEvidenceLabel(scenario, opinionStatement.evidenceIds),
              testable: true,
              stage: 'OPINIONS',
            }
          : {
              memberId,
              stance: opinionStance,
              status: opinionRoundStatus === 'failed' ? 'failed' : 'pending',
              text: '',
              evidenceLabel: null,
              testable: true,
              stage: 'OPINIONS',
            };

        const reactionStatus = roleStatus[memberId];
        const reactionStatement = statements.find(
          (item) => item.roleId === memberId && item.stage === 'REACTIONS',
        );
        const reactionStance = reactionStatement?.stance ?? stance;
        const reactionEntry: EvidenceDialogStatementView =
          reactionStatus === 'answered' && reactionStatement
            ? {
                memberId,
                stance: reactionStance,
                status: 'answered',
                text: reactionStatement.text,
                evidenceLabel: lastEvidenceLabel(scenario, reactionStatement.evidenceIds),
                testable: true,
                stage: 'REACTIONS',
              }
            : {
                memberId,
                stance: reactionStance,
                status: reactionStatus === 'failed' ? 'failed' : 'pending',
                text: '',
                evidenceLabel: null,
                testable: true,
                stage: 'REACTIONS',
              };
        return [opinionEntry, reactionEntry];
      });
    }
    // scripted 02(최초 의견) 행은 아직 아무 조건도 확정되지 않았을 때의 입장이어야
    // 한다 — "지금" stances(04, 참가자가 확정한 조건까지 반영)와 분리한다(PR #12
    // Codex 3차 검토 2, 값 자체는 scriptedBaselineStances로 위에서 미리 계산한다).
    return EXEC_MEMBER_ORDER.flatMap((memberId) => {
      const stance = stances[memberId];
      const initial = scenario.initialOpinions.find((opinion) => opinion.memberId === memberId);
      const opinionEntry: EvidenceDialogStatementView = {
        memberId,
        stance: scriptedBaselineStances[memberId],
        status: 'answered',
        text: initial?.text ?? '',
        evidenceLabel: initial ? lastEvidenceLabel(scenario, initial.evidenceIds) : null,
        testable: false,
        stage: 'OPINIONS',
      };
      const reactions = reactionsFor(scenario, memberId, previousConfirmedIds);
      const reactionText =
        reactions.length > 0
          ? reactions.map((reaction) => reaction.text).join(' ')
          : `기존 의견 유지 — ${initial?.text ?? ''}`;
      const reactionEntry: EvidenceDialogStatementView = {
        memberId,
        stance,
        status: 'answered',
        text: reactionText,
        evidenceLabel: null,
        testable: false,
        stage: 'REACTIONS',
      };
      return [opinionEntry, reactionEntry];
    });
  }, [mode, roleStatus, statements, roundLog, stances, scenario, previousConfirmedIds, scriptedBaselineStances]);

  return (
    <>
      <div className="app-body__actions screen reactions-screen">
        {pendingOptionIndex !== null && (
          <RebuildConfirm onKeep={handleKeepCustomText} onRebuild={handleRebuildFromOptions} />
        )}
        <div className="reactions-screen__hud" data-testid="reactions-hud">
          {lastOpinion && (
            <p className="reactions-screen__sr-only" data-testid="reactions-prior-opinion">
              이사님의 이전 의견: {lastOpinion.originalText}
            </p>
          )}
          <DraftEditor
            value={textValue}
            onChange={handleTextChange}
            label="내 답변"
            ariaLabel="내 답변"
            placeholder="이사님의 답변을 직접 입력하거나 추천 답변을 선택해 주세요."
            textareaTestId="followup-textarea"
            countTestId="followup-char-count"
            errorTestId="followup-draft-error"
          />
          {/* T85 my#10: 답을 시작하는 순간 CONDITIONS 칩이 생기며 바로 아래
              "답변 전달" 버튼이 밀려 내려가 클릭 직전 버튼이 움직였다 — 칩이 없을
              때도 이 슬롯이 자리를 미리 비워 둔다(reactions.css min-height). */}
          <div className="reactions-screen__conditions-slot">
            {hasStartedAnswer && (
              <ConditionChips
                scenario={scenario}
                proposedIds={proposedConditionIds}
                acceptedIds={acceptedConditionIds}
                conflictPairs={conflictPairs}
                showNoMatchHint={showNoMatchHint}
                onToggle={handleToggleCondition}
                newlyProposedIds={newlyProposedConditionIds}
              />
            )}
          </div>
        </div>
        <div className="reactions-screen__submit-row screen__submit-row">
          <AssistantPanel
            scenario={scenario}
            sessionId={sessionId}
            selectedConditionIds={confirmedConditionIds}
            draftText={textValue}
            draftRevision={draftRevision}
            transcript={transcript}
            onApplyDraft={handleTextChange}
            onAssistantAction={onAssistantAction}
            onOpenChange={handleAssistantOpenChange}
            adapter={assistantAdapter}
          />
          <button
            type="button"
            className="cta"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="submit-followup"
          >
            답변 전달 ▶
          </button>
          {!canSubmit && (
            <p className="cta-disabled-hint" data-testid="reactions-cta-hint">
              추천 문구를 고르거나 직접 써 주세요
            </p>
          )}
        </div>
      </div>
      <div className="app-body__content screen reactions-screen__info" ref={infoRef} data-testid="reactions-info">
        <div className="reactions-screen__paper">
          <div className="reactions-screen__head">
            <span className="reactions-screen__step">4단계</span>
            {/* 시안 원본은 <h1>이지만, 다른 조종석 화면과 같은 <h2> 위계를 쓴다(T73과
                같은 이유) — 글자 크기는 시안 값 그대로다. */}
            <h2 className="reactions-screen__title">
              이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다
            </h2>
          </div>
          {mode === 'live' ? (
            <LiveStatementCards
              scenario={scenario}
              stage="REACTIONS"
              roleStatus={roleStatus}
              statements={statements}
              stances={stances}
              variant="reaction"
              onRetryFailedRoles={onRetryFailedRoles ? handleRetry : undefined}
              retryDisabled={retryUsed}
            />
          ) : (
            <div className="reactions-screen__cards">
              {EXEC_MEMBER_ORDER.map((memberId) => {
                const reactions = reactionsFor(scenario, memberId, previousConfirmedIds);
                const initial = scenario.initialOpinions.find((opinion) => opinion.memberId === memberId);
                const stance = stances[memberId];
                // PR #12 Codex 5차 검토 P2: 유지/바뀜 배지는 반응 문구가 있는지가
                // 아니라 실제 stance가 바뀌었는지로 가른다 — 조건 하나만으로는 표가
                // 안 바뀌는데 그 조건에 묶인 반응 문구만 있어 "바뀜"으로 잘못 보이거나
                // (예: PILOT만 확정해도 CFO는 그대로 반대지만 PILOT에 묶인 반응 문구가
                // 있다), 반대로 표는 바뀌었는데 그 전환을 설명하는 반응 문구가 시나리오
                // 데이터에 없어 "유지"로 잘못 보이는 경우(예: ANON_FULL이 CEO를 찬성→
                // 반대로 돌리지만 CEO에 연결된 반응 문구가 없다)를 모두 막는다. 반응
                // 문구(reactions)는 본문 표시에만 쓴다(아래 .reaction-card__text).
                const changed = scriptedBaselineStances[memberId] !== stance;
                return (
                  <article
                    key={memberId}
                    className={`reaction-card reaction-card--${STANCE_MODIFIER[stance]}`}
                    data-testid={`reaction-card-${memberId}`}
                  >
                    <div className="reaction-card__head">
                      <h3 className="reaction-card__member">{MEMBER_LABELS[memberId]}</h3>
                      <span className="reaction-card__mood" data-testid={`exec-mood-label-${memberId}`}>
                        {STANCE_LABEL[stance]}
                      </span>
                      <span className="reaction-card__badge" aria-hidden="true">
                        {changed ? '바뀜' : '유지'}
                      </span>
                    </div>
                    <p className="reaction-card__text">
                      {reactions.length > 0
                        ? reactions.map((reaction) => reaction.text).join(' ')
                        : `기존 의견 유지 — ${initial?.text ?? ''}`}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
          <div className="reactions-screen__followup" data-testid="followup-question">
            <span className="reactions-screen__followup-label">
              추가 질문 · {scenario.followUp.askedBy}가 묻습니다
            </span>
            <p className="reactions-screen__followup-text">{scenario.followUp.question}</p>
          </div>
          <p className="reactions-screen__recommend-hint">
            추천 답변 · 여러 개 선택 가능 · 고르면 왼쪽 내 답변에 이어 붙습니다
          </p>
          <div className="reactions-screen__option-list">
            {scenario.followUp.options.map((option, index) => (
              <PhraseCard
                key={index}
                phrase={{ id: String(index), text: option.text }}
                selected={selectedOptionIds.includes(String(index))}
                onToggle={() => handleToggleOption(index)}
                testId={`followup-option-${index}`}
                disabled={pendingOptionIndex !== null}
              />
            ))}
          </div>
          <div className="reactions-screen__evidence-row">
            <button
              type="button"
              className="evidence-open-button"
              onClick={() => setEvidenceOpen(true)}
              data-testid="open-evidence"
            >
              근거 자료 · 임원 발언 보기
            </button>
            <span className="evidence-open-hint">자료 ①~④ + 임원 발언</span>
          </div>
        </div>
      </div>
      {evidenceOpen && (
        <EvidenceDialog
          evidence={scenario.evidence}
          caseTag={caseTag}
          statements={dialogStatements}
          statementsColumnLabel="임원이 한 말(02 의견 + 04 반응)"
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </>
  );
}
