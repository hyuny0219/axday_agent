// 진행 스트립(v0.9, REVISION_DECISIONS_v0.9.md 1-5): 헤더 pill 하나로는 여정이 보이지
// 않는다는 진단에 따라 ① 상황 파악 → ⑤ 표결까지 5단계를 상시 표시한다. ATTRACT·SELECT는
// 아직 여정이 시작되지 않은 단계라 제외한다(App.tsx가 렌더 여부를 결정).

import type { SessionStage } from '../../domain/types';
import '../../styles/screens/shell.css';

interface ProgressStep {
  step: number;
  label: string;
}

const STEPS: ProgressStep[] = [
  { step: 1, label: '① 상황 파악' },
  { step: 2, label: '② 임원 의견' },
  { step: 3, label: '③ 내 의견' },
  { step: 4, label: '④ 반응에 답하기' },
  { step: 5, label: '⑤ 표결' },
];

/** BRIEFING~RESULT를 5단계로 묶는다. MOTION·VOTE·RESULT는 모두 마지막 '표결' 단계에
 * 속한다(최종안 고정부터 결과 확인까지가 한 국면이라는 판단, v0.9 판정 1-5). */
const STAGE_TO_STEP: Partial<Record<SessionStage, number>> = {
  BRIEFING: 1,
  OPINIONS: 2,
  DISCUSS: 3,
  REACTIONS: 4,
  MOTION: 5,
  VOTE: 5,
  RESULT: 5,
};

export interface ProgressStripProps {
  stage: SessionStage;
}

export function ProgressStrip({ stage }: ProgressStripProps) {
  const currentStep = STAGE_TO_STEP[stage];
  if (currentStep === undefined) {
    return null;
  }

  return (
    <nav className="progress-strip" aria-label="진행 단계" data-testid="progress-strip">
      <ol className="progress-strip__list">
        {STEPS.map(({ step, label }) => (
          <li
            key={step}
            className="progress-strip__step"
            data-testid={`progress-step-${step}`}
            aria-current={step === currentStep ? 'step' : undefined}
            data-done={step < currentStep ? 'true' : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
