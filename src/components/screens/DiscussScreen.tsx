// 의견 작성 화면: 추천 문구 체크박스 + 직접 입력 textarea + 제안 조건 칩을 하나의
// draftText로 모아 '의견 전달'로 SUBMIT_OPINION을 낸다(CLAUDE_IMPLEMENTATION.md 4장).
// selectedPhraseIds와 draftText를 분리하고, 실제 제출값은 항상 화면에 보이는
// draftText다. 편집 손실 방지 규칙(직접 수정 후 체크 변경 시 확인)과 조건 제안·충돌
// 판정은 모두 src/domain의 순수 함수(draft.ts, conditions.ts)에 위임한다. T12에서
// AssistantPanel(선택적으로 여는 AI 비서실장 사이드 패널)을 붙였다.

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import {
  EMPTY_DRAFT_STATE,
  editText,
  isSubmittable,
  resolveConfirm,
  togglePhrase,
} from '../../domain/draft';
import { confirmConditions, findConflicts, proposeFromPhrases, proposeFromText } from '../../domain/conditions';
import { PhraseCard } from '../parts/PhraseCard';
import { DraftEditor } from '../parts/DraftEditor';
import { RebuildConfirm } from '../parts/RebuildConfirm';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import '../../styles/screens/discuss.css';

export interface DiscussSubmitPayload {
  originalText: string;
  selectedPhraseIds: string[];
  confirmedConditionIds: string[];
}

export interface DiscussScreenProps {
  scenario: Scenario;
  sessionId: string;
  onSubmit: (payload: DiscussSubmitPayload) => void;
  /** AI 비서실장 결과가 실제로 표시·적용됐을 때만 호출된다(세션 기록용). */
  onAssistantAction: (label: string) => void;
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

export function DiscussScreen({ scenario, sessionId, onSubmit, onAssistantAction }: DiscussScreenProps) {
  const [draft, setDraft] = useState(EMPTY_DRAFT_STATE);
  const [pendingPhraseId, setPendingPhraseId] = useState<string | null>(null);
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>([]);

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
      return;
    }
    setPendingPhraseId(result.pendingPhraseId);
  }

  function handleKeep() {
    if (pendingPhraseId === null) {
      return;
    }
    setDraft(resolveConfirm(draft, scenario, pendingPhraseId, 'keep'));
    setPendingPhraseId(null);
  }

  function handleRebuild() {
    if (pendingPhraseId === null) {
      return;
    }
    setDraft(resolveConfirm(draft, scenario, pendingPhraseId, 'rebuild'));
    setPendingPhraseId(null);
  }

  function handleDraftTextChange(text: string) {
    setDraft(editText(draft, text).state);
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
    <section className="screen discuss-screen">
      <h2 className="discuss-screen__title">이사님의 의견을 전달해 주세요</h2>
      <div className="discuss-screen__body">
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
          <h3 className="discuss-screen__section-label">내 발언</h3>
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
      <AssistantPanel
        scenario={scenario}
        sessionId={sessionId}
        selectedConditionIds={confirmedConditionIds}
        draftText={draft.draftText}
        onApplyDraft={handleDraftTextChange}
        onAssistantAction={onAssistantAction}
      />
      <div className="discuss-screen__submit-row">
        <button
          type="button"
          className="cta"
          disabled={!canSubmit}
          onClick={handleSubmit}
          data-testid="submit-opinion"
        >
          의견 전달
        </button>
        <p className="discuss-screen__submit-hint">
          빈 칸이거나 300자를 넘으면 전달할 수 없습니다. 축약 표현은 이사님이 직접 정합니다.
        </p>
      </div>
    </section>
  );
}
