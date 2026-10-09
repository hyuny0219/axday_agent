// AI 비서실장(시연) 사이드 패널. DISCUSS·REACTIONS에서 선택적으로 연다(CLAUDE_
// IMPLEMENTATION.md 5장, AGENT_BOARDROOM_SPEC.md 4장). '닫기'는 패널이 열려 있는 동안
// 항상 보인다. adapter는 App.tsx가 session.mode에 따라 scripted/live 중 하나를 골라
// 넘긴다(기본값은 scripted). '내 발언에 적용'을 실제로 눌렀을 때만 draft를 교체한다 —
// 결과를 보여주는 것만으로는 절대 textarea를 덮어쓰지 않는다.
//
// T31: draftRevision이 바뀌면(참가자가 그사이 원문을 더 고치면) 화면에 남아 있던 이전
// 초안을 폐기한다. '의견 한눈에 보기'가 실패하면(5초 초과 등) 실제 발언 카드 목록
// (transcript.statements)을 그대로 보여준다 — 지어낸 요약으로 대신하지 않는다.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecMemberId, Scenario } from '../../content/types';
import type { ParticipantStance, SessionMode, Stance, Transcript } from '../../domain/types';
import { buildConditionRecommendation, recommendedConditionIds } from '../conditionRecommendation';
import { latestSuggestedConditionIds } from '../liveTranscript';
import type {
  AssistantAdapter,
  CompareConditionsResult,
  RefineDraftResult,
  SummarizeOpinionsResult,
} from '../../services/assistant/types';
import { buildCompare, scriptedAssistantAdapter, withTimeout } from '../../services/assistant/scripted';
import type { AssistantActionEvent, AssistantFeatureKey } from '../../domain/assistantLog';
import { ASSISTANT_FEATURE_ORDER } from '../../domain/assistantLog';
import { MEMBER_LABELS } from '../memberLabels';
import { DialogShell } from './DialogShell';
import { nextStepAttr } from './focusRing';
import { useDialogOpen } from './useDialogOpen';
import '../../styles/screens/assistant.css';

type FeatureKey = AssistantFeatureKey;
type Status = 'idle' | 'loading' | 'done' | 'error';

// T96(2026-10-08 사용자 지시 "AI 비서실장을 잘 쓰면 안건의 여러 측면에 맞는 조건을
// 고르는 데 큰 도움이 된다고 느끼게"): "조건 비교하기"를 "조건 추천"으로 강화한다 —
// 내부 feature key(compare)·기존 결과(CompareConditionsResult)는 그대로 두고 라벨과
// 렌더 내용만 늘린다.
const FEATURE_LABELS: Record<FeatureKey, string> = {
  summary: '의견 한눈에 보기',
  compare: '조건 추천',
  refine: '내 발언 정리',
};

// T97: 팝업 첫 화면 소개(DISCUSS만). 기능마다 쉬운 말 한 문장.
const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  summary: '임원 네 명 말을 한 줄씩 정리합니다',
  compare: '어떤 임원을 어떤 조건으로 움직일 수 있는지 알려 줍니다',
  refine: '지금 쓴 발언을 더 또렷하게 다듬어 줍니다',
};

const FALLBACK_MESSAGE = '연결이 늦어 미리 준비한 정리를 보여 드립니다.';
// 내 발언 정리 실패 시 문구는 AGENT_BOARDROOM_SPEC.md 4장 원문 그대로 쓴다(다른 두
// 기능은 FALLBACK_MESSAGE를 그대로 유지).
const REFINE_FALLBACK_MESSAGE = '정리하지 못했습니다. 원문으로 계속할 수 있습니다';

/** T97: DISCUSS가 넘기면 팝업 첫 화면에 소개·체크리스트를 그린다. */
export interface RequiredFeatures {
  /** 이번 세션에서 이미 써 본 기능(실패·연결 지연 포함). */
  used: ReadonlySet<FeatureKey>;
  /** 한 기능 이상 쓴 순간(T109) 한 번 호출된다. */
  onAllUsed?: () => void;
}

export interface AssistantPanelProps {
  requiredFeatures?: RequiredFeatures;
  /** T113: 비서실장이 지금 해야 할 다음 할 일이면 true. 닫혀 있으면 여는 버튼, 열려 있으면 아직 안 쓴 첫 기능 버튼에 점선을 붙인다. */
  focusNext?: boolean;
  /** PR #20 Codex 29차 P2: true면 열기 버튼을 잠그고 "먼저 추천 문구를 골라 주세요"를 보인다
   * (DISCUSS에서 문구 선택 전에 세 기능을 써 순서를 우회하지 못하게). 창이 열려 있는 동안은
   * 영향이 없다. */
  toggleLocked?: boolean;
  /** 잠겨 있을 때 보일 안내(기본 "먼저 추천 문구를 골라 주세요"). */
  toggleLockedHint?: string;
  scenario: Scenario;
  sessionId: string;
  /** 참가자가 지금까지 확정한 조건 ID(조건 추천에 씀). */
  selectedConditionIds: string[];
  /** 조건 추천의 "반대 입장이면 뒤집어 보여준다" 판단에 쓴다(T96, PersuasionBoard와
   * 같은 입력). 없으면 'FOR'와 같게 다룬다. */
  participantStance?: ParticipantStance;
  /** live/scripted(T96 Codex 27차 검토 P2-4) — "아직 찬성이 아닌 임원"을 scripted
   * 규칙표가 아니라 실제 표정(stances)으로 가르는 데 쓴다. PersuasionBoard와 같은 입력. */
  mode: SessionMode;
  /** 무대 표정과 같은 기준의 "지금" 입장(PersuasionBoard와 같은 입력). */
  stances: Record<ExecMemberId, Stance>;
  /** 조건은 맞았지만 추가 질문의 답을 기다리는 임원(T110, REACTIONS 2/2에서만 넘긴다).
   * 조건 추천이 이 임원을 "더 필요한 조건"에 세지 않고 "답하면 찬성"으로 따로 말한다. */
  awaitingAnswerIds?: readonly ExecMemberId[];
  /** live 전용 참고 자료 — 임원별 가장 최근 발언에 실린 제안 조건(있으면,
   * PersuasionBoard와 같은 입력). 아직 화면이 넘기지 않으면 규칙표 값을 "참고"로
   * 대신 쓴다. */
  liveSuggestedConditionIds?: Partial<Record<ExecMemberId, readonly string[]>>;
  /** 추천 조건 행의 "적용"을 눌렀을 때 호출된다(T96). 화면(Discuss·Reactions)이 그
   * 조건과 연결된 추천 문구를 실제로 체크했으면 true(또는 그 결과의 Promise)를
   * 돌려준다 — 매칭되는 문구가 없거나 확인 대기(RebuildConfirm)만 열렸으면 false다
   * (Codex 27차 검토 P2-3, 실제로 반영됐을 때만 "추천 조건 N개 반영"을 기록한다). */
  onRecommendCondition?: (conditionId: string) => boolean | Promise<boolean>;
  /** 복합 조합 묶음의 "모두 적용"(PR #20 Codex 28차 P2-1). 조건 여러 개를 화면이 한 번의
   * 상태 업데이트로 반영하고, 실제로 반영된 조건 id만 돌려준다. 같은 렌더에서 캡처한
   * 상태로 조건마다 따로 갱신하면 뒤 호출이 앞 호출을 덮어쓰기 때문이다. 없으면 조건을
   * 하나씩 onRecommendCondition으로 적용한다. */
  onRecommendConditions?: (conditionIds: string[]) => string[] | Promise<string[]>;
  /** 이 화면의 현재 입장에서 그 조건을 실제로 체크할 문구가 있는지(PR #20 Codex 30차
   * P2-1). false면 "적용" 대신 "직접 써 주세요" 안내를 보인다. 없으면 모두 적용 가능으로
   * 본다. 묶음은 구성 조건이 전부 가능할 때만 "모두 적용"을 보인다. */
  canApplyCondition?: (conditionId: string) => boolean;
  /** T119: 아직 안 붙은 조건을 어디서 붙일 수 있는지 안내한다. hint는 "추천 문구 N번에서…"/
   * "추가 답변에서…" 문구(없으면 null), offered는 추천 문구·추가 답변 어디에도 없는
   * 조건을 거르는 데 쓴다(false면 안내하지 않는다). 없으면 안내 없이 모두 보인다. */
  conditionGuide?: {
    hint: (conditionId: string) => string | null;
    offered: (conditionId: string) => boolean;
  };
  /** 값이 바뀌면(0 제외) 열려 있는 팝업을 닫는다(PR #20 Codex 31차 P2-1). 화면이 확인 창을
   * 띄울 때 팝업의 포커스 트랩이 확인 창을 가리지 않게 한다. 자동으로 다시 열지는 않는다. */
  closeRequest?: number;
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
  /** 드로어 열림/닫힘을 화면에 알린다(T69 후속, PR #11 Codex 31차). 화면은 드로어가 열린
   * 동안 가려지는 오른쪽 열을 inert로 만들어 Tab이 숨은 버튼에 닿지 않게 한다. */
  onOpenChange?: (open: boolean) => void;
  /** 테스트·live 어댑터 교체용. 기본은 사전 구성(scripted) 어댑터. */
  adapter?: AssistantAdapter;
}

function conditionLabel(scenario: Scenario, id: string): string {
  return scenario.conditions.find((condition) => condition.id === id)?.label ?? id;
}

/** 자료 ID(E1~E4) 대신 자료명만 쓴다(T52 — "근거: E1, E2" 노출을 T85 #17에서 다시
 * 발견해 고친다). */
function evidenceLabel(scenario: Scenario, id: string): string {
  return scenario.evidence.find((item) => item.id === id)?.title ?? id;
}

export function AssistantPanel({
  requiredFeatures,
  focusNext = false,
  toggleLocked = false,
  toggleLockedHint,
  scenario,
  sessionId,
  selectedConditionIds,
  participantStance = null,
  mode,
  stances,
  awaitingAnswerIds,
  liveSuggestedConditionIds,
  onRecommendCondition,
  onRecommendConditions,
  canApplyCondition,
  conditionGuide,
  closeRequest = 0,
  draftText,
  draftRevision,
  transcript,
  onApplyDraft,
  onAssistantAction,
  onOpenChange,
  adapter = scriptedAssistantAdapter,
}: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const dialogOpen = useDialogOpen();
  const closePopupRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (closeRequest > 0) {
      closePopupRef.current();
    }
  }, [closeRequest]);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const usedCount = requiredFeatures
    ? ASSISTANT_FEATURE_ORDER.filter((feature) => requiredFeatures.used.has(feature)).length
    : 0;
  // T109: 한 가지 이상 쓰면 완료(옛 이름 allUsed·onAllUsed는 그대로 둔다).
  const firstUnusedFeature = (Object.keys(FEATURE_LABELS) as FeatureKey[]).find(
    (feature) => !(requiredFeatures?.used.has(feature) ?? false),
  );
  const allUsed = requiredFeatures !== undefined && usedCount >= 1;
  const onAllUsed = requiredFeatures?.onAllUsed;
  const allUsedNotifiedRef = useRef(false);
  useEffect(() => {
    if (allUsed && !allUsedNotifiedRef.current) {
      allUsedNotifiedRef.current = true;
      onAllUsed?.();
    }
  }, [allUsed, onAllUsed]);
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [summaryResult, setSummaryResult] = useState<SummarizeOpinionsResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareConditionsResult | null>(null);
  const [refineResult, setRefineResult] = useState<RefineDraftResult | null>(null);
  const [refineResultRevision, setRefineResultRevision] = useState<number | null>(null);
  // T115: 요약은 요청 시점의 회의 기록(transcript.revision)에 대한 결과다. 새 발언이 도착해 기록이
  // 바뀌면 옛 요약을 비워 지금 임원 입장과 어긋난 내용이 남지 않게 한다.
  const [summaryRevision, setSummaryRevision] = useState<number | null>(null);

  // 리셋·재요청 뒤 도착한 응답을 무시하기 위해 "지금 유효한 요청"만 기록한다.
  // sessionId가 바뀌면(리셋으로 새 세션이 되면) 이전 요청은 더 이상 유효하지 않다.
  const currentRequestRef = useRef<{
    sessionId: string;
    requestId: string;
    controller: AbortController;
  } | null>(null);

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

  useEffect(() => {
    if (summaryRevision !== null && summaryRevision !== transcript.revision) {
      setSummaryResult(null);
      setSummaryRevision(null);
      if (activeFeature === 'summary') {
        currentRequestRef.current?.controller.abort();
        currentRequestRef.current = null;
        setStatus('idle');
        setActiveFeature(null);
      }
    }
  }, [transcript.revision, summaryRevision, activeFeature]);

  // PR #20 Codex 32차 P2-2: 로딩 중에 팝업을 닫으면 진행 중 요청을 무효화하고 idle로
  // 되돌린다 — 닫힌 뒤 도착한 응답·오류가 화면에 보인 적 없이 사용으로 집계되지 않게
  // 한다(isStillCurrent가 false가 되어 기록 없이 버려진다). 이미 끝난 결과는 그대로 둔다.
  const statusRef = useRef(status);
  statusRef.current = status;
  function closePopup() {
    if (statusRef.current === 'loading') {
      currentRequestRef.current?.controller.abort();
      currentRequestRef.current = null;
      setStatus('idle');
      setActiveFeature(null);
    }
    setOpen(false);
  }
  closePopupRef.current = closePopup;

  function isStillCurrent(requestId: string): boolean {
    return currentRequestRef.current?.requestId === requestId;
  }

  async function runFeature(feature: FeatureKey) {
    // 사용자 보고(2026-10-09 "의견 한눈에 보기가 잘 안 눌리고 수행도 잘 안 됨"): 정리하는 3초 동안
    // 같은 버튼을 거듭 누르면 요청이 그때마다 새로 나가 앞 요청이 취소돼 결과가 늦게/안 보였다.
    // 정리하는 중에는 같은 기능 재호출을 무시한다(버튼도 비활성).
    if (status === 'loading') {
      return;
    }
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
        const result = await withTimeout(
          adapter.summarizeOpinions({ ...base, scenario, transcript }),
        );
        if (!isStillCurrent(requestId)) return;
        setSummaryResult(result);
        setSummaryRevision(transcript.revision);
        setStatus('done');
        onAssistantAction({
          type: 'OPINION_SUMMARY',
          mode: result.mode,
          evidenceIds: result.evidenceIds,
        });
      } else if (feature === 'compare') {
        const result = await withTimeout(
          adapter.compareConditions({ ...base, scenario, selectedConditionIds }),
        );
        if (!isStillCurrent(requestId)) return;
        setCompareResult(result);
        setStatus('done');
        // T96(2026-10-08 사용자 지시 "AI 비서실장을 잘 쓰면 ... 큰 도움이 된다고
        // 느끼게"): "조건 비교하기"를 "조건 추천"으로 강화하면서, 결과 화면에도 옛
        // CONDITION_COMPARE 한 줄 대신 "조건 추천 N회"(countConditionRecommendation)로
        // 보여준다 — 같은 버튼이 두 줄로 중복 기록되지 않게 CONDITION_COMPARE는 더
        // 남기지 않는다.
        onAssistantAction({
          type: 'CONDITION_RECOMMEND_VIEW',
          mode: result.mode,
          // T101: 추천한 조건 id를 함께 남겨 결과 화면이 이름을 보여준다.
          evidenceIds: recommendedConditionIds(recommendation),
        });
      } else {
        const result = await withTimeout(
          adapter.refineDraft({
            ...base,
            scenario,
            draftText,
            draftRevision: requestDraftRevision,
          }),
        );
        if (!isStillCurrent(requestId)) return;
        if (requestDraftRevision !== draftRevision) {
          // 응답을 기다리는 사이 원문이 더 바뀌었다 — 이 초안은 이미 낡았다.
          // 의도: 낡은 초안은 사용으로 세지 않는다(기록 없이 idle) — 참가자가 다시 누르면 센다.
          setStatus('idle');
          setActiveFeature(null);
          return;
        }
        setRefineResult(result);
        setRefineResultRevision(requestDraftRevision);
        setStatus('done');
        // T97: 정리한 초안을 화면에 보여준 것도 "써 본 것"이다(applied:false — 결과 화면
        // 'AI가 도운 일'에는 '내 발언에 적용'을 눌렀을 때만 나온다).
        onAssistantAction({
          type: 'DRAFT_REFINE',
          mode: result.mode,
          evidenceIds: result.evidenceIds,
          applied: false,
        });
      }
    } catch {
      if (!isStillCurrent(requestId)) return;
      setStatus('error');
      // T97: 실패·연결 지연 안내를 본 것도 "써 본 것"으로 센다(failed:true — 결과
      // 화면 'AI가 도운 일'에는 나오지 않는다). 막히는 참가자가 없게 하기 위함이다.
      onAssistantAction({
        type:
          feature === 'summary'
            ? 'OPINION_SUMMARY'
            : feature === 'compare'
              ? 'CONDITION_RECOMMEND_VIEW'
              : 'DRAFT_REFINE',
        mode,
        evidenceIds: [],
        applied: false,
        failed: true,
      });
    }
  }

  // T96 "조건 추천" 본문(규칙 기반, scripted·live 공통·즉시 — adapter 응답과 무관하게
  // scenario.voteRules·requiredConditionsFor로 바로 계산한다). 아직 찬성이 아닌 임원들을
  // 움직이는 데 필요한 조건만 골라 "이 조건이 움직이는 임원 · 푸는 걱정"으로 보여준다.
  // live 발언의 제안 조건은 따로 안 넘기면 transcript의 역할별 최신 발언에서 뽑는다
  // (PR #20 Codex 28차 P2-3).
  // T115: "처음 안과의 차이"·"남은 확인 사항"은 요청 시점의 스냅샷이 아니라 지금 확정한 조건으로 그린다
  // ("적용"으로 조건이 바뀐 뒤에도 옛 목록이 남아 추천과 어긋나지 않게).
  const compareView = useMemo(() => buildCompare(scenario, selectedConditionIds), [scenario, selectedConditionIds]);
  // T119: 추천 문구·추가 답변 어디에도 없는 조건은 "남은 확인 사항"에서도 안내하지 않는다.
  const remainingShown = useMemo(
    () => compareView.remainingConditionIds.filter((id) => conditionGuide?.offered(id) !== false),
    [compareView, conditionGuide],
  );
  const transcriptStatements = transcript.statements;
  const effectiveLiveSuggestions = useMemo(
    () => liveSuggestedConditionIds ?? latestSuggestedConditionIds(transcriptStatements),
    [liveSuggestedConditionIds, transcriptStatements],
  );
  const recommendation = useMemo(
    () =>
      buildConditionRecommendation(
        scenario,
        selectedConditionIds,
        participantStance,
        mode,
        stances,
        effectiveLiveSuggestions,
        awaitingAnswerIds,
        conditionGuide?.offered,
      ),
    [
      scenario,
      selectedConditionIds,
      participantStance,
      mode,
      stances,
      effectiveLiveSuggestions,
      awaitingAnswerIds,
      conditionGuide,
    ],
  );

  // Codex 27차 검토 P2-3: "적용"을 눌러도 매칭되는 추천 문구가 없거나(예: REACTIONS
  // 찬성 경로에 REVIEW 쪽 옵션이 없는 경우) 직접 쓴 내용이 있어 RebuildConfirm만 뜨고
  // 아직 반영되지 않았으면, 실제로 체크되지 않았으므로 사용 기록을 남기지 않는다.
  // onRecommendCondition이 "실제로 반영됐는지"를 true/false(또는 그 Promise)로 돌려준다.
  async function handleApplyRecommendation(conditionId: string) {
    const applied = await onRecommendCondition?.(conditionId);
    if (!applied) {
      return;
    }
    onAssistantAction({
      type: 'CONDITION_RECOMMEND_APPLY',
      // "적용" 버튼은 조건 추천 결과(compareResult)가 이미 보이는 동안에만 눌릴 수
      // 있어 compareResult.mode가 항상 있지만, 방어적으로 scripted를 기본값으로 둔다.
      mode: compareResult?.mode ?? 'scripted',
      evidenceIds: [conditionId],
    });
  }

  /** 복합 조합 묶음("○○ + △△ 모두 있어야 움직임")의 "적용" — 조합 안의 조건을
   * 하나씩 같은 규칙으로 적용한다. */
  async function handleApplyBundle(conditionIds: readonly string[]) {
    if (!onRecommendConditions) {
      for (const conditionId of conditionIds) {
        await handleApplyRecommendation(conditionId);
      }
      return;
    }
    // 묶음 전체를 화면에 한 번에 넘겨 단일 상태 업데이트로 반영하게 한다. 실제로
    // 반영된 조건만 기록한다("추천 조건 N개 반영"이 실제 수와 같아야 한다).
    const appliedIds = await onRecommendConditions([...conditionIds]);
    for (const conditionId of appliedIds) {
      onAssistantAction({
        type: 'CONDITION_RECOMMEND_APPLY',
        mode: compareResult?.mode ?? 'scripted',
        evidenceIds: [conditionId],
      });
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

  // T86(2026-10-07 사용자 — "실시간 표시는 제거해줘", 이어서 "사전 구성 시뮬레이션
  // 표시도 빼줘"): live·scripted 가리지 않고 이 캡션 자체를 그리지 않는다.
  // T89(2026-10-07 사용자 — "AI 비서실장의 팝업창을 근거 자료 팝업과 동일한 디자인으로"):
  // 오른쪽 열 위에 겹치는 드로어에서 EvidenceDialog와 같은 모달 팝업(DialogShell)으로
  // 바꿨다. 닫기는 이제 팝업 자체의 닫기 버튼이 맡으므로, 토글 버튼은 "숨기기" 상태를
  // 더 갖지 않고 늘 같은 문구다.

  return (
    <div className="assistant-panel">
      <button
        type="button"
        className="cta cta--secondary assistant-panel__toggle"
        onClick={() => setOpen(true)}
        disabled={toggleLocked}
        aria-describedby={toggleLocked ? 'assistant-toggle-why' : undefined}
        data-testid="assistant-toggle"
        {...nextStepAttr(focusNext && !dialogOpen && !toggleLocked)}
      >
        AI 비서실장에게 맡기기
      </button>
      {toggleLocked && (
        <span id="assistant-toggle-why" className="sr-only" data-testid="assistant-toggle-hint">
          {toggleLockedHint ?? '먼저 추천 문구를 골라 주세요'}
        </span>
      )}
      {open && (
        <DialogShell
          testId="assistant-panel"
          titleId="assistant-panel-title"
          title="AI 비서실장"
          onClose={closePopup}
          closeTestId="assistant-close"
        >
          <div className="assistant-panel__content">
            {requiredFeatures && (
              <div
                className={`assistant-intro${status === 'idle' ? '' : ' assistant-intro--compact'}`}
                data-testid={status === 'idle' ? 'assistant-intro' : 'assistant-intro-compact'}
              >
                {status === 'idle' ? (
                  <>
                    <h3 className="assistant-intro__title">
                      AI 비서실장이 도와드립니다 — 하나 이상 써 보세요(셋 다 써도 좋아요)
                    </h3>
                    <ul className="assistant-intro__list">
                      {ASSISTANT_FEATURE_ORDER.map((feature) => {
                        const used = requiredFeatures.used.has(feature);
                        return (
                          <li key={feature} className="assistant-intro__item">
                            <span
                              className="assistant-intro__check"
                              role="img"
                              aria-label={used ? '완료' : '아직 안 씀'}
                              data-checked={used ? 'true' : 'false'}
                              data-testid={`assistant-check-${feature}`}
                            >
                              {used ? '☑' : '☐'}
                            </span>
                            <strong>{FEATURE_LABELS[feature]}</strong>
                            <span className="assistant-intro__desc">
                              {' '}
                              — {FEATURE_DESCRIPTIONS[feature]}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p
                    className="assistant-intro__compact-line"
                    data-testid="assistant-intro-compact-line"
                  >
                    {ASSISTANT_FEATURE_ORDER.map((feature, index) => (
                      <span key={feature}>
                        {index > 0 && ' '}
                        <span
                          role="img"
                          aria-label={requiredFeatures.used.has(feature) ? '완료' : '아직 안 씀'}
                          data-testid={`assistant-check-${feature}`}
                          data-checked={requiredFeatures.used.has(feature) ? 'true' : 'false'}
                        >
                          {requiredFeatures.used.has(feature) ? '☑' : '☐'}
                        </span>{' '}
                        {FEATURE_LABELS[feature]}
                      </span>
                    ))}
                  </p>
                )}
                {allUsed && (
                  <p className="assistant-intro__done" data-testid="assistant-intro-done">
                    이제 팝업을 닫고 의견을 전달하세요
                  </p>
                )}
              </div>
            )}
            <div className="assistant-panel__actions">
              {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((feature) => {
                const used = requiredFeatures?.used.has(feature) ?? false;
                return (
                  <button
                    key={feature}
                    type="button"
                    className="cta cta--secondary"
                    onClick={() => runFeature(feature)}
                    disabled={status === 'loading'}
                    aria-busy={status === 'loading' && activeFeature === feature ? true : undefined}
                    data-testid={`assistant-action-${feature}`}
                    {...nextStepAttr(focusNext && status !== 'loading' && feature === firstUnusedFeature)}
                  >
                    {status === 'loading' && activeFeature === feature ? `${FEATURE_LABELS[feature]} · 정리 중…` : FEATURE_LABELS[feature]}
                    {used && (
                      <span
                        className="assistant-panel__done-mark"
                        data-testid={`assistant-done-${feature}`}
                      >
                        {' '}
                        · 완료
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="assistant-panel__results" data-testid="assistant-results">
              {status === 'loading' && <p data-testid="assistant-loading">정리하는 중입니다…</p>}
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
                  <p className="assistant-panel__evidence">
                    근거:{' '}
                    {summaryResult.evidenceIds.map((id) => evidenceLabel(scenario, id)).join(', ')}
                  </p>
                </div>
              )}
              {status === 'done' && activeFeature === 'compare' && compareResult && (
                <div data-testid="assistant-result-compare">
                  {/* T96 조건 추천(규칙 기반, scripted·live 공통): 아직 설득되지 않은
                  임원을 움직이는 조건과, 그 조건이 푸는 걱정을 먼저 보여준다. */}
                  <h4>조건 추천</h4>
                  <p data-testid="assistant-recommend-opening">
                    {recommendation.openingLine}
                    {recommendation.usedRuleFallback && ' (참고)'}
                  </p>
                  {recommendation.rows.length > 0 && (
                    <ul data-testid="assistant-recommend-rows">
                      {recommendation.rows.map((row) => (
                        <li
                          key={row.conditionId}
                          data-testid={`assistant-recommend-row-${row.conditionId}`}
                        >
                          <span className="assistant-panel__recommend-label">{row.label}</span>
                          <span className="assistant-panel__recommend-moves">
                            움직이는 임원 · {row.movedMemberIds.join('·')}
                          </span>
                          {row.worry && (
                            <span className="assistant-panel__recommend-worry">
                              푸는 걱정 · {row.worry}
                            </span>
                          )}
                          {conditionGuide?.hint(row.conditionId) && (
                            <span
                              className="assistant-panel__recommend-where"
                              data-testid={`assistant-recommend-where-${row.conditionId}`}
                            >
                              붙이는 곳 · {conditionGuide.hint(row.conditionId)}
                            </span>
                          )}
                          {canApplyCondition && !canApplyCondition(row.conditionId) ? (
                            <span
                              className="assistant-panel__recommend-manual"
                              data-testid={`assistant-recommend-manual-${row.conditionId}`}
                            >
                              직접 써 주세요
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="cta cta--secondary"
                              onClick={() => handleApplyRecommendation(row.conditionId)}
                              data-testid={`assistant-recommend-apply-${row.conditionId}`}
                            >
                              적용
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Codex 27차 검토 P2-1: 조건 2개 이상을 모두 확정해야 YES가 되는 임원은
                  단일 조건 행 대신 묶음으로 보여준다 — "LIMIT 하나만 있으면 CFO가
                  움직인다"는 거짓 정보를 막는다. */}
                  {recommendation.bundles.length > 0 && (
                    <ul data-testid="assistant-recommend-bundles">
                      {recommendation.bundles.map((bundle) => {
                        const bundleKey = bundle.conditionIds.join('+');
                        return (
                          <li
                            key={bundleKey}
                            data-testid={`assistant-recommend-bundle-${bundleKey}`}
                          >
                            <span className="assistant-panel__recommend-label">
                              {bundle.labels.join(' + ')} 모두 있어야 움직임
                            </span>
                            <span className="assistant-panel__recommend-moves">
                              움직이는 임원 · {bundle.movedMemberIds.join('·')}
                            </span>
                            {canApplyCondition && !bundle.conditionIds.every(canApplyCondition) ? (
                              <span
                                className="assistant-panel__recommend-manual"
                                data-testid={`assistant-recommend-manual-bundle-${bundleKey}`}
                              >
                                직접 써 주세요
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="cta cta--secondary"
                                onClick={() => handleApplyBundle(bundle.conditionIds)}
                                data-testid={`assistant-recommend-apply-bundle-${bundleKey}`}
                              >
                                모두 적용
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <h4>처음 안과의 차이</h4>
                  {compareView.addedConditionIds.length > 0 ? (
                    <ul>
                      {compareView.addedConditionIds.map((id) => (
                        <li key={id}>{conditionLabel(scenario, id)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>지금까지 확정한 조건이 없습니다.</p>
                  )}
                  <h4>남은 확인 사항</h4>
                  {remainingShown.length > 0 ? (
                    <ul>
                      {remainingShown.map((id) => (
                          <li key={id} data-testid={`assistant-remaining-${id}`}>
                            {conditionLabel(scenario, id)}
                            {conditionGuide?.hint(id) && (
                              <span className="assistant-panel__remaining-where">
                                {' '}
                                · {conditionGuide.hint(id)}
                              </span>
                            )}
                          </li>
                      ))}
                    </ul>
                  ) : (
                    <p>남은 확인 사항이 없습니다.</p>
                  )}
                </div>
              )}
              {status === 'done' && activeFeature === 'refine' && refineResult && (
                <div data-testid="assistant-result-refine">
                  <div className="assistant-panel__refine-compare">
                    <div className="assistant-panel__refine-original">
                      <h4>원문</h4>
                      <p data-testid="assistant-refine-original">{draftText}</p>
                    </div>
                    <div className="assistant-panel__refine-draft-wrap">
                      <h4>정리한 초안</h4>
                      <p
                        className="assistant-panel__refine-draft"
                        data-testid="assistant-refine-draft"
                      >
                        {refineResult.draftText}
                      </p>
                    </div>
                  </div>
                  <div className="assistant-panel__refine-choices">
                    <button
                      type="button"
                      className="cta cta--secondary"
                      onClick={handleApplyRefine}
                      data-testid="assistant-apply-refine"
                    >
                      내 발언에 적용
                    </button>
                    <button
                      type="button"
                      className="cta cta--secondary"
                      onClick={handleKeepOriginal}
                      data-testid="assistant-keep-original"
                    >
                      원문 유지
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
}
