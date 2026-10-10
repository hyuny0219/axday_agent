// 진행 도우미 말풍선을 화면 위에 올리는 연결부(T103·T104). 세션·화면 상태로
// domain/coach.ts가 고른 화면 안내를 content/coach.ts의 문구와 함께 Coach에 넘기고,
// "알겠어요" 또는 그 화면의 첫 조작(버튼·카드 클릭)이 있으면 세션의 coachDismissed에 기록해
// 한 번만 보이게 한다. 규칙은 도메인에 있고 여기서는 연결만 한다.

import { useEffect, useRef, useState } from 'react';
import { COACH_TOTAL, coachScreenOf, coachStep, type CoachUi } from '../../domain/coach';
import type { SessionAction } from '../../domain/session';
import type { Session } from '../../domain/types';
import { COACH_CLOSE_LABEL, coachCopy } from '../../content/coach';
import { Coach, CoachIcon } from './Coach';
import { clearCoachPos } from './coachPosition';
import { HighlightText } from './HighlightText';
import { useDialogOpen } from './useDialogOpen';

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
  const screen = session.coachEnabled ? coachScreenOf(session, ui) : null;
  // 아이콘으로 다시 연 화면 번호. 세션에 저장하지 않는 화면 안 상태이고, 화면이 바뀌면 비운다.
  const [reopenedScreen, setReopenedScreen] = useState<number | null>(null);
  const reopened = screen !== null && reopenedScreen === screen;

  useEffect(() => {
    setReopenedScreen(null);
  }, [screen]);

  // 팝업(role=dialog)이 열려 있는 동안은 말풍선·아이콘을 아예 그리지 않는다 — z-index로는
  // 축소 모드(.app-scale-wrapper의 transform이 만드는 stacking context) 안의 팝업과 body로
  // portal된 코치를 비교할 수 없다(PR #20 Codex 44차 검토 P2).
  // 새 체험(sessionId 변경)이면 옮겨 둔 자리를 지우고 기본 자리로 돌아간다(T112).
  const sessionIdRef = useRef(session.sessionId);
  useEffect(() => {
    if (sessionIdRef.current !== session.sessionId) {
      sessionIdRef.current = session.sessionId;
      clearCoachPos();
    }
  }, [session.sessionId]);

  const dialogOpen = useDialogOpen();

  useEffect(() => {
    if (!reopened) {
      return;
    }
    function handleKey(event: KeyboardEvent) {
      // 팝업(role=dialog)이 열려 있으면 Esc는 팝업이 쓴다 — 안내까지 같이 닫지 않는다.
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setReopenedScreen(null);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [reopened]);

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

  if (screen === null || dialogOpen) {
    return null;
  }
  if (step === null) {
    if (!reopened) {
      return <CoachIcon onOpen={() => setReopenedScreen(screen)} />;
    }
    const again = coachCopy(screen, session.mode);
    return (
      <Coach
        step={screen}
        total={COACH_TOTAL}
        title={<HighlightText text={again.title} terms={again.keys} />}
        lines={again.lines}
        ackLabel={COACH_CLOSE_LABEL}
        onAck={() => setReopenedScreen(null)}
      />
    );
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
