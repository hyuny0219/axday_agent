// 반응 화면: 내 발언을 인용하고, 확정 조건에 연결된 임원만 반응을 바꾼다. 나머지
// 임원은 기존 의견을 유지한다(docs/SCENARIO_AI_ASSISTANT.md "첫 반응 및 후속 질문").
// 후속 질문은 세션당 1회이며 선택지 버튼(그중 하나는 '앞선 의견 유지') + 직접 입력을
// 제공한다. 조건 제안·충돌·확정은 discuss와 동일하게 domain/conditions.ts에 위임한다.
// T12에서 AssistantPanel을 붙였다.

import { useEffect, useMemo, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Opinion } from '../../domain/types';
import { DRAFT_MAX_LENGTH } from '../../domain/draft';
import { confirmConditions, findConflicts, proposeFromText } from '../../domain/conditions';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import { MEMBER_LABELS } from '../memberLabels';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
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
  onSubmitFollowup: (payload: ReactionsFollowupPayload) => void;
  onKeepPrevious: () => void;
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

export function ReactionsScreen({
  scenario,
  sessionId,
  opinions,
  onSubmitFollowup,
  onKeepPrevious,
  onAssistantAction,
}: ReactionsScreenProps) {
  const lastOpinion = opinions[opinions.length - 1] ?? null;
  const previousConfirmedIds = useMemo(
    () => lastOpinion?.confirmedConditionIds ?? [],
    [lastOpinion],
  );

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [textValue, setTextValue] = useState('');
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>(previousConfirmedIds);

  const selectedOption =
    selectedOptionIndex !== null ? scenario.followUp.options[selectedOptionIndex] : null;

  const newProposedIds = useMemo(() => {
    const fromOption = selectedOption?.proposeConditionId ? [selectedOption.proposeConditionId] : [];
    const fromText = proposeFromText(scenario, textValue);
    return uniqueInOrder([...fromOption, ...fromText]);
  }, [scenario, selectedOption, textValue]);

  const proposedConditionIds = useMemo(
    () => uniqueInOrder([...previousConfirmedIds, ...newProposedIds]),
    [previousConfirmedIds, newProposedIds],
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
  const canSubmit = textValue.trim() !== '' && textValue.length <= DRAFT_MAX_LENGTH;

  function reactionsFor(memberId: (typeof EXEC_MEMBER_ORDER)[number]) {
    if (previousConfirmedIds.length === 0) {
      return scenario.reactions.filter(
        (reaction) => reaction.memberId === memberId && reaction.conditionId === 'none',
      );
    }
    return scenario.reactions.filter(
      (reaction) =>
        reaction.memberId === memberId && previousConfirmedIds.includes(reaction.conditionId),
    );
  }

  function handleSelectOption(index: number) {
    const option = scenario.followUp.options[index];
    if (!option) {
      return;
    }
    if (option.keepPrevious) {
      onKeepPrevious();
      return;
    }
    setSelectedOptionIndex(index);
    setTextValue(option.text);
  }

  function handleTextChange(text: string) {
    setSelectedOptionIndex(null);
    setTextValue(text);
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

  return (
    <section className="screen reactions-screen">
      <h2 className="reactions-screen__title">임원들의 반응</h2>
      <blockquote className="reactions-screen__quote" data-testid="reactions-quote">
        {lastOpinion?.originalText}
      </blockquote>
      <div className="reactions-screen__cards">
        {EXEC_MEMBER_ORDER.map((memberId) => {
          const reactions = reactionsFor(memberId);
          const initial = scenario.initialOpinions.find((opinion) => opinion.memberId === memberId);
          return (
            <article
              key={memberId}
              className="reaction-card"
              data-testid={`reaction-card-${memberId}`}
            >
              <h3 className="reaction-card__member">{MEMBER_LABELS[memberId]}</h3>
              {reactions.length > 0 ? (
                <ul className="reaction-card__texts">
                  {reactions.map((reaction, index) => (
                    <li key={index}>{reaction.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="reaction-card__maintained">
                  <span className="reaction-card__maintained-label">기존 의견 유지</span>
                  {initial?.text}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <div className="reactions-screen__followup">
        <h3 className="reactions-screen__section-label">{scenario.followUp.question}</h3>
        <div className="reactions-screen__options">
          {scenario.followUp.options.map((option, index) => (
            <button
              key={index}
              type="button"
              className={`reactions-screen__option${
                selectedOptionIndex === index ? ' reactions-screen__option--selected' : ''
              }`}
              onClick={() => handleSelectOption(index)}
              data-testid={`followup-option-${index}`}
            >
              {option.text}
            </button>
          ))}
        </div>
        <label className="reactions-screen__direct-label" htmlFor="followup-textarea">
          직접 입력
        </label>
        <textarea
          id="followup-textarea"
          className="reactions-screen__textarea"
          value={textValue}
          onChange={(event) => handleTextChange(event.target.value)}
          data-testid="followup-textarea"
        />
        <ConditionChips
          scenario={scenario}
          proposedIds={proposedConditionIds}
          acceptedIds={acceptedConditionIds}
          conflictPairs={conflictPairs}
          showNoMatchHint={showNoMatchHint}
          onToggle={handleToggleCondition}
        />
        <AssistantPanel
          scenario={scenario}
          sessionId={sessionId}
          selectedConditionIds={confirmedConditionIds}
          draftText={textValue}
          onApplyDraft={handleTextChange}
          onAssistantAction={onAssistantAction}
        />
        <button
          type="button"
          className="cta"
          disabled={!canSubmit}
          onClick={handleSubmit}
          data-testid="submit-followup"
        >
          보완 의견 전달
        </button>
      </div>
    </section>
  );
}
