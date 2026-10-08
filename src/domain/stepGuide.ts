// T98: DISCUSS·REACTIONS 오른쪽 종이의 진행 단계 안내판이 쓰는 순수 상태 계산.
// 화면(React)은 이 결과를 그대로 그리기만 한다. 칩은 순서대로 하나씩 끝나며, 앞 칩이
// 끝나지 않았으면 뒤 칩은 (조건을 먼저 채웠더라도) 현재 칩이 될 수 없다 — 현재 칩은
// "아직 끝나지 않은 첫 칩"이다.
import { ASSISTANT_FEATURE_ORDER, type AssistantFeatureKey } from './assistantLog';

export type StepKey = 'side' | 'phrase' | 'assistant' | 'submit';
export type StepStatus = 'done' | 'current' | 'upcoming';

export interface StepState {
  key: StepKey;
  status: StepStatus;
}

export interface StepGuideInput {
  side: 'FOR' | 'AGAINST' | null;
  /** 문구가 있고 확인 대기(RebuildConfirm)가 아닌 상태 — DiscussScreen의 draftReady. */
  draftReady: boolean;
  /** 이번 세션에 써 본 비서실장 기능(T97 assistantFeaturesUsed와 같은 값). */
  featuresUsed: ReadonlySet<AssistantFeatureKey>;
  /** false면 비서실장 칩을 뺀다(REACTIONS — 선택 사항이라 게이팅하지 않는다). */
  requireAssistant?: boolean;
}

export interface StepGuideState {
  steps: StepState[];
  /** 지금 가리킬 칩. 마지막 '전달'은 끝나지 않으므로 항상 하나가 있다. */
  current: StepKey;
  assistantUsedCount: number;
}

export function stepGuideState({
  side,
  draftReady,
  featuresUsed,
  requireAssistant = true,
}: StepGuideInput): StepGuideState {
  const assistantUsedCount = ASSISTANT_FEATURE_ORDER.filter((feature) =>
    featuresUsed.has(feature),
  ).length;
  const doneByKey: Record<StepKey, boolean> = {
    side: side !== null,
    phrase: draftReady,
    assistant: assistantUsedCount >= ASSISTANT_FEATURE_ORDER.length,
    submit: false,
  };
  const keys: StepKey[] = requireAssistant
    ? ['side', 'phrase', 'assistant', 'submit']
    : ['side', 'phrase', 'submit'];
  const current = keys.find((key) => !doneByKey[key]) ?? 'submit';
  const currentIndex = keys.indexOf(current);
  const steps = keys.map<StepState>((key, index) => ({
    key,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
  }));
  return { steps, current, assistantUsedCount };
}
