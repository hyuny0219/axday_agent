// T127: 엔딩 화면 — 공개 전 버튼 숨김, 성공/실패 변형, 실패 실마리(조건명 미노출), 60초 자동 복귀,
// 입력 시 재시작, 보고서로 돌아가면 정지, 처음 화면으로 즉시 초기화.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from '../../src/components/screens/ResultScreen';
import { EndingCard } from '../../src/components/parts/EndingCard';
import { buildEnding } from '../../src/components/endingSummary';
import { ENDING_AUTO_RETURN_SECONDS } from '../../src/domain/endingReturn';
import { ALL_EXEC_REVEALED_SECONDS } from '../../src/components/resultStamp';
import { anonBoardScenario } from '../../src/content/scenarios/anonBoard';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import { computeMotionHash } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import type { Ballot, Motion, Session } from '../../src/domain/types';

const scenario = anonBoardScenario;
const EXEC = ['CEO', 'CFO', 'CAIO', 'CISO'] as const;

function sessionWith(execVotes: Ballot['vote'][], participant: Ballot['vote'], extra: Partial<Session> = {}): Session {
  const id = 'motion-ending';
  const text = scenario.originalMotion.text;
  const motion: Motion = {
    id,
    scenarioId: scenario.id,
    kind: 'amended',
    conditionIds: [],
    baseConditionIds: [],
    effectiveConditionIds: [],
    executionMode: 'DEFAULT',
    frozenAt: 0,
    text,
    hash: computeMotionHash({ id, text, effectiveConditionIds: [], executionMode: 'DEFAULT' }),
  };
  const ballot = (memberId: Ballot['memberId'], vote: Ballot['vote']): Ballot => ({
    memberId,
    motionId: motion.id,
    motionHash: motion.hash,
    source: 'scripted',
    vote,
    confirmedAt: 1,
  });
  const yes = execVotes.filter((v) => v === 'YES').length + (participant === 'YES' ? 1 : 0);
  return {
    ...createInitialSession(0, 's-ending'),
    autoPlay: false,
    followUpAnswered: true,
    stage: 'RESULT',
    mode: 'scripted',
    scenarioId: scenario.id,
    finalMotion: motion,
    ballots: [...EXEC.map((m, i) => ballot(m, execVotes[i] ?? 'NO')), ballot('PARTICIPANT', participant)],
    outcome: yes >= 3 ? 'PASS' : 'REJECT',
    opinions: [],
    ...extra,
  };
}

const WIN = () => sessionWith(['YES', 'YES', 'YES', 'YES'], 'YES');
const LOSE = () => sessionWith(['NO', 'NO', 'NO', 'NO'], 'YES');

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

beforeEach(() => setReducedMotion(false));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.resultSkip;
});

function renderResult(session: Session, onReset = vi.fn()) {
  render(<ResultScreen scenario={scenario} session={session} roundLog={[]} onReset={onReset} />);
  return onReset;
}

describe('마무리 ▶ 버튼', () => {
  it('공개 전에는 보이지 않고 공개가 끝나면 나타난다', () => {
    vi.useFakeTimers();
    renderResult(WIN());
    expect(screen.queryByTestId('result-finish')).toBeNull();
    act(() => {
      vi.advanceTimersByTime((ALL_EXEC_REVEALED_SECONDS + 0.2) * 1000);
    });
    expect(screen.getByTestId('result-finish')).toBeInTheDocument();
  });

  it('감속 모드에서는 바로 보인다', () => {
    setReducedMotion(true);
    renderResult(WIN());
    expect(screen.getByTestId('result-finish')).toBeInTheDocument();
  });
});

describe('엔딩 내용', () => {
  beforeEach(() => setReducedMotion(true));

  it('성공이면 성공 도장·이유·확정 조건 칩을 보여 준다', () => {
    renderResult(WIN());
    fireEvent.click(screen.getByTestId('result-finish'));
    expect(screen.getByTestId('ending-stamp')).toHaveTextContent('성공');
    expect(screen.getByTestId('ending-reason')).toHaveTextContent('같은 표 5석');
    expect(screen.getByTestId('ending-seats').querySelectorAll('li')).toHaveLength(5);
    expect(screen.queryByTestId('ending-clue')).toBeNull();
    expect(screen.getByTestId('ending-outcome')).toHaveTextContent('안건은');
  });

  it('실패면 실패 도장과 3석 기준, 실마리 한 줄을 보여 준다', () => {
    renderResult(LOSE());
    fireEvent.click(screen.getByTestId('result-finish'));
    expect(screen.getByTestId('ending-stamp')).toHaveTextContent('실패');
    expect(screen.getByTestId('ending-reason')).toHaveTextContent('3석부터 성공입니다');
    expect(screen.getByTestId('ending-clue')).toHaveTextContent('다시 보면 실마리');
    expect(screen.queryByTestId('ending-chips')).toBeNull();
  });

  it('실마리는 조건 이름을 말하지 않는다', () => {
    renderResult(LOSE());
    fireEvent.click(screen.getByTestId('result-finish'));
    const clue = screen.getByTestId('ending-clue').textContent ?? '';
    for (const condition of scenario.conditions) {
      expect(clue).not.toContain(condition.label);
    }
  });

  it('쓸 정보가 없으면 실마리 줄을 생략한다', () => {
    const model = buildEnding({
      scenario: { ...scenario, evidence: [] },
      session: { mode: 'scripted', followUpAnswered: true },
      earned: false,
      sameVoteSeats: 1,
      participantVote: 'YES',
      execVotes: { CEO: 'NO', CFO: 'NO', CAIO: 'NO', CISO: 'NO' },
      persuasionTally: null,
      resultStampText: '부결',
      epilogue: null,
      conditionLabels: [],
      finalConditionIds: [],
      participantStance: 'FOR',
    });
    expect(model.clue).toBeNull();
  });

  it('추가 질문에 답하지 않았으면 답하러 가라는 실마리를 준다', () => {
    renderResult(sessionWith(['NO', 'NO', 'NO', 'NO'], 'YES', { followUpAnswered: false }));
    fireEvent.click(screen.getByTestId('result-finish'));
    expect(screen.getByTestId('ending-clue')).toHaveTextContent('추가 질문에 답해야');
  });

  it('엔딩에서 처음 화면으로를 누르면 확인 없이 바로 초기화한다', () => {
    const onReset = renderResult(WIN());
    fireEvent.click(screen.getByTestId('result-finish'));
    fireEvent.click(screen.getByTestId('ending-home'));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('end-session-confirm')).toBeNull();
  });

  it('자세한 결과 보기는 보고서로 돌아가고 자동 복귀를 멈춘다', () => {
    vi.useFakeTimers();
    const onReset = renderResult(WIN());
    fireEvent.click(screen.getByTestId('result-finish'));
    fireEvent.click(screen.getByTestId('ending-detail'));
    expect(screen.queryByTestId('ending')).toBeNull();
    act(() => {
      vi.advanceTimersByTime((ENDING_AUTO_RETURN_SECONDS + 5) * 1000);
    });
    expect(onReset).not.toHaveBeenCalled();
    // 다시 열면 새로 시작한다.
    fireEvent.click(screen.getByTestId('result-finish'));
    expect(screen.getByTestId('ending-timer')).toHaveTextContent(`${ENDING_AUTO_RETURN_SECONDS}초`);
  });
});

describe('60초 자동 복귀', () => {
  function renderCard(onHome = vi.fn()) {
    const model = buildEnding({
      scenario,
      session: { mode: 'scripted', followUpAnswered: true },
      earned: true,
      sameVoteSeats: 3,
      participantVote: 'YES',
      execVotes: { CEO: 'YES', CFO: 'YES', CAIO: 'NO', CISO: 'NO' },
      persuasionTally: null,
      resultStampText: '가결',
      epilogue: '첫 문장입니다. 둘째 문장입니다.',
      conditionLabels: [],
      finalConditionIds: [],
      participantStance: 'FOR',
    });
    render(<EndingCard model={model} caseTag="사건 01" onDetail={() => undefined} onHome={onHome} />);
    return onHome;
  }

  it('60초가 지나면 처음 화면으로 돌아간다(한 번만)', () => {
    vi.useFakeTimers();
    const onHome = renderCard();
    act(() => {
      vi.advanceTimersByTime((ENDING_AUTO_RETURN_SECONDS - 1) * 1000);
    });
    expect(onHome).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onHome).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('입력이 있으면 60초를 다시 센다', () => {
    vi.useFakeTimers();
    const onHome = renderCard();
    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    fireEvent.keyDown(window, { key: 'a' });
    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(onHome).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('남은 시간 안내는 aria-live를 끄고, 에필로그는 첫 문장만 쓴다', () => {
    renderCard();
    expect(screen.getByTestId('ending-timer')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByTestId('ending-outcome')).toHaveTextContent('첫 문장입니다.');
    expect(screen.getByTestId('ending-outcome')).not.toHaveTextContent('둘째');
  });
});

describe('반대 목표 실패의 실마리 방향(T127 검토)', () => {
  function againstEnding(sc: typeof aiApprovalScenario, finalConditionIds: string[], mode: 'scripted' | 'live' = 'scripted') {
    return buildEnding({
      scenario: sc,
      session: { mode, followUpAnswered: true },
      earned: false,
      sameVoteSeats: 1,
      participantVote: 'NO',
      execVotes: { CEO: 'YES', CFO: 'YES', CAIO: 'YES', CISO: 'YES' },
      persuasionTally: null,
      resultStampText: '가결',
      epilogue: null,
      conditionLabels: [],
      finalConditionIds,
      participantStance: 'AGAINST',
    });
  }

  for (const sc of [aiApprovalScenario, experienceFirstScenario]) {
    it(`${sc.id}: 찬성 쪽 근거를 가진 임원(첫 입장 찬성)을 가리키지 않고 조건 이름도 말하지 않는다`, () => {
      const allIds = sc.conditions.map((condition) => condition.id);
      for (const finalIds of [[], allIds.filter((id) => id !== 'FULL_AUTO'), allIds]) {
        const clue = againstEnding(sc, finalIds).clue;
        if (clue === null) continue;
        const labelOf = (id: string) => sc.initialOpinions.find((o) => o.memberId === id)?.openingStance;
        const pointed = (['CEO', 'CFO', 'CAIO', 'CISO'] as const).find((id) => clue.startsWith(id));
        expect(pointed).toBeDefined();
        expect(labelOf(pointed as string)).not.toBe('FOR');
        for (const condition of sc.conditions) {
          expect(clue).not.toContain(condition.label);
        }
      }
    });
  }

  // T137: 반대 목표의 후보는 반대 근거뿐이다(찬성 조건·충돌쌍은 고려하지 않는다).
  it('반대 근거를 이미 모두 썼으면 더 돌릴 방법이 없어 줄을 생략한다(두 안건)', () => {
    for (const sc of [aiApprovalScenario, experienceFirstScenario]) {
      const objectionIds = sc.conditions.filter((condition) => condition.side === 'AGAINST').map((c) => c.id);
      expect(againstEnding(sc, objectionIds).clue).toBeNull();
    }
  });

  it('반대 근거가 남아 있으면 그 근거로 돌릴 수 있고 첫 입장이 찬성이 아닌 임원의 근거 자료를 가리킨다', () => {
    expect(againstEnding(aiApprovalScenario, []).clue).toMatch(/^CFO/);
    // T138: 고민 중 CFO는 반대 쪽 조건(규칙표에서 찬성 조건보다 앞)으로 돌릴 수 있어 찬성 조건을 이미 써도 가리킨다.
    expect(againstEnding(aiApprovalScenario, ['LIMIT', 'REVIEW', 'LOG', 'OWNER']).clue).toMatch(/^CFO/);
    expect(againstEnding(experienceFirstScenario, ['SCOPE', 'RECORD', 'REVIEW', 'DATA_VETO']).clue).toMatch(/^CFO/);
  });

  it('반대 근거가 남지 않았으면 줄을 생략한다', () => {
    const all = aiApprovalScenario.conditions.map((condition) => condition.id);
    expect(againstEnding(aiApprovalScenario, all).clue).toBeNull();
  });

  it('live에서는 규칙표가 없어 반대 목표의 실마리를 생략한다', () => {
    expect(againstEnding(aiApprovalScenario, [], 'live').clue).toBeNull();
  });
});

describe('엔딩 모달 포커스', () => {
  function Harness({ onHome = () => undefined }: { onHome?: () => void }) {
    const [open, setOpen] = useState(false);
    const model = buildEnding({
      scenario,
      session: { mode: 'scripted', followUpAnswered: true },
      earned: true,
      sameVoteSeats: 3,
      participantVote: 'YES',
      execVotes: { CEO: 'YES', CFO: 'YES', CAIO: 'NO', CISO: 'NO' },
      persuasionTally: null,
      resultStampText: '가결',
      epilogue: null,
      conditionLabels: [],
      finalConditionIds: [],
      participantStance: 'FOR',
    });
    return (
      <div>
        <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
          마무리
        </button>
        <button type="button" data-testid="behind">
          뒤 버튼
        </button>
        {open && <EndingCard model={model} caseTag="사건 01" onDetail={() => setOpen(false)} onHome={onHome} />}
      </div>
    );
  }

  function openEnding() {
    render(<Harness />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    fireEvent.click(opener);
    return opener;
  }

  it('열리면 처음 화면으로에 포커스가 가고 뒤 화면은 inert다', () => {
    openEnding();
    expect(screen.getByTestId('ending-home')).toHaveFocus();
    expect(screen.getByTestId('behind').closest('[inert]')).not.toBeNull();
    expect(screen.getByTestId('ending').closest('[inert]')).toBeNull();
  });

  it('Tab·Shift+Tab은 엔딩 안에서만 돈다', () => {
    openEnding();
    const detail = screen.getByTestId('ending-detail');
    const home = screen.getByTestId('ending-home');
    expect(home).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(detail).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(home).toHaveFocus();
  });

  it('닫으면 inert가 풀리고 포커스가 연 버튼으로 돌아간다', () => {
    const opener = openEnding();
    fireEvent.click(screen.getByTestId('ending-detail'));
    expect(screen.queryByTestId('ending')).toBeNull();
    expect(screen.getByTestId('behind').closest('[inert]')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
