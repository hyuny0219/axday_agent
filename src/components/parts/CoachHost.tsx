// 진행 도우미 말풍선을 화면 위에 올리는 연결부(T103·T104). 세션·화면 상태로
// domain/coach.ts가 고른 화면 안내를 content/coach.ts의 문구와 함께 Coach에 넘기고,
// "알겠어요" 또는 그 화면의 첫 조작(버튼·카드 클릭)이 있으면 세션의 coachDismissed에 기록해
// 한 번만 보이게 한다. 규칙은 도메인에 있고 여기서는 연결만 한다.

import { useEffect } from 'react';
import { COACH_TOTAL, coachStep, type CoachUi } from '../../domain/coach';
import type { SessionAction } from '../../domain/session';
import type { Session } from '../../domain/types';
import { coachCopy } from '../../content/coach';
import { Coach } from './Coach';
import { HighlightText } from './HighlightText';

export interface CoachHostProps {
  session: Session;
  ui: CoachUi;
  dispatch: (action: SessionAction) => void;
}

/** 조작으로 치는 요소. 운영 메뉴와 말풍선 자신은 조작으로 세지 않는다. */
const OPERABLE = 'button, a, input, textarea, select, label, [role="button"]';
const NOT_OPERATION = '[data-testid="coach"], .operator-menu__trigger, .operator-menu__panel';

export function CoachHost({ session, ui, dispatch }: CoachHostProps) {
  const step = coachStep(session, ui);

  useEffect(() => {
    if (step === null) {
      return;
    }
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(NOT_OPERATION) || !target.closest(OPERABLE)) {
        return;
      }
      // 클릭이 끝난 뒤에 기록한다 — 같은 클릭 안에서 바로 다시 그리면 라벨이 보내는 라디오
      // 클릭의 선택 상태(제어 컴포넌트)와 엇갈려 표결 도장이 선택되지 않는다.
      window.setTimeout(() => dispatch({ type: 'COACH_DISMISS', step: step as number }), 0);
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [step, dispatch]);

  if (step === null) {
    return null;
  }

  const copy = coachCopy(step, session.mode);
  return (
    <Coach
      step={step}
      total={COACH_TOTAL}
      title={<HighlightText text={copy.title} terms={copy.keys} />}
      lines={copy.lines}
      onAck={() => dispatch({ type: 'COACH_DISMISS', step })}
    />
  );
}
