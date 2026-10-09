// T114: 결과 화면 순차 공개의 접근성(공개 전 aria-hidden → 공개 시각에 해제), reduced-motion·skip 즉시
// 공개, 그리고 FOLLOWUP 발언이 입장 라벨 없이 텍스트로만 기록되는지 확인한다.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ResultScreen } from '../../src/components/screens/ResultScreen';
import { MinutesPanel } from '../../src/components/parts/MinutesPanel';
import { buildMinutes, type RoundLogEntry } from '../../src/components/minutes';
import { revealStateAt, useResultReveal } from '../../src/components/useResultReveal';
import { ALL_EXEC_REVEALED_SECONDS, execRevealDelay } from '../../src/components/resultStamp';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { SEALED_FOLLOWUP_TEXT } from '../../src/domain/verdictWords';
import { fakeClock } from '../../src/domain/clock';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { decideBoard } from '../../src/domain/voting';
import type { Ballot, Motion, Session, Statement } from '../../src/domain/types';

const scenario = anonBoardScenario;

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

beforeEach(() => {
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.resultSkip;
});

function resultSession(): Session {
  const id = 'motion-under-test';
  const text = scenario.originalMotion.text;
  const motion: Motion = {
    id,
    scenarioId: scenario.id,
    kind: 'amended',
    conditionIds: ['PILOT'],
    baseConditionIds: [],
    effectiveConditionIds: ['PILOT'],
    executionMode: 'DEFAULT',
    frozenAt: 0,
    text,
    hash: computeMotionHash({ id, text, effectiveConditionIds: ['PILOT'], executionMode: 'DEFAULT' }),
  };
  const participant: Ballot = {
    memberId: 'PARTICIPANT',
    motionId: motion.id,
    motionHash: motion.hash,
    source: 'scripted',
    vote: 'YES',
    confirmedAt: 1,
  };
  return {
    ...createInitialSession(0, 's-reveal'),
    followUpAnswered: true,
    stage: 'RESULT',
    mode: 'scripted',
    scenarioId: scenario.id,
    finalMotion: motion,
    ballots: [...decideBoard(scenario, motion), participant],
    outcome: 'PASS',
    opinions: [],
  };
}

function renderResult() {
  return render(<ResultScreen scenario={scenario} session={resultSession()} roundLog={[]} onReset={() => undefined} />);
}

describe('revealStateAt(순수 함수)', () => {
  it('임원 표가 순서대로 열리고 집계는 마지막 장 뒤에 열린다', () => {
    expect(revealStateAt(0)).toEqual({ execRevealed: 0, allRevealed: false });
    expect(revealStateAt(execRevealDelay(0))).toEqual({ execRevealed: 1, allRevealed: false });
    expect(revealStateAt(execRevealDelay(2)).execRevealed).toBe(3);
    expect(revealStateAt(execRevealDelay(3))).toEqual({ execRevealed: 4, allRevealed: false });
    expect(revealStateAt(ALL_EXEC_REVEALED_SECONDS)).toEqual({ execRevealed: 4, allRevealed: true });
  });
});

describe('useResultReveal(타이머)', () => {
  it('Clock 경과에 따라 한 장씩 열리고 skip이 오면 즉시 전부 열린다', () => {
    vi.useFakeTimers();
    const clock = fakeClock(0);
    const advance = (ms: number) => {
      clock.advance(ms);
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };
    const { result, rerender } = renderHook(({ skip }) => useResultReveal(skip, clock), {
      initialProps: { skip: false },
    });
    expect(result.current).toEqual({ execRevealed: 0, allRevealed: false });
    advance(1000);
    expect(result.current.execRevealed).toBe(1);
    advance(1800);
    expect(result.current.execRevealed).toBe(3);
    expect(result.current.allRevealed).toBe(false);
    rerender({ skip: true });
    expect(result.current).toEqual({ execRevealed: 4, allRevealed: true });
  });

  it('prefers-reduced-motion이면 처음부터 전부 열려 있다', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useResultReveal(false, fakeClock(0)));
    expect(result.current).toEqual({ execRevealed: 4, allRevealed: true });
  });

  it('언마운트하면 대기 중인 타이머를 정리한다', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useResultReveal(false, fakeClock(0)));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('ResultScreen 공개 전 aria-hidden(T114)', () => {
  it('처음에는 임원 판단 행·결론 제목·집계가 스크린리더에서 가려져 있다', () => {
    renderResult();
    for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      expect(screen.getByTestId(`result-seat-${id}`)).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByTestId('result-conclusion')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('result-summary-tally')).toHaveAttribute('aria-hidden', 'true');
    // 참가자 행은 이미 아는 표라 가리지 않지만, 결과를 말해 주는 한 줄(다수·소수 의견)은 가린다.
    expect(screen.getByTestId('result-seat-PARTICIPANT')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-summary-decisive')).toHaveAttribute('aria-hidden', 'true');
    // 결과에 따라 문장이 달라지는 6개월 뒤 카드·남은 과제 줄·도장 칸도 공개 뒤에 나온다.
    expect(screen.getByTestId('result-epilogue')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('result-ai-help').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('result-stamp').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('prefers-reduced-motion이면 처음부터 가림이 없다', () => {
    setReducedMotion(true);
    renderResult();
    expect(screen.getByTestId('result-seat-CFO')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-conclusion')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-epilogue')).not.toHaveAttribute('aria-hidden');
  });

  it('운영자 skip(클릭)이면 data-result-skip이 켜지고 가림이 즉시 풀린다', async () => {
    renderResult();
    // 결과 화면을 연 같은 이벤트가 아니라 그 뒤의 클릭만 skip으로 센다.
    await new Promise((resolve) => setTimeout(resolve, 5));
    fireEvent.click(window);
    expect(document.documentElement.dataset.resultSkip).toBe('true');
    expect(screen.getByTestId('result-seat-CISO')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-conclusion')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-epilogue')).not.toHaveAttribute('aria-hidden');
  });

  it('타이머가 지나면 한 장씩 풀리고 집계는 마지막에 풀린다', () => {
    vi.useFakeTimers();
    renderResult();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('result-seat-CEO')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-seat-CFO')).toHaveAttribute('aria-hidden', 'true');
    act(() => {
      vi.advanceTimersByTime(ALL_EXEC_REVEALED_SECONDS * 1000);
    });
    expect(screen.getByTestId('result-seat-CISO')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-conclusion')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('result-epilogue')).not.toHaveAttribute('aria-hidden');
  });
});

describe('FOLLOWUP 발언 회의록(T114)', () => {
  it('live FOLLOWUP 발언은 발언 텍스트만 보이고 입장 라벨이 붙지 않는다', () => {
    const statements: Statement[] = (['CEO', 'CFO', 'CAIO', 'CISO'] as const).map((roleId, index) => ({
      id: `fu-${roleId}`,
      roleId,
      stage: 'FOLLOWUP',
      text: '답변을 잘 들었습니다. 근거가 분명해졌습니다.',
      evidenceIds: [],
      referencedStatementIds: [],
      concerns: [],
      suggestedConditionIds: [],
      stance: index % 2 === 0 ? 'FOR' : 'AGAINST',
      source: 'live',
      createdAt: 1000 * (index + 1),
    }));
    const base = resultSession();
    const session: Session = {
      ...base,
      mode: 'live',
      stage: 'MOTION',
      transcript: { revision: 1, statements },
      opinions: [
        { id: 'o1', originalText: '첫 의견', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 0 },
        { id: 'o2', originalText: '답변입니다', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 1 },
      ],
    };
    const roundLog = (['CEO', 'CFO', 'CAIO', 'CISO'] as const).map((roleId) => ({
      stage: 'FOLLOWUP' as const,
      roleId,
      status: 'answered' as const,
    }));
    const entries = buildMinutes(session, scenario, roundLog);
    render(<MinutesPanel entries={entries} />);
    for (const roleId of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      const row = screen.getByTestId(`minutes-entry-followup-${roleId}`);
      expect(row).toHaveTextContent('답변을 잘 들었습니다');
      expect(row.textContent).not.toMatch(/찬성 쪽|반대 쪽|고민 중|FOR|AGAINST/);
    }
  });

  function liveFollowUpSession(texts: Record<string, string>): { session: Session; roundLog: RoundLogEntry[] } {
    const roles = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;
    const statements: Statement[] = roles.map((roleId, index) => ({
      id: `fu2-${roleId}`,
      roleId,
      stage: 'FOLLOWUP',
      text: texts[roleId] ?? '답변을 잘 들었습니다.',
      evidenceIds: [],
      referencedStatementIds: [],
      concerns: [],
      suggestedConditionIds: [],
      stance: 'FOR',
      source: 'live',
      createdAt: 1000 * (index + 1),
    }));
    const base = resultSession();
    return {
      session: {
        ...base,
        mode: 'live',
        stage: 'MOTION',
        transcript: { revision: 1, statements },
        opinions: [
          { id: 'o1', originalText: '첫 의견', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 0 },
          { id: 'o2', originalText: '답변입니다', selectedPhraseIds: [], confirmedConditionIds: [], createdAt: 1 },
        ],
      },
      roundLog: roles.map((roleId) => ({ stage: 'FOLLOWUP' as const, roleId, status: 'answered' as const })),
    };
  }

  it('모델이 규칙을 어겨 방향 단어를 쓰면 MOTION·VOTE 회의록은 그 행만 가린다', () => {
    const { session, roundLog } = liveFollowUpSession({ CFO: '이번에는 찬성합니다.', CISO: '반대로 남겠습니다.' });
    for (const stage of ['MOTION', 'VOTE'] as const) {
      const entries = buildMinutes({ ...session, stage }, scenario, roundLog);
      const byId = (id: string) => entries.find((entry) => entry.id === id)?.text;
      expect(byId('followup-CFO')).toBe(SEALED_FOLLOWUP_TEXT);
      expect(byId('followup-CISO')).toBe(SEALED_FOLLOWUP_TEXT);
      expect(byId('followup-CEO')).toBe('답변을 잘 들었습니다.');
    }
  });

  it('RESULT 이후에는 원문을 보이고, 결과 공개 전(sealFollowUp)에는 계속 가린다', () => {
    const { session, roundLog } = liveFollowUpSession({ CFO: '이번에는 찬성합니다.' });
    const result: Session = { ...session, stage: 'RESULT' };
    expect(buildMinutes(result, scenario, roundLog).find((e) => e.id === 'followup-CFO')?.text).toBe(
      '이번에는 찬성합니다.',
    );
    expect(
      buildMinutes(result, scenario, roundLog, { sealFollowUp: true }).find((e) => e.id === 'followup-CFO')?.text,
    ).toBe(SEALED_FOLLOWUP_TEXT);
  });
});
