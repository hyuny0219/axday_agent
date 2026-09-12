// AI 비서실장(시연) 사이드 패널. DISCUSS·REACTIONS에서 선택적으로 연다(CLAUDE_
// IMPLEMENTATION.md 5장, AGENT_BOARDROOM_SPEC.md 4장). '닫기'는 패널이 열려 있는 동안
// 항상 보인다. adapter는 App.tsx가 session.mode에 따라 scripted/live 중 하나를 골라
// 넘긴다(기본값은 scripted). '내 발언에 적용'을 실제로 눌렀을 때만 draft를 교체한다 —
// 결과를 보여주는 것만으로는 절대 textarea를 덮어쓰지 않는다.
//
// T31: draftRevision이 바뀌면(참가자가 그사이 원문을 더 고치면) 화면에 남아 있던 이전
// 초안을 폐기한다. '의견 한눈에 보기'가 실패하면(5초 초과 등) 실제 발언 카드 목록
// (transcript.statements)을 그대로 보여준다 — 지어낸 요약으로 대신하지 않는다.

import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../../content/types';
import type { Transcript } from '../../domain/types';
import type {
  AssistantAdapter,
  CompareConditionsResult,
  RefineDraftResult,
  SummarizeOpinionsResult,
} from '../../services/assistant/types';
import { scriptedAssistantAdapter, withTimeout } from '../../services/assistant/scripted';
import type { AssistantActionEvent } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';

type FeatureKey = 'summary' | 'compare' | 'refine';
type Status = 'idle' | 'loading' | 'done' | 'error';

const FEATURE_LABELS: Record<FeatureKey, string> = {
  summary: '의견 한눈에 보기',
  compare: '조건 비교하기',
  refine: '내 발언 정리',
};

const FALLBACK_MESSAGE = '기본 안내로 전환했습니다.';
// 내 발언 정리 실패 시 문구는 AGENT_BOARDROOM_SPEC.md 4장 원문 그대로 쓴다(다른 두
// 기능은 FALLBACK_MESSAGE를 그대로 유지).
const REFINE_FALLBACK_MESSAGE = '정리하지 못했습니다. 원문으로 계속할 수 있습니다';

export interface AssistantPanelProps {
  scenario: Scenario;
  sessionId: string;
  /** 참가자가 지금까지 확정한 조건 ID(조건 비교하기에 씀). */
  selectedConditionIds: string[];
  /** 현재 참가자가 쓰고 있는 원문(내 발언 정리에 씀). */
  draftText: string;
  /** draftText가 바뀔 때마다 호출부(화면)가 늘리는 값. 요청 시점의 값을 그대로 보내고,
   * 응답이 왔을 때 이 값이 달라졌으면(입력이 바뀌었으면) 결과를 폐기한다. */
  draftRevision: number;
  /** '의견 한눈에 보기'가 근거로 삼는 실제 회의 기록. live 요청과, live 실패 시 발언
   * 카드 목록 그대로 보여주는 fallback에 함께 쓴다. */
  transcript: Transcript;
  /** '내 발언에 적용'을 눌렀을 때만 호출된다. */
  onApplyDraft: (text: string) => void;
  /** 결과가 실제로 화면에 표시되거나 적용되었을 때만 호출해 세션에 남긴다. */
  onAssistantAction: (event: AssistantActionEvent) => void;
  /** 테스트·live 어댑터 교체용. 기본은 사전 구성(scripted) 어댑터. */
  adapter?: AssistantAdapter;
}

function conditionLabel(scenario: Scenario, id: string): string {
  return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
}

export function AssistantPanel({
  scenario,
  sessionId,
  selectedConditionIds,
  draftText,
  draftRevision,
  transcript,
  onApplyDraft,
  onAssistantAction,
  adapter = scriptedAssistantAdapter,
}: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [summaryResult, setSummaryResult] = useState<SummarizeOpinionsResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareConditionsResult | null>(null);
  const [refineResult, setRefineResult] = useState<RefineDraftResult | null>(null);
  const [refineResultRevision, setRefineResultRevision] = useState<number | null>(null);

  // 리셋·재요청 뒤 도착한 응답을 무시하기 위해 "지금 유효한 요청"만 기록한다.
  // sessionId가 바뀌면(리셋으로 새 세션이 되면) 이전 요청은 더 이상 유효하지 않다.
  const currentRequestRef = useRef<{ sessionId: string; requestId: string; controller: AbortController } | null>(
    null,
  );

  useEffect(() => {
    return () => {
      currentRequestRef.current?.controller.abort();
    };
  }, []);

  useEffect(() => {
    // 세션이 바뀌면(리셋) 진행 중이던 요청은 폐기하고 결과도 비운다.
    currentRequestRef.current?.controller.abort();
    currentRequestRef.current = null;
    setStatus('idle');
    setActiveFeature(null);
    setSummaryResult(null);
    setCompareResult(null);
    setRefineResult(null);
    setRefineResultRevision(null);
  }, [sessionId]);

  // draftRevision이 바뀌었다는 건 참가자가 그사이 원문을 더 고쳤다는 뜻이다. 화면에 남은
  // 이전 초안은 이제 최신 원문을 반영하지 못하므로 폐기한다(진행 중이던 refine 요청도
  // 함께 취소한다 — 그 결과가 와도 더는 보여줄 자리가 없다).
  useEffect(() => {
    if (refineResultRevision !== null && refineResultRevision !== draftRevision) {
      setRefineResult(null);
      setRefineResultRevision(null);
      if (activeFeature === 'refine') {
        currentRequestRef.current?.controller.abort();
        currentRequestRef.current = null;
        setStatus('idle');
        setActiveFeature(null);
      }
    }
  }, [draftRevision, refineResultRevision, activeFeature]);

  function isStillCurrent(requestId: string): boolean {
    return currentRequestRef.current?.requestId === requestId;
  }

  async function runFeature(feature: FeatureKey) {
    currentRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = crypto.randomUUID();
    currentRequestRef.current = { sessionId, requestId, controller };
    const requestDraftRevision = draftRevision;

    setActiveFeature(feature);
    setStatus('loading');

    const base = { sessionId, requestId, signal: controller.signal };
    try {
      if (feature === 'summary') {
        const result = await withTimeout(adapter.summarizeOpinions({ ...base, scenario, transcript }));
        if (!isStillCurrent(requestId)) return;
        setSummaryResult(result);
        setStatus('done');
        onAssistantAction({ type: 'OPINION_SUMMARY', mode: result.mode, evidenceIds: result.evidenceIds });
      } else if (feature === 'compare') {
        const result = await withTimeout(
          adapter.compareConditions({ ...base, scenario, selectedConditionIds }),
        );
        if (!isStillCurrent(requestId)) return;
        setCompareResult(result);
        setStatus('done');
        onAssistantAction({ type: 'CONDITION_COMPARE', mode: result.mode, evidenceIds: result.evidenceIds });
      } else {
        const result = await withTimeout(
          adapter.refineDraft({ ...base, scenario, draftText, draftRevision: requestDraftRevision }),
        );
        if (!isStillCurrent(requestId)) return;
        if (requestDraftRevision !== draftRevision) {
          // 응답을 기다리는 사이 원문이 더 바뀌었다 — 이 초안은 이미 낡았다.
          setStatus('idle');
          setActiveFeature(null);
          return;
        }
        setRefineResult(result);
        setRefineResultRevision(requestDraftRevision);
        setStatus('done');
      }
    } catch {
      if (!isStillCurrent(requestId)) return;
      setStatus('error');
    }
  }

  function handleApplyRefine() {
    if (!refineResult) {
      return;
    }
    onApplyDraft(refineResult.draftText);
    onAssistantAction({
      type: 'DRAFT_REFINE',
      mode: refineResult.mode,
      evidenceIds: refineResult.evidenceIds,
      applied: true,
    });
  }

  // '원문 유지' — 제안을 닫기만 한다. 편집창은 절대 건드리지 않는다.
  function handleKeepOriginal() {
    setRefineResult(null);
    setRefineResultRevision(null);
    setStatus('idle');
    setActiveFeature(null);
  }

  const resultBadge = (mode: SummarizeOpinionsResult['mode']) =>
    mode === 'live' ? '실시간 AI 응답' : '체험용 사전 구성';

  return (
    <div className="assistant-panel">
      <button
        type="button"
        className="assistant-panel__toggle"
        onClick={() => setOpen((value) => !value)}
        data-testid="assistant-toggle"
      >
        {open ? 'AI 비서실장 숨기기' : 'AI 비서실장 열기'}
      </button>
      {open && (
        <aside className="assistant-panel__body" data-testid="assistant-panel">
          <div className="assistant-panel__header">
            <h3 className="assistant-panel__title">AI 비서실장(시연)</h3>
            <button
              type="button"
              className="assistant-panel__close"
              onClick={() => setOpen(false)}
              data-testid="assistant-close"
            >
              닫기
            </button>
          </div>
          <div className="assistant-panel__actions">
            {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((feature) => (
              <button
                key={feature}
                type="button"
                onClick={() => runFeature(feature)}
                data-testid={`assistant-action-${feature}`}
              >
                {FEATURE_LABELS[feature]}
              </button>
            ))}
          </div>
          {status === 'loading' && (
            <p data-testid="assistant-loading">정리하는 중입니다…</p>
          )}
          {status === 'error' && (
            <div role="alert" data-testid="assistant-error">
              <p>{activeFeature === 'refine' ? REFINE_FALLBACK_MESSAGE : FALLBACK_MESSAGE}</p>
              {activeFeature === 'summary' && (
                <ul data-testid="assistant-summary-fallback-statements">
                  {transcript.statements.length > 0 ? (
                    transcript.statements.map((statement) => (
                      <li key={statement.id}>
                        {MEMBER_LABELS[statement.roleId]}: {statement.text}
                      </li>
                    ))
                  ) : (
                    <li>아직 도착한 발언이 없습니다.</li>
                  )}
                </ul>
              )}
            </div>
          )}
          {status === 'done' && activeFeature === 'summary' && summaryResult && (
            <div data-testid="assistant-result-summary">
              <p className="assistant-panel__badge">{resultBadge(summaryResult.mode)}</p>
              {summaryResult.mode === 'live' ? (
                <p data-testid="assistant-summary-text">{summaryResult.summaryText}</p>
              ) : (
                <>
                  <h4>공통점</h4>
                  <ul>
                    {summaryResult.commonPoints.map((point) => (
                      <li key={point.memberId}>
                        {MEMBER_LABELS[point.memberId]}: {point.text}
                      </li>
                    ))}
                  </ul>
                  <h4>쟁점</h4>
                  <ul>
                    {summaryResult.disagreements.map((point) => (
                      <li key={point.memberId}>
                        {MEMBER_LABELS[point.memberId]}: {point.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="assistant-panel__evidence">근거: {summaryResult.evidenceIds.join(', ')}</p>
            </div>
          )}
          {status === 'done' && activeFeature === 'compare' && compareResult && (
            <div data-testid="assistant-result-compare">
              <p className="assistant-panel__badge">{resultBadge(compareResult.mode)}</p>
              <h4>원안과의 차이</h4>
              {compareResult.addedConditionIds.length > 0 ? (
                <ul>
                  {compareResult.addedConditionIds.map((id) => (
                    <li key={id}>{conditionLabel(scenario, id)}</li>
                  ))}
                </ul>
              ) : (
                <p>지금까지 확정한 조건이 없습니다.</p>
              )}
              <h4>남은 확인 사항</h4>
              {compareResult.remainingConditionIds.length > 0 ? (
                <ul>
                  {compareResult.remainingConditionIds.map((id) => (
                    <li key={id}>{conditionLabel(scenario, id)}</li>
                  ))}
                </ul>
              ) : (
                <p>남은 확인 사항이 없습니다.</p>
              )}
            </div>
          )}
          {status === 'done' && activeFeature === 'refine' && refineResult && (
            <div data-testid="assistant-result-refine">
              <p className="assistant-panel__badge">{resultBadge(refineResult.mode)}</p>
              <div className="assistant-panel__refine-compare">
                <div className="assistant-panel__refine-original">
                  <h4>원문</h4>
                  <p data-testid="assistant-refine-original">{draftText}</p>
                </div>
                <div className="assistant-panel__refine-draft-wrap">
                  <h4>정리한 초안</h4>
                  <p className="assistant-panel__refine-draft" data-testid="assistant-refine-draft">
                    {refineResult.draftText}
                  </p>
                </div>
              </div>
              <div className="assistant-panel__refine-choices">
                <button
                  type="button"
                  onClick={handleApplyRefine}
                  data-testid="assistant-apply-refine"
                >
                  내 발언에 적용
                </button>
                <button
                  type="button"
                  onClick={handleKeepOriginal}
                  data-testid="assistant-keep-original"
                >
                  원문 유지
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
