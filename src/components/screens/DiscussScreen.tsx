// 의견 작성 화면: 추천 문구 체크박스 + 직접 입력 textarea + 제안 조건 칩을 하나의
// draftText로 모아 '의견 전달'로 SUBMIT_OPINION을 낸다(CLAUDE_IMPLEMENTATION.md 4장).
// selectedPhraseIds와 draftText를 분리하고, 실제 제출값은 항상 화면에 보이는
// draftText다. 편집 손실 방지 규칙(직접 수정 후 체크 변경 시 확인)과 조건 제안·충돌
// 판정은 모두 src/domain의 순수 함수(draft.ts, conditions.ts)에 위임한다. T12에서
// AssistantPanel(선택적으로 여는 AI 비서실장 사이드 패널)을 붙였다. T31에서 draftRevision
// (직접 입력·적용마다 늘어나는 값)과 transcript(의견 한눈에 보기 live 요청·실패 fallback)를
// AssistantPanel에 추가로 넘긴다.
// T73(docs/design/mockups/S3_Discuss.html·S3b_Discuss_Evidence.html 시안 그대로): 왼쪽
// 열은 무대(StageBand, App.tsx가 그린다) 아래 HUD 입력 상자(discuss-screen__hud —
// "MY STATEMENT" 머리줄 + textarea + "CONDITIONS" 칩 줄을 하나의 패널로 묶는다) +
// 버튼 줄([AI 비서실장 열기][의견 전달])이다. 오른쪽 열은 종이 한 장(STEP 03 + 추천
// 문구 2×3 + 근거 자료·임원 발언 버튼 + STANCE 칩 4개)이고, 예전에 상시 보이던 임원
// 첫 의견 카드 2×2는 빠졌다 — 그 내용(live면 transcript의 OPINIONS 발언, scripted면
// initialOpinions)은 EvidenceDialog 팝업의 STATEMENTS 열로 옮겼다(BRIEFING과 같은
// 컴포넌트를 함께 쓴다).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { RoleStatus, SessionMode, Stance, Transcript } from '../../domain/types';
import {
  EMPTY_DRAFT_STATE,
  buildDraftText,
  editText,
  isSubmittable,
  resolveConfirm,
  togglePhrase,
} from '../../domain/draft';
import {
  confirmConditions,
  findConflicts,
  proposeFromPhrases,
  proposeFromText,
} from '../../domain/conditions';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import {
  ASSISTANT_FEATURE_ORDER,
  assistantFeaturesUsed,
  type AssistantActionEvent,
} from '../../domain/assistantLog';
import type { AssistantAdapter } from '../../services/assistant/types';
import { PhraseCard } from '../parts/PhraseCard';
import { DraftEditor } from '../parts/DraftEditor';
import { RebuildConfirm } from '../parts/RebuildConfirm';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import { EvidenceDialog, type EvidenceDialogStatementView } from '../parts/EvidenceDialog';
import { PersuasionBoard } from '../parts/PersuasionBoard';
import { findPhraseForCondition } from '../recommendMatch';
import { STANCE_LABEL } from '../moodLabel';
import '../../styles/screens/discuss.css';

export interface DiscussSubmitPayload {
  originalText: string;
  selectedPhraseIds: string[];
  confirmedConditionIds: string[];
}

export interface DiscussScreenProps {
  scenario: Scenario;
  sessionId: string;
  /** AI 비서실장 '의견 한눈에 보기'(live)가 근거로 삼는 실제 회의 기록이자, 근거 자료
   * 팝업의 STATEMENTS 열(live)이 보여줄 02 임원 의견 발언의 원천이다. */
  transcript: Transcript;
  /** live/scripted 중 App.tsx가 session.mode로 고른 진행 방식. STATEMENTS 열 본문을
   * 실제 발언(live)으로 보여줄지 각본 문장(scripted)으로 보여줄지 가른다. */
  mode: SessionMode;
  /** live 모드에서 임원별 OPINIONS 라운드 응답 상태(아직 응답 전/실패 포함). */
  roleStatus: Record<ExecMemberId, RoleStatus>;
  /** 무대 표정 배지의 접근 가능한 대응 텍스트(T63)이자 오른쪽 열 STANCE 칩의 근거다. */
  stances: Record<ExecMemberId, Stance>;
  /** 입장 선택(T87→T89, App.tsx StageRouter의 state로 올렸다) — REACTIONS까지 이어지는
   * 기본값이라 이 화면 로컬 state가 아니라 부모가 들고 내려준다. */
  side: 'FOR' | 'AGAINST' | null;
  onChooseSide: (next: 'FOR' | 'AGAINST') => void;
  onSubmit: (payload: DiscussSubmitPayload) => void;
  /** 이번 세션의 AI 비서실장 사용 기록(session.assistantActions). 세 기능을 한 번씩
   * 써 봤는지 판정해 '의견 전달'을 여는 데 쓴다(T97). */
  assistantActions?: readonly string[];
  /** AI 비서실장 결과가 실제로 표시·적용됐을 때만 호출된다(세션 기록용). */
  onAssistantAction: (event: AssistantActionEvent) => void;
  /** live/scripted 중 App.tsx가 session.mode로 고른 비서실장 어댑터. */
  assistantAdapter?: AssistantAdapter;
}

/** STANCE 칩 왼쪽 띠·글자색에 쓰는 소문자 modifier(OpinionsScreen의 STANCE_MODIFIER와
 * 같은 값). */
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
 * (OpinionsScreen.lastEvidenceLabel과 같은 규칙). */
function lastEvidenceLabel(scenario: Scenario, evidenceIds: string[]): string | null {
  const lastId = evidenceIds[evidenceIds.length - 1];
  if (!lastId) {
    return null;
  }
  const card = scenario.evidence.find((item) => item.id === lastId);
  return card ? card.title : lastId;
}

export function DiscussScreen({
  scenario,
  sessionId,
  transcript,
  mode,
  roleStatus,
  stances,
  side,
  onChooseSide,
  onSubmit,
  onAssistantAction,
  assistantActions = [],
  assistantAdapter,
}: DiscussScreenProps) {
  const [draft, setDraft] = useState(EMPTY_DRAFT_STATE);
  const [pendingPhraseId, setPendingPhraseId] = useState<string | null>(null);
  const [assistantCloseRequest, setAssistantCloseRequest] = useState(0);
  const [pendingBatch, setPendingBatch] = useState<{ phraseId: string; conditionId: string | null }[] | null>(null);
  // AI 비서실장 드로어가 열린 동안 오른쪽 열(추천 문구·근거 자료 버튼·STANCE 칩)은
  // 시각적으로 가려지지만 포커스 대상에서는 빠지지 않아 Tab으로 숨은 "근거 자료 보기"에
  // 닿을 수 있었다(PR #11 Codex 31차). 드로어가 열려 있으면 열 전체에 inert를 걸어
  // 포커스·클릭을 막는다.
  const [assistantOpen, setAssistantOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const handleAssistantOpenChange = useCallback((open: boolean) => setAssistantOpen(open), []);
  useEffect(() => {
    infoRef.current?.toggleAttribute('inert', assistantOpen);
  }, [assistantOpen]);
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  // draftText가 바뀔 때마다(직접 입력·AI 초안 적용 모두) 늘려 AssistantPanel이 "입력이
  // 바뀌면 이전 초안을 폐기한다"를 판단하는 기준으로 쓴다.
  const [draftRevision, setDraftRevision] = useState(0);

  const phraseConditionIds = useMemo(
    () => proposeFromPhrases(scenario, draft.selectedPhraseIds),
    [scenario, draft.selectedPhraseIds],
  );
  const textConditionIds = useMemo(
    () => proposeFromText(scenario, draft.draftText),
    [scenario, draft.draftText],
  );
  const proposedConditionIds = useMemo(
    () => uniqueInOrder([...phraseConditionIds, ...textConditionIds]),
    [phraseConditionIds, textConditionIds],
  );

  // 추천 문구에 딸려 온 조건은 미리 확인된 것으로 보여주고(4장 "추천 문구를 수정하지
  // 않고 보낼 때는 문구에 정의된 조건을 미리 보여주고 같은 전달 버튼으로 확인한다"),
  // 더 이상 제안되지 않는 조건은 목록에서 뺀다. 자유 입력에서만 찾은 조건은 참가자가
  // 칩을 눌러야 확인된다.
  useEffect(() => {
    setAcceptedConditionIds((previous) => {
      const stillProposed = previous.filter((id) => proposedConditionIds.includes(id));
      const autoAccepted = phraseConditionIds.filter((id) => !stillProposed.includes(id));
      return uniqueInOrder([...stillProposed, ...autoAccepted]);
    });
  }, [proposedConditionIds, phraseConditionIds]);

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

  const showNoMatchHint = draft.draftText.trim() !== '' && proposedConditionIds.length === 0;
  // T97(2026-10-08 사용자 지시): 추천 문구 선택 → AI 비서실장 세 기능 한 번씩 → 의견
  // 전달 순서. 실패·연결 지연 안내를 본 것도 사용으로 센다(assistantFeaturesUsed).
  const assistantUsed = useMemo(
    () => assistantFeaturesUsed(assistantActions, 'DISCUSS'),
    [assistantActions],
  );
  const assistantDone = assistantUsed.size >= ASSISTANT_FEATURE_ORDER.length;
  // PR #20 Codex 35차 P2-1: 입장을 고르지 않고 직접 쓴 글로 순서를 건너뛰지 못하게 입장 선택을
  // 문구 준비(비서실장 잠금·전달)의 전제로 둔다.
  const draftReady = side !== null && pendingPhraseId === null && isSubmittable(draft);
  const canSubmit = draftReady && assistantDone;

  // 근거 자료 팝업의 STATEMENTS 열(T73). live면 transcript의 OPINIONS 발언(DISCUSS는
  // 그 라운드가 끝난 뒤 화면이라 OpinionsScreen·LiveStatementCards와 같은 근거다),
  // scripted면 scenario.initialOpinions 각본 문장이다.
  const dialogStatements = useMemo<EvidenceDialogStatementView[]>(() => {
    if (mode === 'live') {
      return EXEC_MEMBER_ORDER.map((memberId) => {
        const status = roleStatus[memberId];
        const statement = transcript.statements.find(
          (item) => item.roleId === memberId && item.stage === 'OPINIONS',
        );
        if (status === 'answered' && statement) {
          return {
            memberId,
            stance: stances[memberId],
            status: 'answered' as const,
            text: statement.text,
            evidenceLabel: lastEvidenceLabel(scenario, statement.evidenceIds),
            testable: true,
          };
        }
        return {
          memberId,
          stance: stances[memberId],
          status: status === 'failed' ? ('failed' as const) : ('pending' as const),
          text: '',
          evidenceLabel: null,
          testable: true,
        };
      });
    }
    return scenario.initialOpinions.map((opinion) => ({
      memberId: opinion.memberId,
      stance: stances[opinion.memberId],
      status: 'answered' as const,
      text: opinion.text,
      evidenceLabel: lastEvidenceLabel(scenario, opinion.evidenceIds),
      testable: false,
    }));
  }, [mode, roleStatus, transcript, stances, scenario]);

  // 사건 칩(시안 "CASE 02", T83에서 한국어화): scenario.incident.caseLabel이 이미
  // "사건 02" 형식이라 그대로 쓴다(ResultScreen·BriefingScreen도 같다).
  const caseTag = scenario.incident.caseLabel;

  // 입장을 바꾸면 체크된 추천 문구는 해제한다(다른 입장의 문구가 섞여 보이면 안
  // 되므로). 직접 쓴 글(dirty)은 가장 단순한 규칙대로 텍스트는 그대로 두고 체크만
  // 뗀다 — RebuildConfirm의 '직접 쓴 내용 유지'와 같은 생각이다.
  // PR #20 Codex 7차 검토 P2: 입장을 바꿀 때 (1) RebuildConfirm이 열려 있으면 그 대기
  // 선택(pendingPhraseId)도 취소한다 — 남겨 두면 확인 뒤 이전 입장의 숨은 문구가 다시
  // 선택된다; (2) 초안 텍스트가 바뀌는 경우 draftRevision을 올려 비서실장의 오래된 정리
  // 결과가 새 초안에 적용되지 않게 한다.
  function handleChooseSide(next: 'FOR' | 'AGAINST') {
    if (side === next) {
      return;
    }
    onChooseSide(next);
    setPendingPhraseId(null);
    setPendingBatch(null);
    if (draft.selectedPhraseIds.length === 0) {
      return;
    }
    if (draft.dirty) {
      setDraft({ ...draft, selectedPhraseIds: [] });
      return;
    }
    setDraft({ selectedPhraseIds: [], draftText: buildDraftText(scenario, []), dirty: false });
    setDraftRevision((value) => value + 1);
  }

  /** true면 즉시 적용됨, false면 RebuildConfirm 확인 대기(Codex 27차 검토 P2-3 —
   * handleRecommendCondition이 이 값으로 "실제로 반영됐는지"를 가른다). */
  function handleTogglePhrase(phraseId: string): boolean {
    // PR #20 Codex 37차 검토 P2: RebuildConfirm이 뜬 동안(pendingPhraseId !== null)은 다른 문구를
    // 잠근다 — 묶음(pendingBatch) 확인 중에 다른 문구를 누르면 pendingPhraseId만 바뀌고 묶음이
    // 우선 반영돼 마지막에 누른 문구가 무시됐다. REACTIONS(handleToggleOption)와 같은 가드.
    if (pendingPhraseId !== null) {
      return false;
    }
    const result = togglePhrase(draft, scenario, phraseId);
    if (result.kind === 'applied') {
      setDraft(result.state);
      setDraftRevision((value) => value + 1);
      return true;
    }
    setPendingPhraseId(result.pendingPhraseId);
    return false;
  }

  // 확인 대기 중인 추천 묶음(PR #20 Codex 30차 P2-2) — 직접 쓴 내용이 있을 때 묶음
  // "모두 적용"은 확인 UI를 먼저 띄우므로, 묶음 전체를 보존했다가 승인 시 한 번에 반영한다.
  // 추천이 아닌 일반 문구 선택(handleTogglePhrase)은 단일 pendingPhraseId만 쓴다.
  function resolvePending(choice: 'keep' | 'rebuild') {
    if (pendingPhraseId === null) {
      return;
    }
    const batch = pendingBatch ?? [{ phraseId: pendingPhraseId, conditionId: null }];
    let state = draft;
    for (const item of batch) {
      state = resolveConfirm(state, scenario, item.phraseId, choice);
    }
    setDraft(state);
    setDraftRevision((value) => value + 1);
    setPendingPhraseId(null);
    setPendingBatch(null);
    // DISCUSS는 직접 쓴 글(dirty)이어도 선택 문구의 조건이 제안에 들어가므로(phraseConditionIds)
    // 유지·다시 구성 모두 실제 확정된 조건을 기록한다(PR #20 Codex 32차 P2-1).
    for (const item of batch) {
      if (item.conditionId !== null) {
        onAssistantAction({ type: 'CONDITION_RECOMMEND_APPLY', mode, evidenceIds: [item.conditionId] });
      }
    }
  }

  function handleKeep() {
    resolvePending('keep');
  }

  function handleRebuild() {
    resolvePending('rebuild');
  }

  function handleDraftTextChange(text: string) {
    setDraft(editText(draft, text).state);
    setDraftRevision((value) => value + 1);
  }

  function handleToggleCondition(conditionId: string) {
    setAcceptedConditionIds((previous) =>
      previous.includes(conditionId)
        ? previous.filter((id) => id !== conditionId)
        : [...previous, conditionId],
    );
  }

  // AI 비서실장 "조건 추천"의 "적용"(T96) — 그 조건과 연결된 추천 문구를 체크한다.
  // 이미 그 조건으로 체크된 문구가 있으면(재적용) 아무것도 하지 않는다. 입장을 아직
  // 고르지 않았으면 'FOR' 쪽 문구를 기본으로 삼는다(PersuasionBoard·AssistantPanel의
  // 기본 설득 목표와 같다).
  // 표시 검사와 실행 검사가 같은 인자(현재 선택 목록)를 쓴다(PR #20 Codex 31차 P2-3). 이미
  // 확정된 조건은 적용된 상태이므로 버튼을 그대로 둔다.
  function canApplyRecommendation(conditionId: string): boolean {
    return (
      confirmedConditionIds.includes(conditionId) ||
      findPhraseForCondition(scenario, conditionId, side, draft.selectedPhraseIds) !== undefined
    );
  }

  function handleRecommendCondition(conditionId: string): boolean {
    return handleRecommendConditions([conditionId]).length > 0;
  }

  // 묶음 "모두 적용"(PR #20 Codex 28차 P2-1) — 조건마다 setDraft를 따로 부르면 모두 같은
  // 렌더의 draft에서 새 상태를 만들어 뒤 호출이 앞 호출을 덮어쓴다. 갱신된 상태를 다음
  // 조건 처리에 넘기며 로컬에서 접어 한 번만 반영하고, 실제로 반영된 조건 id를 돌려준다.
  function handleRecommendConditions(conditionIds: string[]): string[] {
    if (pendingPhraseId !== null) {
      return [];
    }
    if (draft.dirty) {
      // 직접 쓴 내용이 있으면 확인 UI를 먼저 띄운다. 묶음 전체를 보존해 승인 시 한 번에
      // 반영하고, 그때 기록한다(지금은 아직 반영되지 않았으므로 빈 목록).
      const batch: { phraseId: string; conditionId: string }[] = [];
      for (const conditionId of conditionIds) {
        const phrase = findPhraseForCondition(
          scenario,
          conditionId,
          side,
          [...draft.selectedPhraseIds, ...batch.map((item) => item.phraseId)],
        );
        if (phrase) {
          batch.push({ phraseId: phrase.id, conditionId });
        }
      }
      const first = batch[0];
      if (first) {
        setPendingBatch(batch);
        setPendingPhraseId(first.phraseId);
        setAssistantCloseRequest((value) => value + 1);
      }
      return [];
    }
    let state = draft;
    const appliedIds: string[] = [];
    for (const conditionId of conditionIds) {
      const phrase = findPhraseForCondition(scenario, conditionId, side, state.selectedPhraseIds);
      if (!phrase) {
        continue;
      }
      const result = togglePhrase(state, scenario, phrase.id);
      if (result.kind === 'applied') {
        state = result.state;
        appliedIds.push(conditionId);
      }
    }
    if (appliedIds.length > 0) {
      setDraft(state);
      setDraftRevision((value) => value + 1);
    }
    return appliedIds;
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    onSubmit({
      originalText: draft.draftText,
      selectedPhraseIds: draft.selectedPhraseIds,
      confirmedConditionIds,
    });
  }

  return (
    <>
      <div className="app-body__actions screen discuss-screen">
        <PersuasionBoard
          scenario={scenario}
          confirmedConditionIds={[]}
          participantStance={side}
          stances={stances}
          mode={mode}
          statements={transcript.statements}
        />
        {pendingPhraseId !== null && (
          <RebuildConfirm onKeep={handleKeep} onRebuild={handleRebuild} />
        )}
        <div className="discuss-screen__hud" data-testid="discuss-hud">
          <DraftEditor value={draft.draftText} onChange={handleDraftTextChange} />
          <ConditionChips
            scenario={scenario}
            proposedIds={proposedConditionIds}
            acceptedIds={acceptedConditionIds}
            conflictPairs={conflictPairs}
            showNoMatchHint={showNoMatchHint}
            onToggle={handleToggleCondition}
          />
        </div>
        <div className="discuss-screen__submit-row screen__submit-row">
          <AssistantPanel
            scenario={scenario}
            sessionId={sessionId}
            selectedConditionIds={confirmedConditionIds}
            participantStance={side}
            mode={mode}
            stances={stances}
            onRecommendCondition={handleRecommendCondition}
            onRecommendConditions={handleRecommendConditions}
            canApplyCondition={canApplyRecommendation}
            closeRequest={assistantCloseRequest}
            draftText={draft.draftText}
            draftRevision={draftRevision}
            transcript={transcript}
            onApplyDraft={handleDraftTextChange}
            onAssistantAction={onAssistantAction}
            requiredFeatures={{ used: assistantUsed }}
            toggleLocked={!draftReady}
            toggleLockedHint={side === null ? '먼저 입장을 골라 주세요' : undefined}
            onOpenChange={handleAssistantOpenChange}
            adapter={assistantAdapter}
          />
          <button
            type="button"
            className="cta"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="submit-opinion"
            aria-describedby={!canSubmit ? 'discuss-submit-why' : undefined}
          >
            의견 전달 ▶
          </button>
          {!canSubmit && (
            <span id="discuss-submit-why" className="sr-only" data-testid="discuss-cta-hint">
              {side === null
                ? '먼저 입장을 골라 주세요'
                : draftReady
                ? `AI 비서실장을 먼저 써 보세요 (${assistantUsed.size}/${ASSISTANT_FEATURE_ORDER.length})`
                : '추천 문구를 고르거나 직접 써 주세요'}
            </span>
          )}
        </div>
      </div>
      <div
        className="app-body__content screen discuss-screen__info"
        ref={infoRef}
        data-testid="discuss-info"
      >
        <div className="discuss-screen__paper">
          <div className="discuss-screen__head">
            <span className="discuss-screen__step">3단계</span>
            {/* 시안 원본은 <h1>이지만, 이 화면은 ATTRACT의 페이지 <h1>("BOARDROOM 2026")
                아래 중첩되는 화면 제목이라 다른 조종석 화면과 같은 <h2> 위계를 쓴다 —
                글자 크기·굵기는 시안 값 그대로다. */}
            <h2 className="discuss-screen__title">내 의견 쓰기</h2>
            <span className="discuss-screen__phrase-hint">추천 문구 · 여러 개 선택 가능</span>
          </div>
          <p className="discuss-screen__guide">
            문구를 고르면 왼쪽 내 발언에 이어 붙습니다. 직접 고쳐 써도 됩니다.
          </p>
          <div
            className="side-select"
            data-testid="discuss-side-select"
          >
            <button
              type="button"
              className="cta cta--secondary side-select__btn"
              aria-pressed={side === 'FOR'}
              onClick={() => handleChooseSide('FOR')}
              data-testid="discuss-side-for"
            >
              찬성 쪽에서 말하기
            </button>
            <button
              type="button"
              className="cta cta--secondary side-select__btn"
              aria-pressed={side === 'AGAINST'}
              onClick={() => handleChooseSide('AGAINST')}
              data-testid="discuss-side-against"
            >
              반대 쪽에서 말하기
            </button>
            <span className="side-select__hint">표결은 마지막에 따로 합니다</span>
          </div>
          {side === null ? (
            <p className="side-select__guide" data-testid="discuss-side-guide">
              먼저 입장을 골라 주세요. 직접 써도 됩니다.
            </p>
          ) : (
            <>
              <div
                className="discuss-screen__phrase-list"
              >
                {scenario.phrases
                  .filter((phrase) => {
                    const phraseSide = phrase.side ?? 'FOR';
                    return phraseSide === 'BOTH' || phraseSide === side;
                  })
                  .map((phrase) => (
                    <PhraseCard
                      key={phrase.id}
                      phrase={phrase}
                      selected={draft.selectedPhraseIds.includes(phrase.id)}
                      disabled={pendingPhraseId !== null}
                      onToggle={() => handleTogglePhrase(phrase.id)}
                    />
                  ))}
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
              근거 자료 보기
            </button>
            <span className="evidence-open-hint">자료 4장 + 임원 발언 4건</span>
          </div>
          <div className="discuss-screen__stance-row" data-testid="discuss-stance-row">
            <span className="discuss-screen__stance-label">입장</span>
            {EXEC_MEMBER_ORDER.map((memberId) => {
              const stance = stances[memberId];
              return (
                <span
                  key={memberId}
                  className={`discuss-screen__stance-chip discuss-screen__stance-chip--${STANCE_MODIFIER[stance]}`}
                >
                  <span aria-hidden="true">{memberId}</span>
                  {' · '}
                  <span data-testid={`exec-mood-label-${memberId}`}>{STANCE_LABEL[stance]}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {evidenceOpen && (
        <EvidenceDialog
          evidence={scenario.evidence}
          caseTag={caseTag}
          statements={dialogStatements}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </>
  );
}
