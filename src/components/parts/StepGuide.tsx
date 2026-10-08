// 진행 단계 안내판(T98, 2026-10-08 사용자 — "문장 한 줄보다는 포커싱해서 눈에 확 들어오게,
// 어떤 순서로 하면 좋은지 권고안"). 오른쪽 종이 제목 아래 가로 한 줄 번호 칩이다.
// 상태 계산은 domain/stepGuide.ts의 순수 함수가 하고, 이 컴포넌트는 그리기만 한다.
// 현재 칩에만 지시 문장이 붙고 data-guide="next"(맥동 테두리)가 걸린다.
import {
  ASSISTANT_FEATURE_ORDER,
  type AssistantFeatureKey,
} from '../../domain/assistantLog';
import { stepGuideState, type StepKey } from '../../domain/stepGuide';
import '../../styles/screens/stepGuide.css';

export interface StepGuideProps {
  /** discuss: ①입장 ②추천 문구 ③AI 비서실장 ④의견 전달, reactions: ①입장 ②추천 답변 ③답변 전달. */
  variant: 'discuss' | 'reactions';
  side: 'FOR' | 'AGAINST' | null;
  draftReady: boolean;
  featuresUsed?: ReadonlySet<AssistantFeatureKey>;
}

const CHECK_LABEL: Record<AssistantFeatureKey, string> = {
  summary: '한눈에 보기',
  compare: '조건 추천',
  refine: '발언 정리',
};

const CHIP_LABEL: Record<'discuss' | 'reactions', Record<StepKey, string>> = {
  discuss: {
    side: '입장 고르기',
    phrase: '추천 문구 고르기',
    assistant: 'AI 비서실장 세 가지',
    submit: '의견 전달',
  },
  reactions: {
    side: '입장 고르기',
    phrase: '추천 답변 고르기',
    assistant: 'AI 비서실장 세 가지',
    submit: '답변 전달',
  },
};

const SAY: Record<'discuss' | 'reactions', Record<StepKey, string>> = {
  discuss: {
    side: '찬성/반대 중 하나를 고르세요',
    phrase: '마음에 드는 문구를 눌러 담으세요(여러 개 가능)',
    assistant: "왼쪽 아래 'AI 비서실장에게 맡기기'를 열어 세 가지를 한 번씩 써 보세요",
    submit: "왼쪽 아래 '의견 전달'을 누르세요",
  },
  reactions: {
    side: '찬성/반대 중 하나를 고르세요',
    phrase: '마음에 드는 답변을 눌러 담거나 직접 쓰세요',
    assistant: '',
    submit: "왼쪽 아래 '답변 전달'을 누르세요",
  },
};

export function StepGuide({ variant, side, draftReady, featuresUsed }: StepGuideProps) {
  const used = featuresUsed ?? new Set<AssistantFeatureKey>();
  const state = stepGuideState({
    side,
    draftReady,
    featuresUsed: used,
    requireAssistant: variant === 'discuss',
  });
  return (
    <div className="step-guide" data-testid="step-guide" data-variant={variant}>
      <ol className="step-guide__list">
        {state.steps.map((step, index) => (
          <li
            key={step.key}
            className={`step-guide__chip step-guide__chip--${step.status}`}
            data-testid={`step-chip-${step.key}`}
            data-status={step.status}
            data-guide={step.status === 'current' ? 'next' : undefined}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            <span className="step-guide__num" aria-hidden="true">
              {step.status === 'done' ? '✓' : index + 1}
            </span>
            <span className="step-guide__label">
              {CHIP_LABEL[variant][step.key]}
              {step.status === 'done' && <span className="step-guide__sr"> (끝남)</span>}
            </span>
            {step.key === 'assistant' && (
              <span className="step-guide__checks" data-testid="step-assistant-checks">
                {ASSISTANT_FEATURE_ORDER.map((feature) => (
                  <span
                    key={feature}
                    role="img"
                    aria-label={`${CHECK_LABEL[feature]} ${used.has(feature) ? '완료' : '아직 안 씀'}`}
                    data-testid={`step-check-${feature}`}
                    data-checked={used.has(feature) ? 'true' : 'false'}
                  >
                    {used.has(feature) ? '☑' : '☐'}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
        {variant === 'reactions' && (
          <li className="step-guide__tag" data-testid="step-optional-tag">
            AI 비서실장은 선택
          </li>
        )}
      </ol>
      <p className="step-guide__say" data-testid="step-guide-say">
        {SAY[variant][state.current]}
      </p>
    </div>
  );
}
