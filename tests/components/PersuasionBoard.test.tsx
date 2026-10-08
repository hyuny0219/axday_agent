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
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 1/4');
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
    // CEO는 FULL_AUTO 없이는 이미 찬성이라 "설득 완료"다.
    expect(screen.getByTestId('persuasion-board-note-CEO')).toHaveTextContent('설득 완료');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 1/4');
  });

  it('LOG 조건을 확정하면 CAIO 행이 "미정 → 찬성"으로 바뀌고 설득한 임원 수가 늘어난다', () => {
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
    expect(screen.getByTestId('persuasion-board-stance-CAIO')).toHaveTextContent('미정 → 찬성');
    expect(screen.getByTestId('persuasion-board-note-CAIO')).toHaveTextContent('설득 완료');
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 2/4');
  });

  it('참가자가 반대 쪽이면 아직 NO인 CFO 행이 "조건이 빠지면 반대로 남습니다"로 뒤집혀 보인다', () => {
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
    expect(screen.getByTestId('persuasion-board-note-CFO')).toHaveTextContent(
      "'결재 금액 한도·사람이 일부 다시 보기' 조건이 빠지면 반대로 남습니다",
    );
    // 참가자가 반대 쪽일 때 "설득한 임원"은 지금 NO(반대)인 임원 수다 — 아직 아무
    // 의견도 전달하지 않은 시점이라 CAIO는 첫 반응이 UNDECIDED(미정)라 포함되지 않고
    // CFO·CISO만 반대다.
    expect(screen.getByTestId('persuasion-board-count')).toHaveTextContent('설득한 임원 2/4');
  });
});
