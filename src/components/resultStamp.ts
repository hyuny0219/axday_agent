// 결과 연출 도장 문구(DESIGN_SPEC.md v1.0 3절): PASS이고 반영 조건이 있으면 "조건부
// 가결", PASS는 "가결", REJECT는 "부결"(T62: 보류 제거로 두 갈래만 남았다). T44에서
// 도장을 무대 열 우하단으로 옮기며 App.tsx(StageBand에 넘길 값 계산)와 ResultScreen이
// 함께 쓰는 순수 함수로 뽑아냈다 — 표결 판정 자체(domain/voting.ts)는 손대지 않는다.

import type { Vote } from '../content/types';
import type { Session } from '../domain/types';
import { persuasionStamp, type PersuasionStamp } from '../domain/stance';
import { collectConfirmedConditionIds } from './opinionConditions';

/** 임원 표 순차 공개 타이밍(초, T114). 결과에 들어오면 임원 네 장이 봉인('?')으로 시작해
 * EXEC_REVEAL_FIRST_SECONDS 뒤부터 EXEC_REVEAL_STEP_SECONDS 간격으로 CEO→CFO→CAIO→CISO
 * 순서로 한 장씩 뒤집힌다. 참가자 표는 이미 아는 값이라 가리지 않는다. 집계 숫자·결론
 * 문구·가결/부결 도장은 마지막 장이 다 뒤집힌 뒤에 나온다. ResultScreen(좌측 막대·우측
 * 판단 행)과 StageBand(표 배지)가 같은 값을 쓰도록 여기 한 곳에 둔다. setTimeout이 아니라
 * CSS animation-delay로 그대로 꽂아 Clock 규칙과 무관하게 만든다 — prefers-reduced-motion
 * (base.css가 delay를 0으로)과 운영자 skip(`data-result-skip`)이면 즉시 전부 공개된다. */
export const EXEC_REVEAL_FIRST_SECONDS = 0.9;
export const EXEC_REVEAL_STEP_SECONDS = 0.9;
/** 한 장이 뒤집히는 데 걸리는 시간(초). CSS의 `--reveal-flip` 값과 같다. */
export const EXEC_REVEAL_FLIP_SECONDS = 0.5;

/** i번째(0부터, EXEC_MEMBER_ORDER 순) 임원 표가 뒤집히기 시작하는 시각(초). */
export function execRevealDelay(index: number): number {
  return EXEC_REVEAL_FIRST_SECONDS + Math.max(index, 0) * EXEC_REVEAL_STEP_SECONDS;
}

/** 임원 네 장이 모두 공개된 시각(초) — 집계 숫자·결론 문구가 나오는 때. */
export const ALL_EXEC_REVEALED_SECONDS = execRevealDelay(3) + EXEC_REVEAL_FLIP_SECONDS;

/** 마지막 장 뒤에 기존 가결·부결 도장이 이어진다. */
export const STAMP_DELAY_SECONDS = ALL_EXEC_REVEALED_SECONDS + 0.1;

/** "설득 도장"(T63)은 기존 가결·부결 도장이 다 찍힌 0.4초 뒤에 등장한다. */
export const PERSUASION_STAMP_DELAY_SECONDS = STAMP_DELAY_SECONDS + 0.4;

export function stampText(outcome: Session['outcome'], hasReflectedConditions: boolean): string {
  if (outcome === 'PASS') {
    return hasReflectedConditions ? '조건부 가결' : '가결';
  }
  if (outcome === 'REJECT') {
    return '부결';
  }
  return '';
}

export interface ResultStamp {
  text: string;
  outcome: Session['outcome'];
}

/** finalMotion이 없으면(RESULT 진입 전) null을 돌려준다. */
export function computeResultStamp(session: Session): ResultStamp | null {
  const finalMotion = session.finalMotion;
  if (!finalMotion) {
    return null;
  }
  const allConfirmedIds = collectConfirmedConditionIds(session.opinions);
  const includedIds = allConfirmedIds.filter((id) => finalMotion.effectiveConditionIds.includes(id));
  const text = stampText(session.outcome, includedIds.length > 0);
  if (!text) {
    return null;
  }
  return { text, outcome: session.outcome };
}

export interface ResultPersuasion extends PersuasionStamp {
  participantVote: Vote;
}

/** "설득 도장" 판정(T63): 내 표와 같은 표가 나를 포함해 3석 이상이면 earned다. 참가자
 * 좌석이 아직 없거나(RESULT 진입 전) UNCAST면 null — 도장·근거 줄 모두 그리지 않는다. */
export function computePersuasion(session: Session): ResultPersuasion | null {
  const participant = session.ballots.find((b) => b.memberId === 'PARTICIPANT');
  if (!participant || participant.vote === 'UNCAST') {
    return null;
  }
  return { ...persuasionStamp(session.ballots, participant.vote), participantVote: participant.vote };
}
