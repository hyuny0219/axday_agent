// 반응 화면: 내 발언을 인용하고, 확정 조건에 연결된 임원만 반응을 바꾼다. 나머지
// 임원은 기존 의견을 유지한다(docs/SCENARIO_AI_ASSISTANT.md "첫 반응 및 후속 질문").
// 후속 질문은 세션당 1회이며 선택지 버튼(그중 하나는 '앞선 의견 유지') + 직접 입력을
// 제공한다. 조건 제안·충돌·확정은 discuss와 동일하게 domain/conditions.ts에 위임한다.
// T12에서 AssistantPanel을 붙였다. live 모드에서는 상단 임원 카드 행을 scenario.reactions
// 대신 실제 REACTIONS 라운드 결과(roleStatus·statements)로 바꾼다(T30). 후속 보완 입력·
// 조건 칩·AI 비서실장은 live/scripted 모두 참가자가 직접 쓰는 부분이라 그대로 둔다. T31에서
// draftRevision·transcript·assistantAdapter를 AssistantPanel에 추가로 넘긴다(statements를
// 그대로 transcript로 재사용한다 — 이미 live 라운드 결과를 담고 있다).
// T40에서 두 번째 입력을 "질문에 답하기"로 재구성했다: 후속 질문에 발화자(CAIO,
// scenario.followUp.askedBy)를 붙이고, 직접 입력은 접어 빠른 답 3개만으로도 완주할
// 수 있게 한다(T45부터는 <details> 대신 버튼 토글 + hidden 속성으로 같은 자리를
// 나눠 쓴다). 직접 입력만으로 완주하는 경로(토글 열기 → 입력 → 제출)도 그대로
// 유지한다. 조건 확인·충돌 규칙·SUBMIT_FOLLOWUP/KEEP_PREVIOUS 액션은 바꾸지 않았다.
// T45(조종석 배치): 왼쪽 열은 내 발언 인용(2줄 클램프)·빠른 답 3 ↔ 직접 답하기(같은
// 자리 전환)·조건 칩·[비서실장][답변 전달]. 오른쪽 열은 임원 반응 2×2 + CAIO 질문
// (DESIGN_SPEC.md v1.0 6절 표). 2026-09-19 T45 검토 반영(2a): 직접 답하기를 열면 빠른
// 답 3개가 있던 자리를 입력창·글자 수·조건 칩이 그대로 대체한다(같은 slot, DOM에서
// 빠른 답을 hidden으로 숨기되 선택 상태는 유지). .reactions-screen__scroll 내부
// 스크롤은 없앴다.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { Opinion, RoleStatus, Statement } from '../../domain/types';
import { DRAFT_MAX_LENGTH } from '../../domain/draft';
import { confirmConditions, findConflicts, proposeFromText } from '../../domain/conditions';
import { EXEC_MEMBER_ORDER } from '../../domain/voting';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import type { AssistantAdapter } from '../../services/assistant/types';
import { MEMBER_LABELS } from '../memberLabels';
import { ConditionChips } from '../parts/ConditionChips';
import { AssistantPanel } from '../parts/AssistantPanel';
import { LiveStatementCards } from '../parts/LiveStatementCards';
import { Avatar } from '../parts/Avatar';
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
  /** AI 비서실장 '의견 한눈에 보기'(live)가 근거로 삼는 실제 회의 기록 revision. */
  transcriptRevision: number;
  onSubmitFollowup: (payload: ReactionsFollowupPayload) => void;
  onKeepPrevious: () => void;
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

export function ReactionsScreen({
  scenario,
  sessionId,
  opinions,
  mode,
  roleStatus,
  statements,
  transcriptRevision,
  onSubmitFollowup,
  onKeepPrevious,
  onAssistantAction,
  assistantAdapter,
}: ReactionsScreenProps) {
  const lastOpinion = opinions[opinions.length - 1] ?? null;
  const previousConfirmedIds = useMemo(
    () => lastOpinion?.confirmedConditionIds ?? [],
    [lastOpinion],
  );

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [textValue, setTextValue] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [acceptedConditionIds, setAcceptedConditionIds] = useState<string[]>(previousConfirmedIds);
  // discuss-screen과 같은 이유로 textValue가 바뀔 때마다 늘린다.
  const [draftRevision, setDraftRevision] = useState(0);
  const transcript = useMemo(
    () => ({ revision: transcriptRevision, statements }),
    [transcriptRevision, statements],
  );

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
  // 조건 확인은 답을 시작한 뒤(빠른 답 선택, 직접 답하기 열기, 또는 답변 텍스트가 남아
  // 있음)에만 보여준다. 이전 의견의 조건은 그 전까지 그대로 유지된다. 텍스트 조건이
  // 없으면 직접 답하기를 열어 쓴 뒤 닫거나, 비서실장 정리본을 적용해 빠른 답 선택이
  // 풀린 뒤에도 제출은 가능한데 조건은 볼 수 없게 된다(PR #4 Codex 2차 검토).
  const hasStartedAnswer =
    selectedOptionIndex !== null || isEditorOpen || textValue.trim() !== '';
  // 이전에 확정한 조건과 새 제안을 병합한 acceptedConditionIds 안에 충돌쌍이 함께
  // 선택돼 있으면(예: DISCUSS에서 ACCESS 확정 후 여기서 OPEN_ALL도 선택) 전달을
  // 막는다. ConditionChips가 같은 목록으로 안내 문구를 보여준다.
  const canSubmit =
    textValue.trim() !== '' && textValue.length <= DRAFT_MAX_LENGTH && conflictPairs.length === 0;

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
    setDraftRevision((value) => value + 1);
  }

  function handleTextChange(text: string) {
    setSelectedOptionIndex(null);
    setTextValue(text);
    setDraftRevision((value) => value + 1);
  }

  // 직접 답하기는 기본 접힘이며(T40 만들 것 2: 빠른 답만으로도 완주할 수 있게
  // 직접 입력을 접어 둔다), 같은 자리에서 빠른 답 3개와 전환한다(2026-09-19 T45
  // 검토 반영 2a). 열릴 때만 textarea로 포커스를 옮긴다 — isEditorOpen이 바뀐 뒤
  // (React가 hidden 속성을 실제로 지운 뒤) 포커스해야 해서 상태 갱신과 분리해
  // 아래 useEffect에서 처리한다.
  function handleToggleEditor() {
    setIsEditorOpen((previous) => !previous);
  }

  useEffect(() => {
    if (isEditorOpen) {
      textareaRef.current?.focus();
    }
  }, [isEditorOpen]);

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
    <>
      <div className="app-body__actions screen reactions-screen">
        <blockquote className="reactions-screen__quote" data-testid="reactions-quote">
          {lastOpinion?.originalText}
        </blockquote>
        <div className="reactions-screen__followup">
          {/* 같은 자리 전환(2026-09-19 T45 검토 반영 2a): isEditorOpen에 따라 빠른 답
              3개와 직접 입력이 같은 slot을 나눠 쓴다. 둘 다 항상 DOM에 있고 hidden
              속성으로만 감춰(상태는 유지) 내부 스크롤 없이 한 자리에서 전환한다. */}
          <div className="reactions-screen__answer">
            <button
              type="button"
              className="reactions-screen__editor-toggle"
              data-testid="followup-open-editor"
              aria-expanded={isEditorOpen}
              onClick={handleToggleEditor}
            >
              {isEditorOpen ? '빠른 답으로' : '직접 답하기'}
            </button>
            <div className="reactions-screen__options" hidden={isEditorOpen}>
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
            <div className="reactions-screen__editor" hidden={!isEditorOpen}>
              <label className="reactions-screen__direct-label" htmlFor="followup-textarea">
                직접 입력
              </label>
              <textarea
                id="followup-textarea"
                ref={textareaRef}
                className="reactions-screen__textarea"
                value={textValue}
                onChange={(event) => handleTextChange(event.target.value)}
                data-testid="followup-textarea"
              />
              <p className="reactions-screen__count" data-testid="followup-char-count">
                {textValue.length} / {DRAFT_MAX_LENGTH}자
              </p>
            </div>
          </div>
          {hasStartedAnswer && (
            <ConditionChips
              scenario={scenario}
              proposedIds={proposedConditionIds}
              acceptedIds={acceptedConditionIds}
              conflictPairs={conflictPairs}
              showNoMatchHint={showNoMatchHint}
              onToggle={handleToggleCondition}
            />
          )}
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
              adapter={assistantAdapter}
            />
            <button
              type="button"
              className="cta"
              disabled={!canSubmit}
              onClick={handleSubmit}
              data-testid="submit-followup"
            >
              답변 전달
            </button>
          </div>
        </div>
      </div>
      <div className="app-body__content screen reactions-screen__info">
        <h2 className="reactions-screen__title">
          이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다
        </h2>
        {mode === 'live' ? (
          <LiveStatementCards
            scenario={scenario}
            stage="REACTIONS"
            roleStatus={roleStatus}
            statements={statements}
            variant="reply"
          />
        ) : (
          <ul className="reactions-screen__replies">
            {EXEC_MEMBER_ORDER.map((memberId) => {
              const reactions = reactionsFor(memberId);
              const initial = scenario.initialOpinions.find((opinion) => opinion.memberId === memberId);
              const changed = reactions.length > 0;
              return (
                <li
                  key={memberId}
                  className={`reaction-reply${changed ? ' reaction-reply--changed' : ' reaction-reply--muted'}`}
                  data-testid={`reaction-card-${memberId}`}
                >
                  <div className="reaction-reply__head">
                    <Avatar memberId={memberId} size="sm" />
                    <h3 className="reaction-reply__member">{MEMBER_LABELS[memberId]}</h3>
                  </div>
                  {changed ? (
                    <ul className="reaction-reply__texts">
                      {reactions.map((reaction, index) => (
                        <li key={index}>{reaction.text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reaction-reply__maintained">
                      <span className="reaction-reply__maintained-label">기존 의견 유지</span>
                      {initial?.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="reactions-screen__question" data-testid="followup-question">
          <Avatar memberId={scenario.followUp.askedBy} size="sm" />
          <div className="reactions-screen__question-body">
            <p className="reactions-screen__asked-by">{scenario.followUp.askedBy}가 묻습니다</p>
            <h3 className="reactions-screen__section-label">{scenario.followUp.question}</h3>
          </div>
        </div>
      </div>
    </>
  );
}
