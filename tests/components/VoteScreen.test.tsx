// PR #12 Codex 5차 검토 P1: MOTION 상자 문장 아래 반영 조건이 눈에 보이는 pill로
// 나와야 한다 — motion.text는 원안 그대로라, 반영 조건이 안 보이면 투표자가 임원
// 표가 조건에 따라 갈리는 이유(domain/voting.ts)를 볼 수 없었다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VoteScreen } from '../../src/components/screens/VoteScreen';
import { freezeMotion } from '../../src/domain/motion';
import { anonBoardScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Stance } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

const scenario = anonBoardScenario;
const noop = () => {};

const stances: Record<ExecMemberId, Stance> = {
  CEO: 'FOR',
  CFO: 'FOR',
  CAIO: 'UNDECIDED',
  CISO: 'UNDECIDED',
};

describe('VoteScreen', () => {
  it('확정한 조건이 있으면 MOTION 상자 안에 반영 조건 pill이 눈에 보인다', () => {
    const motion = freezeMotion(scenario, ['PILOT', 'MEASURE'], 0);
    render(
      <VoteScreen
        scenario={scenario}
        stances={stances}
        motion={motion}
        pendingVote={null}
        mode="scripted"
        execBallotsPending={false}
        onSelectVote={noop}
        onConfirmVote={noop}
      />,
    );

    const conditions = screen.getByTestId('vote-motion-conditions');
    expect(conditions).toBeVisible();
    expect(conditions).toHaveTextContent('한 게시판에서 시범');
    expect(conditions).toHaveTextContent('운영 효과 측정 후 확대');
  });

  it('확정한 조건이 없으면 반영 조건 블록 자체를 그리지 않는다', () => {
    const motion = freezeMotion(scenario, [], 0);
    render(
      <VoteScreen
        scenario={scenario}
        stances={stances}
        motion={motion}
        pendingVote={null}
        mode="scripted"
        execBallotsPending={false}
        onSelectVote={noop}
        onConfirmVote={noop}
      />,
    );

    expect(screen.queryByTestId('vote-motion-conditions')).not.toBeInTheDocument();
  });
});
