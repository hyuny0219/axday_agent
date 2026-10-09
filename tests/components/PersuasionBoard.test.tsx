// T96 설득 현황판: 임원별 "첫 의견 → 지금" 입장과 움직일 조건이 requiredConditionsFor
// (src/domain/voting.ts)와 일치하는지, 참가자 입장(FOR·AGAINST)에 따라 문구가 뒤집히는지
// 확인한다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersuasionBoard } from '../../src/components/parts/PersuasionBoard';
import { aiApprovalScenario } from '../../src/content/scenarios';
import { scriptedStances } from '../../src/domain/stance';
import type { Opinion } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

/** 2026-10-08 팀리드 지시: 기본은 접힘(요약 한 줄만) — 임원별 4행은 "자세히 보기"를
 * 눌러야 보인다(1280×720 DISCUSS 왼쪽 열 세로 넘침 방지). 행 단위 단언이 필요한
 * 테스트는 먼저 펼친다. */
function expand() {
  fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
}

describe('PersuasionBoard(T96, 안건①)', () => {
  it('기본은 접힌 요약 한 줄이고, 아직 설득되지 않은 임원 코드가 보인다', () => {
    const stances = scriptedStances(aiApprovalScenario, { stage: 'OPINIONS', opinions: [] });
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance="FOR"
        stances={stances}
        mode="scripted"
      />,
    );
    expect(screen.queryByTestId('persuasion-board-row-CFO')).toBeNull();
    expect(screen.getByTestId('persuasion-board-summary')).toHaveTextContent('CFO·CAIO·CISO 남음');
    // T101: CEO는 처음부터 같은 편이라 분모(4)에서 빠진다.
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 0/3');
  });

  it('참가자가 찬성 쪽이고 조건이 없으면 "자세히 보기"를 눌렀을 때 CFO 행에 "움직일 조건 · 결재 금액 한도·사람이 일부 다시 보기"가 보인다', () => {
    const opinions: Opinion[] = [];
    const stances = scriptedStances(aiApprovalScenario, { stage: 'OPINIONS', opinions });
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance="FOR"
        stances={stances}
        mode="scripted"
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board-note-CFO')).toHaveTextContent(
      '움직일 조건 · 결재 금액 한도·사람이 일부 다시 보기',
    );
    // CEO는 처음부터 찬성이라 "처음부터 같은 편"이고 설득 분모에서 빠진다(T101).
    expect(screen.getByTestId('persuasion-board-note-CEO')).toHaveTextContent('처음부터 같은 편');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 0/3');
  });

  it('LOG 조건을 확정하면 CAIO 행이 "고민 중 → 찬성"으로 바뀌고 설득한 임원 수가 늘어난다', () => {
    const stances = scriptedStances(aiApprovalScenario, { stage: 'REACTIONS', opinions: [
      { id: 'op1', originalText: '', selectedPhraseIds: [], confirmedConditionIds: ['LOG'], createdAt: 0 },
    ] });
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LOG']}
        participantStance="FOR"
        stances={stances}
        mode="scripted"
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board-stance-CAIO')).toHaveTextContent('고민 중 → 찬성');
    expect(screen.getByTestId('persuasion-board-note-CAIO')).toHaveTextContent('설득 완료');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 1/3');
  });

  it('참가자가 반대 쪽이면 처음부터 반대인 CFO 행은 "처음부터 같은 편"이고 조건이 빠지면 반대로 남는 임원은 문구가 뒤집혀 보인다', () => {
    const opinions: Opinion[] = [];
    const stances = scriptedStances(aiApprovalScenario, { stage: 'OPINIONS', opinions });
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance="AGAINST"
        stances={stances}
        mode="scripted"
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board-note-CFO')).toHaveTextContent('처음부터 같은 편');
    expect(screen.getByTestId('persuasion-board-note-CISO')).toHaveTextContent('처음부터 같은 편');
    // CFO·CISO는 처음부터 반대라 분모에서 빠지고, CEO·CAIO 둘만 설득 대상이다(아직 0명).
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 0/2');
  });

  it('입장을 아직 고르지 않았으면(participantStance=null) 찬성 목표로 계산하지 않고 한 줄 안내만 보인다(T101)', () => {
    const stances = scriptedStances(aiApprovalScenario, { stage: 'OPINIONS', opinions: [] });
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance={null}
        stances={stances}
        mode="scripted"
      />,
    );
    expect(screen.getByTestId('persuasion-board-pending')).toHaveTextContent(
      '입장을 고르면 설득 목표가 보입니다',
    );
    expect(screen.queryByTestId('persuasion-board-count')).toBeNull();
    expect(screen.queryByTestId('persuasion-board-toggle')).toBeNull();
  });
});

describe('PersuasionBoard 답변 대기 표기(T110)', () => {
  it('awaitingAnswerIds에 든 임원 행은 찬성 참가자면 "답변 뒤 찬성", 반대 참가자면 "답변 뒤 반대"다', () => {
    const stances = { CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'AGAINST', CISO: 'AGAINST' } as const;
    const { rerender } = render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['LIMIT', 'REVIEW']}
        participantStance="FOR"
        stances={stances}
        mode="scripted"
        awaitingAnswerIds={['CFO']}
      />,
    );
    expand();
    expect(screen.getByTestId('persuasion-board-note-CFO')).toHaveTextContent('조건은 충분 · 답변 뒤 찬성');
    expect(screen.getByTestId('persuasion-board-note-CAIO')).not.toHaveTextContent('답변 뒤');
    rerender(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={['FULL_AUTO']}
        participantStance="AGAINST"
        stances={{ CEO: 'UNDECIDED', CFO: 'AGAINST', CAIO: 'AGAINST', CISO: 'AGAINST' }}
        mode="scripted"
        awaitingAnswerIds={['CEO']}
      />,
    );
    expect(screen.getByTestId('persuasion-board-note-CEO')).toHaveTextContent('조건은 충분 · 답변 뒤 반대');
  });
});
