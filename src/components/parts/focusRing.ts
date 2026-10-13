// "다음 할 일" 점선(T113)의 React 연결부. 화면이 domain/nextStep.ts로 고른 키 하나에 해당하는
// 요소에만 `data-next-step` 속성을 붙이고, 점선은 styles/screens/focus.css가 그린다.
// 시작 지연(6초)·`?focus=off`·팝업 중 숨김을 여기서 처리한다. 규칙은 도메인에 있다.

import { useEffect, useState } from 'react';
import '../../styles/screens/focus.css';
import { useDialogOpen } from './useDialogOpen';
import { FOCUS_DELAY_MS, focusDisabledBySearch, isFocusArmed } from '../../domain/nextStep';

/** 점선을 붙일 요소에 펼쳐 쓴다. `active`가 아니면 아무 속성도 붙지 않는다. */
export function nextStepAttr(active: boolean): { 'data-next-step'?: '' } {
  return active ? { 'data-next-step': '' } : {};
}

function readFocusEnabled(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return !focusDisabledBySearch(window.location.search);
}

export interface FocusGate {
  /** 점선을 켜도 되는 때(켜져 있고, 6초가 지났거나 이미 무언가 눌렀다). 팝업은 따지지 않는다. */
  armed: boolean;
  /** armed이면서 팝업이 없을 때 — 화면 본문 요소에 붙일 때 쓴다. */
  visible: boolean;
}

/**
 * 화면(또는 단계)마다 `scope`를 달리 주면, 그 범위에 들어온 뒤 FOCUS_DELAY_MS 동안 아무것도
 * 누르지 않았을 때 armed가 된다. 클릭이나 키 입력이 한 번이라도 있으면 지연 없이 바로 armed.
 */
export function useFocusGate(scope: string): FocusGate {
  const enabled = readFocusEnabled();
  const [interactedScope, setInteractedScope] = useState<string | null>(null);
  const [idleScope, setIdleScope] = useState<string | null>(null);
  const dialogOpen = useDialogOpen();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = window.setTimeout(() => setIdleScope(scope), FOCUS_DELAY_MS);
    // 클릭이 끝난 뒤에 기록한다 — 같은 클릭 안에서 바로 다시 그리면 라벨이 보내는 라디오 클릭의
    // 선택 상태(제어 컴포넌트)와 엇갈려 표결 도장이 선택되지 않는다(CoachHost와 같은 이유).
    let pending: number | undefined;
    function handleInteraction() {
      pending = window.setTimeout(() => setInteractedScope(scope), 0);
    }
    document.addEventListener('click', handleInteraction, true);
    document.addEventListener('keydown', handleInteraction, true);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(pending);
      document.removeEventListener('click', handleInteraction, true);
      document.removeEventListener('keydown', handleInteraction, true);
    };
  }, [enabled, scope]);

  const armed = isFocusArmed({
    enabled,
    interacted: interactedScope === scope,
    idleMs: idleScope === scope ? FOCUS_DELAY_MS : 0,
  });
  return { armed, visible: armed && !dialogOpen };
}
