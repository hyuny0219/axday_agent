// T118: 기울어진 방향 표시 — 현황판·무대 표정. 봉인 단계는 기울음을 읽지 않는다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersuasionBoard } from '../../src/components/parts/PersuasionBoard';
import { StageBand } from '../../src/components/parts/StageBand';
import { aiApprovalScenario as ai } from '../../src/content/scenarios/aiApproval';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, Stance } from '../../src/domain/types';

afterEach(cleanup);

const stances: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'AGAINST' };
const roleStatus: Record<ExecMemberId, RoleStatus> = {
  CEO: 'answered',
  CFO: 'answered',
  CAIO: 'answered',
  CISO: 'answered',
};

function board(extra: object = {}) {
  render(
    <PersuasionBoard
      scenario={ai}
      confirmedConditionIds={['LIMIT', 'REVIEW']}
      participantStance="FOR"
      stances={stances}
      mode="scripted"
      leaning={{ CFO: 'FOR' }}
      {...extra}
    />,
  );
  fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
}

describe('PersuasionBoard 기울음', () => {
  it('기울음 임원은 "반대 → 찬성 쪽 · 답변하면 확정"이고 집계에 (기울음 1)이 붙는다', () => {
    board();
    expect(screen.getByTestId('persuasion-board-stance-CFO')).toHaveTextContent('반대 → 찬성 쪽');
    expect(screen.getByTestId('persuasion-board-stance-CFO')).toHaveClass('persuasion-board__stance--leaning');
    expect(screen.getByTestId('persuasion-board-note-CFO')).toHaveTextContent('답변하면 확정');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('(기울음 1)');
  });

  it('반대 참가자면 "반대 쪽"과 "답변하면 반대로 확정"이다', () => {
    board({ participantStance: 'AGAINST', leaning: { CEO: 'AGAINST' } });
    expect(screen.getByTestId('persuasion-board-stance-CEO')).toHaveTextContent('찬성 → 반대 쪽');
    expect(screen.getByTestId('persuasion-board-note-CEO')).toHaveTextContent('답변하면 반대로 확정');
  });

  it('봉인(MOTION·VOTE)이면 기울음을 읽지 않고 가림만 보인다', () => {
    board({ sealed: true });
    expect(screen.getByTestId('persuasion-board-stance-CFO')).not.toHaveTextContent('찬성 쪽');
    expect(screen.getByTestId('persuasion-board-count')).not.toHaveTextContent('기울음');
    expect(screen.getByTestId('persuasion-board-note-CFO')).not.toHaveTextContent('답변하면 확정');
  });
});

describe('StageBand 기울음', () => {
  function band(leaning?: Partial<Record<ExecMemberId, 'FOR' | 'AGAINST'>>) {
    render(
      <StageBand
        stage="REACTIONS"
        mode="scripted"
        roleStatus={roleStatus}
        statements={[]}
        opinions={[]}
        scenario={ai}
        stances={stances}
        leaning={leaning}
      />,
    );
  }

  it('기울음 임원은 목표 방향 점선 표정과 "찬성 쪽" 캡션이다', () => {
    band({ CFO: 'FOR' });
    expect(screen.getByTestId('stage-mood-CFO')).toHaveClass('stage-band__mood--for', 'stage-band__mood--leaning');
    expect(screen.getByTestId('stage-seat-CFO')).toHaveTextContent('찬성 쪽 · 미확정');
    expect(screen.getByTestId('stage-seat-CFO')).not.toHaveTextContent('고민 중');
    expect(screen.getByTestId('stage-mood-CAIO')).not.toHaveClass('stage-band__mood--leaning');
    expect(screen.getByTestId('stage-seat-CAIO')).toHaveTextContent('고민 중');
  });

  it('leaning이 없으면 기존 표정이다', () => {
    band();
    expect(screen.getByTestId('stage-mood-CFO')).toHaveClass('stage-band__mood--undecided');
  });
});
