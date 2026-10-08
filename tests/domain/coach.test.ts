// 진행 도우미(T103) 단계 계산: 9단계 전이, dismissed, enabled.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_COACH_UI,
  coachStep,
  coachStepsOf,
  coachTarget,
  isCoachInDialog,
  isReadStep,
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

describe('coachStep — 화면별 단계', () => {
  it('BRIEFING은 1단계, 자료를 열어 닫으면 끝난 것으로 본다', () => {
    const s = sessionAt('BRIEFING');
    expect(coachStep(s, ui())).toEqual({ step: 1, done: false });
    expect(coachStep(s, ui({ evidenceSeen: true, evidenceOpen: true }))).toEqual({ step: 1, done: false });
    expect(coachStep(s, ui({ evidenceSeen: true }))).toEqual({ step: 1, done: true });
  });

  it('OPINIONS 2단계와 RESULT 9단계는 읽기만 하는 단계라 눌러야 끝난다', () => {
    expect(coachStep(sessionAt('OPINIONS'), ui({ side: 'FOR' }))).toEqual({ step: 2, done: false });
    expect(coachStep(sessionAt('RESULT'), ui())).toEqual({ step: 9, done: false });
    expect([2, 7, 9].every(isReadStep)).toBe(true);
    expect([1, 3, 4, 5, 6, 8].some(isReadStep)).toBe(false);
  });

  it('DISCUSS는 입장 → 추천 문구 → 비서실장 → 의견 전달(3·4·5·6) 순으로 넘어간다', () => {
    let s = sessionAt('DISCUSS');
    expect(coachStep(s, ui())).toEqual({ step: 3, done: false });
    expect(coachStep(s, ui({ side: 'FOR' }))).toEqual({ step: 3, done: true });

    s = { ...s, coachDismissed: [3] };
    expect(coachStep(s, ui({ side: 'FOR' }))).toEqual({ step: 4, done: false });
    expect(coachStep(s, ui({ side: 'FOR', draftReady: true }))).toEqual({ step: 4, done: true });

    s = { ...s, coachDismissed: [3, 4] };
    expect(coachStep(s, ui({ side: 'FOR', draftReady: true, assistantUsedCount: 1 }))).toEqual({
      step: 5,
      done: false,
    });
    // 3개를 다 써도 팝업이 열려 있는 동안은 5단계(닫기를 밝힌다).
    expect(
      coachStep(s, ui({ side: 'FOR', draftReady: true, assistantUsedCount: 3, assistantOpen: true })),
    ).toEqual({ step: 5, done: false });
    expect(coachStep(s, ui({ side: 'FOR', draftReady: true, assistantUsedCount: 3 }))).toEqual({
      step: 5,
      done: true,
    });

    s = { ...s, coachDismissed: [3, 4, 5] };
    expect(coachStep(s, ui({ side: 'FOR', draftReady: true, assistantUsedCount: 3 }))).toEqual({
      step: 6,
      done: false,
    });
  });

  it('REACTIONS는 반응 듣기(7)에서만 나오고 다시 답하기에는 코치가 없다', () => {
    const s = sessionAt('REACTIONS');
    expect(coachStep(s, ui({ reactionsStep: 'listen' }))).toEqual({ step: 7, done: false });
    expect(coachStep(s, ui({ reactionsStep: 'answer' }))).toBeNull();
  });

  it('VOTE는 8단계, 내 표가 확정되면 끝난 것으로 본다', () => {
    const s = sessionAt('VOTE');
    expect(coachStep(s, ui())).toEqual({ step: 8, done: false });
    const cast = reduce(
      { ...s, finalMotion: null, pendingVote: 'YES' },
      { type: 'CONFIRM_VOTE' },
      1,
    );
    // finalMotion이 없으면 reducer가 무시하므로 표를 직접 넣어 확인한다.
    const voted: Session = {
      ...cast,
      ballots: [
        { memberId: 'PARTICIPANT', motionId: 'm', vote: 'YES', confirmedAt: 1, source: 'scripted', motionHash: 'h' },
      ],
    };
    expect(coachStep(voted, ui())).toEqual({ step: 8, done: true });
  });

  it('코치 대상이 없는 화면(ATTRACT·INTRO·SELECT·MOTION)에는 단계가 없다', () => {
    for (const stage of ['ATTRACT', 'INTRO', 'SELECT', 'MOTION'] as const) {
      expect(coachStep(sessionAt(stage), ui())).toBeNull();
    }
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
    expect(coachStep(on, ui())).toEqual({ step: 3, done: false });
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

describe('coachTarget·coachStepsOf', () => {
  it('5단계 대상은 비서실장 버튼 → 다음 기능 버튼 → 닫기 순으로 바뀐다', () => {
    const s = sessionAt('DISCUSS');
    expect(coachTarget(5, s, ui())).toBe('assistant-toggle');
    expect(coachTarget(5, s, ui({ assistantOpen: true, assistantUsedCount: 1 }))).toBe('assistant-next');
    expect(coachTarget(5, s, ui({ assistantOpen: true, assistantUsedCount: 3 }))).toBe('assistant-close');
    expect(isCoachInDialog(5, ui({ assistantOpen: true }))).toBe(true);
    expect(isCoachInDialog(5, ui())).toBe(false);
  });

  it('8단계 대상은 도장 영역 → 확정 버튼으로 바뀐다', () => {
    expect(coachTarget(8, sessionAt('VOTE'), ui())).toBe('vote-stamps');
    expect(coachTarget(8, sessionAt('VOTE', { pendingVote: 'YES' }), ui())).toBe('vote-confirm');
  });

  it('나머지 단계 대상과 화면별 단계 목록', () => {
    const s = sessionAt('DISCUSS');
    expect(coachTarget(1, s, ui())).toBe('evidence-open');
    expect(coachTarget(6, s, ui())).toBe('submit-opinion');
    expect(coachTarget(9, s, ui())).toBe('result-title');
    expect(coachStepsOf(s, ui())).toEqual([3, 4, 5, 6]);
  });
});
