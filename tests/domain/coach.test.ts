// 진행 도우미(T103·T104) 표시 규칙: 화면별 1회, dismissed, enabled.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_COACH_UI,
  coachStep,
  coachScreenOf,
  type CoachUi,
} from '../../src/domain/coach';
import { createInitialSession, reduce } from '../../src/domain/session';
import type { Session, SessionStage } from '../../src/domain/types';

function sessionAt(stage: SessionStage, patch: Partial<Session> = {}): Session {
  return { ...createInitialSession(0, 's1'), stage, scenarioId: 'ai-approval', ...patch };
}

function ui(patch: Partial<CoachUi> = {}): CoachUi {
  return { ...EMPTY_COACH_UI, ...patch };
}

describe('coachStep — 화면별 안내', () => {
  it('화면마다 안내 번호가 하나씩이다(6화면)', () => {
    expect(coachScreenOf(sessionAt('BRIEFING'), ui())).toBe(1);
    expect(coachScreenOf(sessionAt('OPINIONS'), ui())).toBe(2);
    expect(coachScreenOf(sessionAt('DISCUSS'), ui())).toBe(3);
    expect(coachScreenOf(sessionAt('REACTIONS'), ui({ reactionsStep: 'listen' }))).toBe(4);
    expect(coachScreenOf(sessionAt('VOTE'), ui())).toBe(5);
    expect(coachScreenOf(sessionAt('RESULT'), ui())).toBe(6);
  });

  it('REACTIONS 다시 답하기(2/2)와 안내 대상이 아닌 화면에는 안내가 없다', () => {
    expect(coachStep(sessionAt('REACTIONS'), ui({ reactionsStep: 'answer' }))).toBeNull();
    for (const stage of ['ATTRACT', 'INTRO', 'SELECT', 'MOTION'] as const) {
      expect(coachStep(sessionAt(stage), ui())).toBeNull();
    }
  });

  it('화면 안의 어떤 진행(입장·문구 등)도 안내를 막거나 바꾸지 않는다 — 번호는 화면 기준이다', () => {
    expect(coachStep(sessionAt('DISCUSS'), ui())).toBe(3);
  });
});

describe('coachStep — dismissed·enabled', () => {
  it('이미 본(dismissed) 단계는 다시 나오지 않는다', () => {
    expect(coachStep(sessionAt('BRIEFING', { coachDismissed: [1] }), ui())).toBeNull();
    expect(coachStep(sessionAt('OPINIONS', { coachDismissed: [2] }), ui())).toBeNull();
  });

  it('꺼져 있으면 아무 단계도 나오지 않고, 켜면 지금 화면 단계부터 나온다', () => {
    const off = sessionAt('DISCUSS', { coachEnabled: false });
    expect(coachStep(off, ui())).toBeNull();
    const on = reduce(off, { type: 'COACH_SET_ENABLED', enabled: true }, 0);
    expect(coachStep(on, ui())).toBe(3);
  });

  it('COACH_DISMISS는 중복 없이 기록하고, 새 체험(OPERATOR_RESET)은 초기화한다', () => {
    let s = sessionAt('OPINIONS');
    s = reduce(s, { type: 'COACH_DISMISS', step: 2 }, 0);
    s = reduce(s, { type: 'COACH_DISMISS', step: 2 }, 0);
    expect(s.coachDismissed).toEqual([2]);
    s = reduce(s, { type: 'COACH_SET_ENABLED', enabled: false }, 0);
    const reset = reduce(s, { type: 'OPERATOR_RESET', nextSessionId: 'next' }, 0);
    expect(reset.coachDismissed).toEqual([]);
    expect(reset.coachEnabled).toBe(true);
  });

  it('기본값은 켜짐, 건너뛴 단계 없음', () => {
    const s = createInitialSession(0, 's1');
    expect(s.coachEnabled).toBe(true);
    expect(s.coachDismissed).toEqual([]);
  });
});

