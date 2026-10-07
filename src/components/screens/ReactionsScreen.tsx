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
// T89(2026-10-07 사용자 지시 "반응에 답하기에서도 내 의견에서와 마찬가지로 선택할 수
// 있도록"): 추천 답변도 DISCUSS(T87)와 같은 구조로 바뀌었다 — 입장(찬성 쪽/반대 쪽)을
// 먼저 고르고, 그 쪽(+BOTH)의 추천 답변만 체크 카드로 보여준다(FollowUpOption.side).
// 입장 state(side·onChooseSide)는 App.tsx StageRouter가 들고 DiscussScreen과 함께
// 내려준다 — DISCUSS에서 고른 쪽이 기본값으로 이어지고 여기서 바꿀 수도 있다(바꾸면
// 체크된 답변은 해제, handleChooseSide). T84 #23이 "(앞서 제안함)" 잠금 표시로 두던
// "이미 확정된 조건을 다시 제안하는 옵션"은 이제 완전히 숨긴다 — 그 역할은 보조 버튼
// "답하지 않고 넘어가기"로 충분하다(keepPrevious 옵션도 데이터에서 아예 뺐다).
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
import { SHORT_STANCE_LABEL, STANCE_LABEL } from '../moodLabel';
import { changeCauseLabel, reactionsFor, oppositionReactionText, resolveFollowUpPrompt } from '../reactionsFor';
import { scriptedStances } from '../../domain/stance';
import type { RoundLogEntry } from '../minutes';
import { DraftEditor } from '../parts/DraftEditor';
import { PhraseCard } from '../parts/PhraseCard';
import { RebuildConfirm } from '../parts/RebuildConfirm';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import { LiveStatementCards } from '../parts/LiveStatementCards';
import { EvidenceDialog, type EvidenceDialogStatementView } from '../parts/EvidenceDialog';
import { GuideHint } from '../parts/GuideHint';
import { PersuasionBoard } from '../parts/PersuasionBoard';
// T89 "다시 답하기"(2/2)는 DiscussScreen과 같은 종이·입장 선택·문구 그리드 CSS를
// 그대로 재사용한다(discuss-screen__paper 등) — 사용자 지시 "내 의견과 동일한 구성".
import '../../styles/screens/discuss.css';
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
  /** 입장 선택(T89, 사용자 지시 "반응에 답하기에서도 내 의견에서와 마찬가지로 선택할
   * 수 있도록") — App.tsx StageRouter의 state를 DiscussScreen과 공유한다. DISCUSS에서
   * 고른 쪽이 기본값으로 이어지고, 여기서 바꿀 수도 있다. */
  side: 'FOR' | 'AGAINST' | null;
  onChooseSide: (next: 'FOR' | 'AGAINST') => void;
  /** REACTIONS 서브스텝(T89, 사용자 지시 "임원들의 의견을 듣고 다시 답하는 화면을
   * 만들어서") — App.tsx StageRouter의 state. 'listen'(반응 듣기)에서는 임원 반응
   * 카드만 크게 보여주고, 'answer'(다시 답하기)에서만 입장 선택·추천 답변·입력창을
   * 보여준다. 도메인 session.stage는 두 서브스텝 모두 REACTIONS다. */
  step: 'listen' | 'answer';
  /** "답하기 ▶"를 눌러 'listen' → 'answer'로 넘어간다(뒤로가기는 없다). */
  onAdvanceStep: () => void;
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
  side,
  onChooseSide,
  step,
  onAdvanceStep,
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
  // T93(2026-10-07 사용자 지시 "추가 질문도 찬성을 고려해서 질문한다"): 결재권을 준다는
  // 전제의 질문이 반대 참가자에게 어색했다 — 참가자의 최근 입장(lastOpinion.stance)에 따라
  // FOR/AGAINST 질문을 고른다. 질문과 추천 답변이 어긋나면 안 되므로(PR #20 Codex 20차
  // 검토 P2 — "다시 답하기"에서 입장을 바꾸면 반대용 답변이 찬성 질문 아래 나왔다) 지금
  // 고른 입장(side)이 있으면 그것을, 없으면 참가자의 최근 입장(lastOpinion.stance)을 쓴다.
  const followUpPrompt = useMemo(
    () => resolveFollowUpPrompt(scenario, side ?? lastOpinion?.stance ?? null),
    [scenario, side, lastOpinion],
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

  // "반응 듣기"(T89) → "다시 답하기" 전환 잠금: live에서 임원 네 명이 모두 REACTIONS
  // 라운드에 답하거나(answered) 실패로 끝날 때까지(failed) "답하기 ▶"를 잠근다
  // (OpinionsScreen의 allExecsSettled와 같은 규칙). scripted는 반응 문구가 항상 즉시
  // 다 있으므로 영향받지 않는다.
  // roleStatus만 보면 안 된다 — live에서 REACTIONS에 막 들어온 첫 프레임에는 직전 OPINIONS
  // 라운드의 answered/failed가 그대로 남아 있어 반응이 하나도 안 왔는데 잠금이 풀린다
  // (PR #20 Codex 15차 검토 P2). 그 역할의 REACTIONS 발언이 실제로 도착했거나, roundLog에
  // REACTIONS 단계 failed가 기록된 경우만 "끝난 것"으로 본다.
  const allExecsSettled = EXEC_MEMBER_ORDER.every(
    (roleId) =>
      statements.some((statement) => statement.stage === 'REACTIONS' && statement.roleId === roleId) ||
      roundLog.some(
        (entry) => entry.stage === 'REACTIONS' && entry.roleId === roleId && entry.status === 'failed',
      ),
  );
  const listenLocked = mode === 'live' && !allExecsSettled;

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

  // 입장을 바꾸면 체크된 추천 답변은 해제한다(DiscussScreen.handleChooseSide와 같은
  // 규칙, T89). 직접 쓴 답(dirty)은 텍스트를 그대로 두고 체크만 뗀다. RebuildConfirm이
  // 뜬 동안 입장을 바꾸면 그 대기 선택(pendingOptionIndex)도 함께 취소한다(PR #20 Codex
  // 7차 검토와 같은 이유 — 남겨 두면 확인 뒤 이전 입장의 숨은 옵션이 다시 선택된다).
  function handleChooseSide(next: 'FOR' | 'AGAINST') {
    if (side === next) {
      return;
    }
    onChooseSide(next);
    setPendingOptionIndex(null);
    if (selectedOptionIds.length === 0) {
      return;
    }
    if (dirty) {
      setSelectedOptionIds([]);
      return;
    }
    setSelectedOptionIds([]);
    setTextValue(composeText([]));
    setDraftRevision((value) => value + 1);
  }

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
    if (!option || option.keepPrevious) {
      // keepPrevious 옵션은 더 이상 체크 카드로 그리지 않는다(T84 #1 참고) — 여기
      // 걸릴 일은 없지만, 혹시 인덱스가 섞여도 조합을 깨지 않도록 조용히 막는다.
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

  // "답하지 않고 넘어가기"(T84 #1) — 옛 "앞서 전달한 의견을 유지하겠습니다" 체크
  // 카드와 같은 동작(onKeepPrevious 즉시 호출)이지만, 이제 "답변 전달 ▶" 옆 보조
  // 버튼이다. 같은 모양의 다른 카드처럼 "골라서 붙는" 동작으로 보여 실수로 눌러
  // 직접 쓴 답을 버리는 일을 막는다. RebuildConfirm이 뜬 동안은 PR #12 Codex 5차
  // 검토 P2와 같은 이유로 막는다.
  function handleKeepPrevious() {
    if (pendingOptionIndex !== null) {
      return;
    }
    onKeepPrevious();
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
      const opposition = oppositionReactionText(
        scenario,
        memberId,
        lastOpinion?.stance ?? null,
        previousConfirmedIds,
      );
      // 순수 반대(조건 없음) 전용 문구가 있으면 "none" 기본 반응(모든 입장에 같이
      // 쓰이던 "말씀은 기록했습니다")보다 우선한다 — 조건이 있으면(조건 기반 반응)
      // 그대로 조건 반응이 우선이다(opposition은 그 경우 undefined).
      const reactionText =
        opposition ??
        (reactions.length > 0
          ? reactions.map((reaction) => reaction.text).join(' ')
          : scenario.holdReasons?.[memberId] ?? '앞서 말씀드린 입장 그대로입니다.');
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
  }, [mode, roleStatus, statements, roundLog, stances, scenario, previousConfirmedIds, scriptedBaselineStances, lastOpinion]);

  // "반응 듣기"(T89 1/2): 왼쪽 열은 OPINIONS와 같은 모양의 단일 CTA 줄(+보조 "답하지
  // 않고 넘어가기")뿐이고, 발언 흐름(MinutesPanel)은 App.tsx AppShell이 OPINIONS와
  // 같은 규칙으로 보여준다(reactionsStep). 오른쪽 종이는 임원 반응 카드 4장(공간이
  // 남아 4줄 클램프를 풀고 전문 표시) + 추가 질문 상자만 크게 보여주고, 추천 답변·
  // 입력창은 여기 없다(2/2로 미룬다).
  // 설득 현황판(T96)이 쓰는 참가자 입장 — followUpPrompt와 같은 규칙으로 지금 고른
  // 쪽(side)이 있으면 그것을, 없으면 참가자의 최근 의견 입장을 쓴다.
  const boardParticipantStance = side ?? lastOpinion?.stance ?? null;

  if (step === 'listen') {
    return (
      <>
        <div className="app-body__actions screen reactions-screen reactions-screen--listen">
          <PersuasionBoard
            scenario={scenario}
            confirmedConditionIds={previousConfirmedIds}
            participantStance={boardParticipantStance}
            stances={stances}
            mode={mode}
          />
          <button
            type="button"
            className="cta"
            onClick={onAdvanceStep}
            disabled={listenLocked}
            data-testid="reactions-advance"
            data-guide={!listenLocked ? 'next' : undefined}
          >
            {listenLocked ? '임원 반응을 듣는 중…' : '답하기 ▶'}
          </button>
          <button
            type="button"
            className="cta cta--secondary"
            onClick={handleKeepPrevious}
            data-testid="keep-previous-answer"
          >
            답하지 않고 넘어가기
          </button>
        </div>
        <div className="app-body__content screen reactions-screen__info" data-testid="reactions-info">
          <div className="reactions-screen__paper">
            <div className="reactions-screen__head">
              <span className="reactions-screen__step">4단계 · 1/2 반응 듣기</span>
              {/* 기존 heading 문구는 그대로 둔다 — 다수의 e2e가 이 문구를 "REACTIONS
                  진입" 신호로 쓴다. */}
              <h2 className="reactions-screen__title">
                이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다
              </h2>
            </div>
            {!listenLocked && (
              <GuideHint text="임원들의 반응을 읽고 답해 보세요" testId="reactions-listen-guide-hint" />
            )}
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
                  const opposition = oppositionReactionText(
                    scenario,
                    memberId,
                    lastOpinion?.stance ?? null,
                    previousConfirmedIds,
                  );
                  const baseline = scriptedBaselineStances[memberId];
                  const stance = stances[memberId];
                  const changed = baseline !== stance;
                  // T96: "바뀜"만 보여주던 배지를 "반대 → 찬성"처럼 전후 입장으로 바꾼다
                  // (사용자 지시 "내 발언에 따라 임원 입장이 변하는 것이 잘 보이게"). 조건
                  // 없이 입장이 바뀐 경우(opposition 응답)는 조건을 원인으로 쓰면 안 되므로
                  // 원인 한 줄을 보여주지 않는다.
                  const badgeText = changed
                    ? `${SHORT_STANCE_LABEL[baseline]} → ${SHORT_STANCE_LABEL[stance]}`
                    : '유지';
                  const causeText =
                    changed && !opposition ? changeCauseLabel(scenario, reactions) : null;
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
                        <span className="reaction-card__badge" aria-hidden="true" data-testid={`reaction-card-badge-${memberId}`}>
                          {badgeText}
                        </span>
                      </div>
                      <p className="reaction-card__text reaction-card__text--full">
                        {opposition ??
                          (reactions.length > 0
                            ? reactions.map((reaction) => reaction.text).join(' ')
                            : scenario.holdReasons?.[memberId] ?? '앞서 말씀드린 입장 그대로입니다.')}
                      </p>
                      {causeText && (
                        <p
                          className="reaction-card__cause"
                          data-testid={`reaction-card-cause-${memberId}`}
                        >
                          {causeText}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <div className="reactions-screen__followup" data-testid="followup-question">
              <span className="reactions-screen__followup-label">
                추가 질문 · {followUpPrompt.askedBy}가 묻습니다
              </span>
              <p className="reactions-screen__followup-text">{followUpPrompt.question}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // "다시 답하기"(T89 2/2): DiscussScreen과 같은 구성 — 왼쪽 열은 무대 + 내 답변
  // 편집기(discuss-screen__hud와 같은 모양) + [AI 비서실장에게 맡기기][답하지 않고
  // 넘어가기][답변 전달 ▶], 오른쪽 종이는 질문 한 줄 + 입장 선택 + 그 쪽(+BOTH)
  // 추천 답변 그리드 + 근거 자료 버튼이다. 레이아웃·CSS는 discuss.css의
  // discuss-screen__paper·head·step·title·phrase-hint·guide·phrase-list·
  // evidence-row 클래스를 그대로 재사용한다(최대한 공유, 사용자 지시).
  return (
    <>
      <div className="app-body__actions screen reactions-screen">
        <PersuasionBoard
          scenario={scenario}
          confirmedConditionIds={previousConfirmedIds}
          participantStance={boardParticipantStance}
          stances={stances}
          mode={mode}
        />
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
            className="cta cta--secondary reactions-screen__keep-previous"
            disabled={pendingOptionIndex !== null}
            onClick={handleKeepPrevious}
            data-testid="keep-previous-answer"
          >
            답하지 않고 넘어가기
          </button>
          <button
            type="button"
            className="cta"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="submit-followup"
            data-guide={canSubmit ? 'next' : undefined}
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
        {/* DiscussScreen과 같은 종이·머리·입장 선택·문구 그리드(T89 사용자 지시
            "내 의견과 동일한 구성") — discuss.css 클래스를 그대로 재사용한다. */}
        <div className="discuss-screen__paper">
          <div className="discuss-screen__head">
            <span className="discuss-screen__step">4단계 · 2/2 다시 답하기</span>
            <h2 className="discuss-screen__title">다시 답하기</h2>
            <span className="discuss-screen__phrase-hint">추천 답변 · 여러 개 선택 가능</span>
          </div>
          <p className="discuss-screen__guide" data-testid="followup-question">
            {followUpPrompt.askedBy}가 묻습니다 · {followUpPrompt.question}
          </p>
          {/* 입장 선택(T89) — DISCUSS와 같은 두 버튼을 공용 .side-select*(shell.css)로
              쓴다. 기본값은 App.tsx가 DISCUSS에서 고른 쪽을 그대로 내려준 side다. */}
          <div
            className="side-select"
            data-testid="reactions-side-select"
            data-guide={side === null ? 'next' : undefined}
          >
            <button
              type="button"
              className="cta cta--secondary side-select__btn"
              aria-pressed={side === 'FOR'}
              onClick={() => handleChooseSide('FOR')}
              data-testid="reactions-side-for"
            >
              찬성 쪽에서 말하기
            </button>
            <button
              type="button"
              className="cta cta--secondary side-select__btn"
              aria-pressed={side === 'AGAINST'}
              onClick={() => handleChooseSide('AGAINST')}
              data-testid="reactions-side-against"
            >
              반대 쪽에서 말하기
            </button>
            <span className="side-select__hint">표결은 마지막에 따로 합니다</span>
          </div>
          {side === null ? (
            <p className="side-select__guide" data-testid="reactions-side-guide">
              먼저 입장을 골라 주세요. 직접 써도 됩니다.
            </p>
          ) : (
            <>
              {textValue.trim() === '' && (
                <GuideHint text="문구를 고르거나 직접 써 주세요" testId="reactions-guide-hint" />
              )}
              <div
                className="discuss-screen__phrase-list"
                data-guide={textValue.trim() === '' ? 'next' : undefined}
              >
              {scenario.followUp.options.map((option, index) => {
                // keepPrevious 카드는 더 이상 여기 그리지 않는다(T84 #1) — 보조 버튼
                // "답하지 않고 넘어가기"로 옮겼다.
                if (option.keepPrevious) {
                  return null;
                }
                // 고른 입장(+BOTH)만 보인다(T89, DiscussScreen의 Phrase.side 필터와
                // 같은 규칙). 값이 없는 과거 옵션(anonBoard·aiAssistant)은 'FOR'로 본다.
                const optionSide = option.side ?? 'FOR';
                if (optionSide !== 'BOTH' && optionSide !== side) {
                  return null;
                }
                // 이미 확정된 조건을 다시 제안하는 카드도 그대로 보여 준다(T89 리드 확인 —
                // 숨기면 찬성 쪽 카드가 1~2장만 남아 빈 그리드가 된다; 다시 골라도 조건 칩은
                // "기존 확정"으로 표시될 뿐 새 조건이 생기지 않아 무해하다). T84 #23의
                // "(앞서 제안함)" 잠금 표시는 쓰지 않는다.
                return (
                  <PhraseCard
                    key={index}
                    phrase={{ id: String(index), text: option.text }}
                    selected={selectedOptionIds.includes(String(index))}
                    onToggle={() => handleToggleOption(index)}
                    testId={`followup-option-${index}`}
                    disabled={pendingOptionIndex !== null}
                  />
                );
              })}
              </div>
            </>
          )}
          <div className="discuss-screen__evidence-row">
            <button
              type="button"
              className="cta cta--secondary"
              onClick={() => setEvidenceOpen(true)}
              data-testid="open-evidence"
            >
              근거 자료 · 임원 발언 보기
            </button>
            <span className="evidence-open-hint">자료 4장 + 임원 발언 4건</span>
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
