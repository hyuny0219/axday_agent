// 자동 진행이 지금 어디까지 왔는지를 화면에 알리는 문맥(T144). 호스트(AutoPlayHost)가 채우고
// 화면은 읽기만 한다. 켜져 있지 않으면 기본값(enabled=false)이라 화면은 평소처럼 움직인다.

import { createContext, useContext } from 'react';
import type { AutoAction } from '../../domain/autoPlay';

export interface AutoRunState {
  /** 이 화면에서 자동 진행이 켜져 있다(동작이 끝나기 전·후 모두 true). */
  enabled: boolean;
  /** 동작이 끝나지 않았다(입력이 막혀 있다). */
  running: boolean;
  /** 모든 동작이 끝나 참가자 차례. */
  done: boolean;
  /** 지금 하는 동작(시작 전·끝난 뒤는 null). */
  action: AutoAction | null;
}

export const INACTIVE_AUTO_RUN: AutoRunState = { enabled: false, running: false, done: true, action: null };

export const AutoRunContext = createContext<AutoRunState>(INACTIVE_AUTO_RUN);

/** 화면이 고른 입장(찬성/반대)을 자동 진행 호스트에 알리는 길(T145). 입장은 StageScreen 상태라 호스트가 직접 못 본다. */
export type AutoSide = 'FOR' | 'AGAINST' | null;
export const AutoSideReportContext = createContext<(side: AutoSide) => void>(() => {});

export function useAutoRun(): AutoRunState {
  return useContext(AutoRunContext);
}
