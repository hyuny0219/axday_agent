// 진행 스트립(v0.9, REVISION_DECISIONS_v0.9.md 1-5): 헤더 pill 하나로는 여정이 보이지
// 않는다는 진단에 따라 ① 상황 파악 → ⑤ 표결까지 5단계를 상시 표시한다. ATTRACT·SELECT는
// 아직 여정이 시작되지 않은 단계라 제외한다(App.tsx가 렌더 여부를 결정).

import type { SessionStage } from '../../domain/types';
import '../../styles/screens/shell.css';

interface ProgressStep {
  step: number;
  label: string;
}

// T64(Main.html 단계 탭): 원(①~⑤) 대신 두 자리 숫자(01~05)로 바꾼다 — 각진 종이 탭
// 모양과 어울리는 타자기 표기다. 단계 이름 자체(상황 파악·임원 의견 등)는 그대로 둔다.
const STEPS: ProgressStep[] = [
  { step: 1, label: '01 상황 파악' },
  { step: 2, label: '02 임원 의견' },
  { step: 3, label: '03 내 의견' },
  { step: 4, label: '04 반응에 답하기' },
  { step: 5, label: '05 표결' },
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

  // RESULT(T85 #24): 여정이 끝났으므로 탭 5개 모두 완료로 보여준다 — "지금 단계"
  // 표시(aria-current)는 더는 의미가 없어 끈다("05 표결"에 계속 머무는 것처럼
  // 보이던 문제).
  const isResult = stage === 'RESULT';

  return (
    <nav className="progress-strip" aria-label="진행 단계" data-testid="progress-strip">
      <ol className="progress-strip__list">
        {STEPS.map(({ step, label }) => (
          <li
            key={step}
            className="progress-strip__step"
            data-testid={`progress-step-${step}`}
            aria-current={!isResult && step === currentStep ? 'step' : undefined}
            data-done={(isResult ? step <= currentStep : step < currentStep) ? 'true' : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
