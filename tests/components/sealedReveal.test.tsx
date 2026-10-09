// T114: 답변 뒤 임원 방향 봉인(설득 현황판·스크린리더 목록·무대 표정)과 결과 순차 공개 타이밍.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersuasionBoard } from '../../src/components/parts/PersuasionBoard';
import { ExecStanceList } from '../../src/components/parts/ExecStanceList';
import { StageBand } from '../../src/components/parts/StageBand';
import {
  ALL_EXEC_REVEALED_SECONDS,
  EXEC_REVEAL_FIRST_SECONDS,
  EXEC_REVEAL_STEP_SECONDS,
  PERSUASION_STAMP_DELAY_SECONDS,
  STAMP_DELAY_SECONDS,
  execRevealDelay,
} from '../../src/components/resultStamp';
import { aiApprovalScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Ballot, RoleStatus, Stance } from '../../src/domain/types';

afterEach(cleanup);

const REAL: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'FOR', CAIO: 'AGAINST', CISO: 'FOR' };
const NEUTRAL: Record<ExecMemberId, Stance> = {
  CEO: 'UNDECIDED',
  CFO: 'UNDECIDED',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

function expand() {
  fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
}

describe('PersuasionBoard 봉인(T114)', () => {
  function renderSealed(participantStance: 'FOR' | 'AGAINST') {
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance={participantStance}
        stances={REAL}
        mode="scripted"
        sealed
      />,
    );
    expand();
  }

  it('입장 열은 봉인 배지이고 "→ 찬성"·"설득 완료" 같은 방향 표현이 없다', () => {
    renderSealed('FOR');
    const board = screen.getByTestId('persuasion-board');
    expect(board.textContent).not.toMatch(/→/);
    expect(board.textContent).not.toContain('설득 완료');
    expect(board.textContent).not.toContain('움직일 조건');
    expect(board.textContent).not.toMatch(/설득한 임원 \d/);
    for (const id of ['CFO', 'CAIO', 'CISO'] as const) {
      expect(screen.getByTestId(`persuasion-board-stance-${id}`)).toHaveTextContent('가림');
      expect(screen.getByTestId(`persuasion-board-note-${id}`)).toHaveTextContent(
        '답변을 들었습니다 · 결과에서 공개',
      );
    }
  });

  it('처음부터 같은 편 임원은 그대로 "처음부터 같은 편"이다', () => {
    renderSealed('FOR');
    expect(screen.getByTestId('persuasion-board-note-CEO')).toHaveTextContent('처음부터 같은 편');
  });

  it('전달된 stances가 달라져도 봉인된 화면은 똑같다(입력을 읽지 않는다)', () => {
    renderSealed('FOR');
    const first = screen.getByTestId('persuasion-board').innerHTML;
    cleanup();
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="FOR"
        stances={NEUTRAL}
        mode="scripted"
        sealed
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board').innerHTML).toBe(first);
  });

  it('반대 참가자도 방향 문구("반대로 남습니다"·"이미 찬성 쪽")가 없다', () => {
    renderSealed('AGAINST');
    const text = screen.getByTestId('persuasion-board').textContent ?? '';
    expect(text).not.toContain('반대로 남습니다');
    expect(text).not.toContain('이미 찬성 쪽');
    expect(text).not.toMatch(/→/);
  });

  it('봉인이 아니면 기존처럼 입장이 보인다(답변 전 단계는 바뀌지 않음)', () => {
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="FOR"
        stances={REAL}
        mode="scripted"
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board-note-CFO').textContent).not.toContain('답변을 들었습니다');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원');
  });
});

describe('ExecStanceList 봉인(T114)', () => {
  it('sealed면 입장 대신 "입장 봉인"만 읽힌다', () => {
    render(<ExecStanceList stances={REAL} sealed />);
    const list = screen.getByTestId('exec-stance-list');
    expect(list.textContent).not.toMatch(/찬성|반대/);
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('입장 봉인');
  });

  it('sealed가 아니면 기존 입장 문구다', () => {
    render(<ExecStanceList stances={REAL} />);
    expect(screen.getByTestId('exec-mood-label-CAIO')).toHaveTextContent('반대 쪽');
  });
});

describe('StageBand 봉인·순차 공개(T114)', () => {
  const roleStatus: Record<ExecMemberId, RoleStatus> = {
    CEO: 'answered',
    CFO: 'answered',
    CAIO: 'answered',
    CISO: 'answered',
  };

  it('MOTION에서 중립 stances를 받으면 네 명 모두 고민 중 표정이다', () => {
    render(
      <StageBand
        stage="MOTION"
        mode="scripted"
        roleStatus={roleStatus}
        statements={[]}
        opinions={[]}
        scenario={aiApprovalScenario}
        stances={NEUTRAL}
        chairLine="처음 안 그대로 표결에 부칩니다"
      />,
    );
    for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
      expect(screen.getByTestId(`stage-mood-${id}`).className).toContain('undecided');
    }
    expect(screen.getByTestId('stage-band').textContent ?? '').not.toMatch(/찬성 쪽|반대 쪽/);
  });

  it('RESULT에서 임원 표 배지는 봉인과 함께 0.9초 간격 지연으로 깔리고 참가자 표는 지연이 없다', () => {
    const ballots: Ballot[] = [
      { memberId: 'CEO', vote: 'YES' },
      { memberId: 'CFO', vote: 'NO' },
      { memberId: 'CAIO', vote: 'YES' },
      { memberId: 'CISO', vote: 'NO' },
      { memberId: 'PARTICIPANT', vote: 'YES' },
    ] as Ballot[];
    render(
      <StageBand
        stage="RESULT"
        mode="scripted"
        roleStatus={roleStatus}
        statements={[]}
        opinions={[]}
        scenario={aiApprovalScenario}
        stances={NEUTRAL}
        ballots={ballots}
      />,
    );
    ['CEO', 'CFO', 'CAIO', 'CISO'].forEach((id, index) => {
      const delay = `${execRevealDelay(index)}s`;
      expect(screen.getByTestId(`stage-vote-seal-${id}`)).toHaveStyle({ animationDelay: delay });
      expect(screen.getByTestId(`stage-vote-badge-${id}`)).toHaveStyle({ animationDelay: delay });
    });
    expect(screen.queryByTestId('stage-vote-seal-PARTICIPANT')).toBeNull();
    expect(screen.getByTestId('stage-vote-badge-PARTICIPANT')).toHaveStyle({ animationDelay: '0s' });
  });
});

describe('결과 순차 공개 타이밍(T114)', () => {
  it('임원 표는 0.9초 간격으로 한 장씩, 순서대로 뒤집힌다', () => {
    expect(execRevealDelay(0)).toBeCloseTo(EXEC_REVEAL_FIRST_SECONDS);
    for (let i = 1; i < 4; i += 1) {
      expect(execRevealDelay(i) - execRevealDelay(i - 1)).toBeCloseTo(EXEC_REVEAL_STEP_SECONDS);
    }
    expect(EXEC_REVEAL_STEP_SECONDS).toBeCloseTo(0.9);
  });

  it('집계·도장은 마지막 장이 뒤집힌 뒤에 나오고 설득 도장이 그 뒤를 잇는다', () => {
    expect(ALL_EXEC_REVEALED_SECONDS).toBeGreaterThan(execRevealDelay(3));
    expect(STAMP_DELAY_SECONDS).toBeGreaterThanOrEqual(ALL_EXEC_REVEALED_SECONDS);
    expect(PERSUASION_STAMP_DELAY_SECONDS).toBeGreaterThan(STAMP_DELAY_SECONDS);
  });
});
