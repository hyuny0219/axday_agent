// DISCUSS 화면의 진행(입장·문구·비서실장·전달 가능)을 진행 도우미 체크리스트(T140)에 알리는
// 작은 저장소. 규칙은 domain/coach.ts(discussChecklist), 여기서는 값만 전달한다.

import { useSyncExternalStore } from 'react';
import { EMPTY_DISCUSS_PROGRESS, type DiscussProgress } from '../../domain/coach';

let current: DiscussProgress = EMPTY_DISCUSS_PROGRESS;
const listeners = new Set<() => void>();

export function setDiscussProgress(next: DiscussProgress): void {
  if (
    next.sideChosen === current.sideChosen &&
    next.hasDraft === current.hasDraft &&
    next.assistantUsed === current.assistantUsed &&
    next.canSubmit === current.canSubmit
  ) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
}

export function resetDiscussProgress(): void {
  setDiscussProgress(EMPTY_DISCUSS_PROGRESS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDiscussProgress(): DiscussProgress {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
