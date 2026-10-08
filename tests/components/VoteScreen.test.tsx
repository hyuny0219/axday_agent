// PR #12 Codex 5차 검토 P1: MOTION 상자 문장 아래 반영 조건이 눈에 보이는 pill로
// 나와야 한다 — motion.text는 원안 그대로라, 반영 조건이 안 보이면 투표자가 임원
// 표가 조건에 따라 갈리는 이유(domain/voting.ts)를 볼 수 없었다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  // T85 #2: 아직 표를 고르지 않아 확정 버튼이 비활성일 때만 안내 한 줄을 보여준다.
  it('아직 표를 고르지 않으면 안내가 보이고, 고르면 사라진다', () => {
    const motion = freezeMotion(scenario, [], 0);
    const { rerender } = render(
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
    expect(screen.getByTestId('vote-guide-hint')).toHaveTextContent('찬성 또는 반대 도장을 고르세요');

    rerender(
      <VoteScreen
        scenario={scenario}
        stances={stances}
        motion={motion}
        pendingVote="YES"
        mode="scripted"
        execBallotsPending={false}
        onSelectVote={noop}
        onConfirmVote={noop}
      />,
    );
    expect(screen.queryByTestId('vote-guide-hint')).not.toBeInTheDocument();
  });

  // T85 #7: 확정을 누르면 버튼 라벨이 "임원 표를 모으는 중…"으로 바뀐다(점 애니메이션은
  // 장식이라 aria-hidden, 접근 가능한 이름은 이 텍스트가 전달한다).
  it('확정 버튼을 누르면 라벨이 "임원 표를 모으는 중"으로 바뀐다', () => {
    const motion = freezeMotion(scenario, [], 0);
    render(
      <VoteScreen
        scenario={scenario}
        stances={stances}
        motion={motion}
        pendingVote="YES"
        mode="scripted"
        execBallotsPending={false}
        onSelectVote={noop}
        onConfirmVote={noop}
      />,
    );
    const confirmButton = screen.getByTestId('confirm-vote');
    expect(confirmButton).toHaveTextContent('표결 확정');
    fireEvent.click(confirmButton);
    expect(confirmButton).toHaveTextContent('임원 표를 모으는 중');
  });
});
