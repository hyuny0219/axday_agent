// 의견 작성 화면: 추천 문구 체크박스 + 직접 입력 textarea + 제안 조건 칩을 하나의
// draftText로 모아 '의견 전달'로 SUBMIT_OPINION을 낸다(CLAUDE_IMPLEMENTATION.md 4장).
// selectedPhraseIds와 draftText를 분리하고, 실제 제출값은 항상 화면에 보이는
// draftText다. 편집 손실 방지 규칙(직접 수정 후 체크 변경 시 확인)과 조건 제안·충돌
// 판정은 모두 src/domain의 순수 함수(draft.ts, conditions.ts)에 위임한다. T12에서
// AssistantPanel(선택적으로 여는 AI 비서실장 사이드 패널)을 붙였다. T31에서 draftRevision
// (직접 입력·적용마다 늘어나는 값)과 transcript(의견 한눈에 보기 live 요청·실패 fallback)를
// AssistantPanel에 추가로 넘긴다.
// T45(조종석 배치): 왼쪽 열(app-body__actions)은 내 행동 전부 — 추천 문구·입력창·조건
// 칩·[비서실장][의견 전달]. 오른쪽 열(app-body__content)은 회의 정보 — 근거 2×2 +
// 임원 첫 의견. AssistantPanel은 토글은 왼쪽에 남고, 열렸을 때의 드로어 본문은
// assistant.css가 오른쪽 열 위에 절대 위치로 겹쳐 그린다(position:absolute, DOM은
// 그대로 왼쪽 트리 안이지만 .app-body가 위치 기준점이다).

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Transcript } from '../../domain/types';
import {
  EMPTY_DRAFT_STATE,
  editText,
  isSubmittable,
  resolveConfirm,
  togglePhrase,
} from '../../domain/draft';
import { confirmConditions, findConflicts, proposeFromPhrases, proposeFromText } from '../../domain/conditions';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import type { AssistantAdapter } from '../../services/assistant/types';
import { PhraseCard } from '../parts/PhraseCard';
import { DraftEditor } from '../parts/DraftEditor';
import { RebuildConfirm } from '../parts/RebuildConfirm';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import { Avatar } from '../parts/Avatar';
import { EvidenceGrid } from '../parts/EvidenceGrid';
import { MEMBER_LABELS } from '../memberLabels';
import '../../styles/screens/discuss.css';

export interface DiscussSubmitPayload {
  originalText: string;
  selectedPhraseIds: string[];
  confirmedConditionIds: string[];
}

export interface DiscussScreenProps {
  scenario: Scenario;
  sessionId: string;
  /** AI 비서실장 '의견 한눈에 보기'(live)가 근거로 삼는 실제 회의 기록. */
  transcript: Transcript;
  onSubmit: (payload: DiscussSubmitPayload) => void;
  /** AI 비서실장 결과가 실제로 표시·적용됐을 때만 호출된다(세션 기록용). */
  onAssistantAction: (event: AssistantActionEvent) => void;
  /** live/scripted 중 App.tsx가 session.mode로 고른 비서실장 어댑터. */
  assistantAdapter?: AssistantAdapter;
}

function uniqueInOrder(ids: string[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

export function DiscussScreen({
  scenario,
  sessionId,
  transcript,
  onSubmit,
  onAssistantAction,
  assistantAdapter,
}: DiscussScreenProps) {
  const [draft, setDraft] = useState(EMPTY_DRAFT_STATE);
  const [pendingPhraseId, setPendingPhraseId] = useState<string | null>(null);
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>([]);
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
  const canSubmit = pendingPhraseId === null && isSubmittable(draft);

  function handleTogglePhrase(phraseId: string) {
    const result = togglePhrase(draft, scenario, phraseId);
    if (result.kind === 'applied') {
      setDraft(result.state);
      setDraftRevision((value) => value + 1);
      return;
    }
    setPendingPhraseId(result.pendingPhraseId);
  }

  function handleKeep() {
    if (pendingPhraseId === null) {
      return;
    }
    setDraft(resolveConfirm(draft, scenario, pendingPhraseId, 'keep'));
    setDraftRevision((value) => value + 1);
    setPendingPhraseId(null);
  }

  function handleRebuild() {
    if (pendingPhraseId === null) {
      return;
    }
    setDraft(resolveConfirm(draft, scenario, pendingPhraseId, 'rebuild'));
    setDraftRevision((value) => value + 1);
    setPendingPhraseId(null);
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
        {/* 추천 문구+내 발언 묶음만 내부 스크롤한다(화면당 유일한 스크롤 패널,
            DESIGN_SPEC.md v1.0 6절) — [비서실장][의견 전달] 행은 밖에 그대로 둬
            항상 보이고 늘 닿을 수 있게 한다. */}
        <div className="discuss-screen__scroll">
          <div className="discuss-screen__phrases">
            <h3 className="discuss-screen__section-label">추천 문구 (여러 개 선택 가능)</h3>
            <div className="discuss-screen__phrase-list">
              {scenario.phrases.map((phrase) => (
                <PhraseCard
                  key={phrase.id}
                  phrase={phrase}
                  selected={draft.selectedPhraseIds.includes(phrase.id)}
                  onToggle={() => handleTogglePhrase(phrase.id)}
                />
              ))}
            </div>
          </div>
          <div className="discuss-screen__editor">
            <h3 className="discuss-screen__section-label discuss-screen__section-label--mine">
              <Avatar memberId="PARTICIPANT" size="sm" />내 발언
            </h3>
            {pendingPhraseId !== null && (
              <RebuildConfirm onKeep={handleKeep} onRebuild={handleRebuild} />
            )}
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
        </div>
        <div className="discuss-screen__submit-row screen__submit-row">
          <AssistantPanel
            scenario={scenario}
            sessionId={sessionId}
            selectedConditionIds={confirmedConditionIds}
            draftText={draft.draftText}
            draftRevision={draftRevision}
            transcript={transcript}
            onApplyDraft={handleDraftTextChange}
            onAssistantAction={onAssistantAction}
            adapter={assistantAdapter}
          />
          <button
            type="button"
            className="cta"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="submit-opinion"
          >
            의견 전달
          </button>
        </div>
        <p className="discuss-screen__submit-hint">
          빈 칸이거나 300자를 넘으면 전달할 수 없습니다. 축약 표현은 이사님이 직접 정합니다.
        </p>
      </div>
      <div className="app-body__content screen discuss-screen__info">
        <EvidenceGrid evidence={scenario.evidence} />
        <div className="discuss-screen__execs" data-testid="discuss-exec-row">
          {scenario.initialOpinions.map((opinion) => (
            <article key={opinion.memberId} className="discuss-exec-card">
              <Avatar memberId={opinion.memberId} size="sm" />
              <div className="discuss-exec-card__body">
                <h3 className="discuss-exec-card__member">{MEMBER_LABELS[opinion.memberId]}</h3>
                <p className="discuss-exec-card__text">{opinion.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
