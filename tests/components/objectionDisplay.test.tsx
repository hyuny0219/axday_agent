// T137: 반대 근거(Condition.side 'AGAINST')의 화면 표시 — 빨간 칩·라벨, 안건 미수정, 반대 사유 목록.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConditionChips } from '../../src/components/parts/ConditionChips';
import { PhraseCard } from '../../src/components/parts/PhraseCard';
import { chairMotionLine } from '../../src/components/chairMotionLine';
import { objectionTagFor } from '../../src/components/conditionSource';
import { buildMotionDisplay } from '../../src/components/motionDisplay';
import { computeResultStamp } from '../../src/components/resultStamp';
import { buildResultSummary } from '../../src/components/resultSummary';
import { aiApprovalScenario, experienceFirstScenario } from '../../src/content/scenarios';
import { freezeMotion } from '../../src/domain/motion';
import { createInitialSession } from '../../src/domain/session';
import { decideBoard } from '../../src/domain/voting';
import type { Session } from '../../src/domain/types';

afterEach(() => cleanup());

describe('ConditionChips — 반대 근거 칩(T137)', () => {
  const noop = () => undefined;

  it('반대 근거만 있으면 줄 라벨이 "반대 근거"이고 칩에 빨강 modifier가 붙는다', () => {
    render(
      <ConditionChips
        scenario={aiApprovalScenario}
        proposedIds={['AG_AUDIT', 'AG_TRUST']}
        acceptedIds={['AG_AUDIT']}
        conflictPairs={[]}
        showNoMatchHint={false}
        onToggle={noop}
      />,
    );
    expect(screen.getByTestId('condition-chips-label')).toHaveTextContent(/^조건$/);
    expect(screen.getByTestId('condition-chip-AG_AUDIT')).toHaveClass('condition-chip--objection');
    expect(screen.getByTestId('condition-chip-AG_AUDIT')).toHaveClass('condition-chip--accepted');
    expect(screen.getByTestId('condition-chip-AG_TRUST')).toHaveClass('condition-chip--objection');
  });

  it('찬성 조건 칩에는 빨강 modifier가 없고 줄 라벨은 "조건"이다', () => {
    render(
      <ConditionChips
        scenario={aiApprovalScenario}
        proposedIds={['LOG']}
        acceptedIds={['LOG']}
        conflictPairs={[]}
        showNoMatchHint={false}
        onToggle={noop}
      />,
    );
    expect(screen.getByTestId('condition-chips-label')).toHaveTextContent(/^조건$/);
    expect(screen.getByTestId('condition-chip-LOG')).not.toHaveClass('condition-chip--objection');
  });

  it('새로 붙은 반대 근거 꼬리는 "+ 새 근거"다', () => {
    render(
      <ConditionChips
        scenario={experienceFirstScenario}
        proposedIds={['AG_WARN']}
        acceptedIds={['AG_WARN']}
        newlyProposedIds={['AG_WARN']}
        conflictPairs={[]}
        showNoMatchHint={false}
        onToggle={noop}
      />,
    );
    expect(screen.getByTestId('condition-chip-AG_WARN')).toHaveTextContent('+ 새 조건');
  });
});

describe('PhraseCard — 반대 근거 라벨(T137)', () => {
  it('자료 이름이 있으면 "반대 근거 · 감사 메모", 함정은 "반대 근거"만 보인다', () => {
    expect(objectionTagFor(aiApprovalScenario, 'AG_AUDIT')).toBe('조건 · 감사 메모');
    expect(objectionTagFor(aiApprovalScenario, 'AG_BAN')).toBe('조건');
    expect(objectionTagFor(aiApprovalScenario, 'LOG')).toBeUndefined();
    expect(objectionTagFor(aiApprovalScenario, null)).toBeUndefined();
    render(
      <PhraseCard
        phrase={{ id: 'N1', text: '문구' }}
        selected={false}
        onToggle={() => undefined}
        objectionTag="조건 · 감사 메모"
      />,
    );
    expect(screen.getByTestId('phrase-card-N1')).toHaveClass('phrase-card--objection');
    expect(screen.getByTestId('phrase-tag-N1')).toHaveTextContent('조건 · 감사 메모');
  });
});

describe('반대 근거는 안건을 수정하지 않는다(T137)', () => {
  const sc = aiApprovalScenario;

  it('freezeMotion: 반대 근거만 있으면 kind가 original이고 표결용 조건 ID에는 담긴다', () => {
    const motion = freezeMotion(sc, ['AG_AUDIT'], 1);
    expect(motion.kind).toBe('original');
    expect(motion.text).toBe(sc.originalMotion.text);
    expect(motion.effectiveConditionIds).toEqual(['AG_AUDIT']);
    expect(freezeMotion(sc, ['AG_AUDIT', 'LOG'], 1).kind).toBe('amended');
  });

  it('buildMotionDisplay: 문장은 원안 그대로이고 반대 사유가 따로 나온다', () => {
    const display = buildMotionDisplay(sc, ['AG_AUDIT', 'AG_TRUST'], 'AGAINST');
    expect(display.sentence).toBe(sc.motionBreakdown.proposal);
    expect(display.conditionLabels).toEqual([]);
    expect(display.objectionLabels).toEqual(['승인 이유를 확인할 수 없음', '믿지 못해 책임이 흐려짐']);
    // 미정 항목도 줄지 않는다.
    expect(display.undecidedLabels).toHaveLength(sc.motionBreakdown.undecidedItems.length);
  });

  it('chairMotionLine: 반대 쪽 조건도 찬성 쪽과 같은 "요구 조건" 문구를 쓴다', () => {
    expect(chairMotionLine(sc, ['AG_AUDIT'], 'AGAINST')).toBe(
      '이사님의 반대 의견과 요구 조건(승인 이유를 확인할 수 없음)을 달아 표결에 부칩니다',
    );
    expect(chairMotionLine(sc, ['AG_AUDIT', 'AG_TRUST'], 'AGAINST')).toContain('요구 조건 2개');
  });

  function resultSession(conditionIds: string[], outcome: 'PASS' | 'REJECT'): Session {
    const base = createInitialSession(0, 's');
    const motion = freezeMotion(sc, conditionIds, 1);
    const ballots = decideBoard(sc, motion, 'AGAINST').map((ballot) => ({ ...ballot }));
    return {
      ...base,
      mode: 'scripted',
      stage: 'RESULT',
      outcome,
      finalMotion: motion,
      opinions: [
        { id: 'o', originalText: '반대합니다', selectedPhraseIds: [], confirmedConditionIds: conditionIds, stance: 'AGAINST', createdAt: 0 },
      ],
      ballots: [
        ...ballots,
        { memberId: 'PARTICIPANT', motionId: motion.id, motionHash: motion.hash, source: 'scripted', vote: 'NO', confirmedAt: 1 },
      ],
    };
  }

  it('결과 요약: 반대 근거는 conditionLabels가 아니라 objectionLabels에 담긴다', () => {
    const summary = buildResultSummary(sc, resultSession(['AG_AUDIT'], 'REJECT'));
    expect(summary.conditionLabels).toEqual([]);
    expect(summary.objectionLabels).toEqual(['승인 이유를 확인할 수 없음']);
  });

  it('도장: 반대 근거만 있는 가결은 "조건부 가결"이 아니라 "가결"이다', () => {
    const session = resultSession(['AG_AUDIT'], 'PASS');
    expect(computeResultStamp(session, sc)?.text).toBe('가결');
    const withCondition = resultSession(['AG_AUDIT', 'LOG'], 'PASS');
    expect(computeResultStamp(withCondition, sc)?.text).toBe('조건부 가결');
  });
});
