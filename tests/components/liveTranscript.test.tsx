// live 회의 기록에서 뽑는 셀렉터(PR #20 Codex 28차 P2-3·P2-4)와, 그 값이 조건 추천·
// 설득 현황판에 실제로 반영되는지 확인한다.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildConditionRecommendation } from '../../src/components/conditionRecommendation';
import { latestSuggestedConditionIds, liveOpeningStance } from '../../src/components/liveTranscript';
import { openingStanceOf } from '../../src/components/openingStance';
import { PersuasionBoard } from '../../src/components/parts/PersuasionBoard';
import { aiApprovalScenario } from '../../src/content/scenarios';
import type { ExecMemberId } from '../../src/content/types';
import type { Stance, Statement } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

function statement(
  id: string,
  roleId: ExecMemberId,
  stage: Statement['stage'],
  stance: Stance | undefined,
  suggestedConditionIds: string[] = [],
): Statement {
  return {
    id,
    roleId,
    stage,
    text: '발언',
    evidenceIds: [],
    referencedStatementIds: [],
    concerns: [],
    suggestedConditionIds,
    stance,
    source: 'live',
    createdAt: 0,
  };
}

describe('latestSuggestedConditionIds(P2-3)', () => {
  it('역할별 가장 최근 발언의 제안 조건을 모으고, 비어 있는 최신 발언은 값이 없는 것으로 둔다', () => {
    const result = latestSuggestedConditionIds([
      statement('a', 'CFO', 'OPINIONS', 'AGAINST', ['LIMIT']),
      statement('b', 'CFO', 'REACTIONS', 'AGAINST', ['REVIEW']),
      statement('c', 'CISO', 'OPINIONS', 'AGAINST', ['OWNER']),
      statement('d', 'CISO', 'REACTIONS', 'AGAINST', []),
    ]);
    expect(result).toEqual({ CFO: ['REVIEW'] });
  });

  it('모은 값이 live 조건 추천에 반영된다(규칙표 대신 발언 제안, 참고 표시 없음)', () => {
    const hints = latestSuggestedConditionIds([statement('c', 'CISO', 'OPINIONS', 'AGAINST', ['LOG'])]);
    const stances: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'FOR', CAIO: 'FOR', CISO: 'AGAINST' };
    const result = buildConditionRecommendation(aiApprovalScenario, [], 'FOR', 'live', stances, hints);
    expect(result.rows.map((row) => [row.conditionId, row.movedMemberIds])).toEqual([['LOG', ['CISO']]]);
    expect(result.usedRuleFallback).toBe(false);
  });
});

describe('live 첫 의견 입장(P2-4)', () => {
  it('liveOpeningStance는 그 역할의 첫 OPINIONS 발언 stance를 쓴다', () => {
    const statements = [
      statement('a', 'CFO', 'REACTIONS', 'FOR'),
      statement('b', 'CFO', 'OPINIONS', 'AGAINST'),
      statement('c', 'CFO', 'OPINIONS', 'FOR'),
    ];
    expect(liveOpeningStance(statements, 'CFO')).toBe('AGAINST');
    expect(liveOpeningStance(statements, 'CEO')).toBeUndefined();
  });

  it('openingStanceOf: live는 발언 기준(없으면 미정), scripted는 시나리오 각본 값이다', () => {
    const scripted = openingStanceOf(aiApprovalScenario, 'CFO');
    expect(scripted).toBe('AGAINST');
    const statements = [statement('a', 'CFO', 'OPINIONS', 'FOR')];
    expect(openingStanceOf(aiApprovalScenario, 'CFO', 'live', statements)).toBe('FOR');
    expect(openingStanceOf(aiApprovalScenario, 'CFO', 'live', [])).toBe('UNDECIDED');
    expect(openingStanceOf(aiApprovalScenario, 'CFO', 'scripted', statements)).toBe('AGAINST');
  });

  it('PersuasionBoard live: 모델이 처음부터 찬성이던 CFO는 "반대 → 찬성"으로 표시되지 않는다', () => {
    const statements = [statement('a', 'CFO', 'OPINIONS', 'FOR')];
    const stances: Record<ExecMemberId, Stance> = { CEO: 'UNDECIDED', CFO: 'FOR', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' };
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance="FOR"
        stances={stances}
        mode="live"
        statements={statements}
      />,
    );
    fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
    expect(screen.getByTestId('persuasion-board-stance-CFO')).not.toHaveTextContent('→');
  });

  it('PersuasionBoard live: 첫 의견과 지금이 달라진 임원은 실제 첫 발언 기준으로 변화가 표시된다', () => {
    const statements = [
      statement('a', 'CFO', 'OPINIONS', 'AGAINST'),
      statement('b', 'CFO', 'REACTIONS', 'FOR'),
    ];
    const stances: Record<ExecMemberId, Stance> = { CEO: 'UNDECIDED', CFO: 'FOR', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' };
    render(
      <PersuasionBoard
        scenario={aiApprovalScenario}
        confirmedConditionIds={[]}
        participantStance="FOR"
        stances={stances}
        mode="live"
        statements={statements}
      />,
    );
    fireEvent.click(screen.getByTestId('persuasion-board-toggle'));
    expect(screen.getByTestId('persuasion-board-stance-CFO')).toHaveTextContent('반대 → 찬성');
  });
});
