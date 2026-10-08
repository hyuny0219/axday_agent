// 코치 한 개를 화면 위에 올리는 연결부(T103). 세션·화면 상태로 domain/coach.ts가 고른
// 단계를 content/coach.ts의 문구와 함께 Coach에 넘기고, 끝난 단계·읽음·건너뛰기를
// 세션의 coachDismissed에 기록한다. 규칙은 도메인에 있고 여기서는 연결만 한다.

import { useEffect } from 'react';
import {
  ASSISTANT_FEATURE_TOTAL,
  COACH_TOTAL,
  coachStep,
  coachStepsOf,
  coachTarget,
  isCoachInDialog,
  isReadStep,
  type CoachUi,
} from '../../domain/coach';
import type { SessionAction } from '../../domain/session';
import type { Session } from '../../domain/types';
import { assistantDialogCopy, coachAckLabel, coachCopy } from '../../content/coach';
import { Coach } from './Coach';
import { HighlightText } from './HighlightText';

export interface CoachHostProps {
  session: Session;
  ui: CoachUi;
  dispatch: (action: SessionAction) => void;
}

export function CoachHost({ session, ui, dispatch }: CoachHostProps) {
  const state = coachStep(session, ui);
  const doneStep = state?.done ? state.step : null;

  useEffect(() => {
    if (doneStep !== null) {
      dispatch({ type: 'COACH_DISMISS', step: doneStep });
    }
  }, [doneStep, dispatch]);

  if (!state || state.done) {
    return null;
  }
  // 근거 자료 팝업이 열려 있는 동안 1단계 말풍선은 숨긴다(팝업을 읽는 데 방해하지 않게).
  if (state.step === 1 && ui.evidenceOpen) {
    return null;
  }

  const step = state.step;
  const copy = coachCopy(step, session.mode);
  const target = coachTarget(step, session, ui);
  const inDialog = isCoachInDialog(step, ui);
  const dialogCopy = inDialog ? assistantDialogCopy(ui.assistantUsedCount, ASSISTANT_FEATURE_TOTAL) : null;
  const title = dialogCopy ? dialogCopy.title : copy.title;
  const keys = dialogCopy ? dialogCopy.keys : copy.keys;
  const body = dialogCopy ? dialogCopy.body : copy.body;

  function dismissStep() {
    dispatch({ type: 'COACH_DISMISS', step });
  }
  function skipScreen() {
    for (const item of coachStepsOf(session, ui)) {
      dispatch({ type: 'COACH_DISMISS', step: item });
    }
  }

  return (
    <Coach
      step={step}
      total={COACH_TOTAL}
      targetSelector={`[data-coach='${target}']`}
      title={<HighlightText text={title} terms={keys} />}
      body={body}
      placement={inDialog ? (target === 'assistant-close' ? 'left' : 'below') : copy.placement}
      onAck={isReadStep(step) ? dismissStep : undefined}
      ackLabel={coachAckLabel(step)}
      onSkip={skipScreen}
      dim={inDialog}
    />
  );
}
