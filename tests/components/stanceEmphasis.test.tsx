// T131: 찬반 강조 — 카드 색 머리띠(B안)와 무대 명패·빛·집계(C안).
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StanceBand } from '../../src/components/parts/StanceBand';
import { StageBand } from '../../src/components/parts/StageBand';
import { leaningChipText, stanceVerdict, tallyParts } from '../../src/components/stanceDisplay';
import { aiApprovalScenario as ai } from '../../src/content/scenarios/aiApproval';
import type { ExecMemberId } from '../../src/content/types';
import type { RoleStatus, SessionStage, Stance } from '../../src/domain/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stances: Record<ExecMemberId, Stance> = { CEO: 'FOR', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'AGAINST' };
const roleStatus: Record<ExecMemberId, RoleStatus> = { CEO: 'answered', CFO: 'answered', CAIO: 'answered', CISO: 'answered' };
const NEUTRAL: Record<ExecMemberId, Stance> = { CEO: 'UNDECIDED', CFO: 'UNDECIDED', CAIO: 'UNDECIDED', CISO: 'UNDECIDED' };

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('stanceDisplay', () => {
  it('확정은 큰 글자 판정, 기울음은 "쪽?" 판정이다', () => {
    expect(stanceVerdict('FOR')).toEqual({ tone: 'for', text: '찬성', leaning: false });
    expect(stanceVerdict('AGAINST')).toEqual({ tone: 'against', text: '반대', leaning: false });
    expect(stanceVerdict('UNDECIDED')).toEqual({ tone: 'undecided', text: '고민 중', leaning: false });
    expect(stanceVerdict('UNDECIDED', 'FOR')).toEqual({ tone: 'for', text: '찬성 쪽?', leaning: true });
    expect(stanceVerdict('FOR', 'AGAINST').text).toBe('반대 쪽?');
  });

  it('기울음 칩은 전후 입장과 "답하면 확정"을 함께 말한다', () => {
    expect(leaningChipText('AGAINST', 'FOR')).toBe('반대 → 찬성 · 답하면 확정');
  });

  it('집계 조각은 0인 항목을 빼고 기울음을 따로 센다', () => {
    expect(tallyParts(stances, { CFO: 'FOR' })).toEqual([
      { key: 'for', label: '찬성', count: 1 },
      { key: 'leaning', label: '기울음', count: 1 },
      { key: 'against', label: '반대', count: 1 },
      { key: 'undecided', label: '고민 중', count: 1 },
    ]);
    expect(tallyParts({ CEO: 'FOR', CFO: 'FOR', CAIO: 'AGAINST', CISO: 'FOR' }).map((part) => part.key)).toEqual([
      'for',
      'against',
    ]);
  });
});

describe('StanceBand(카드 머리띠)', () => {
  function band(stance: Stance, leaningTo?: 'FOR' | 'AGAINST', readOnly = false) {
    return (
      <StanceBand
        roleId="CFO"
        stance={stance}
        leaningTo={leaningTo}
        chip={leaningTo ? leaningChipText('AGAINST', leaningTo) : '유지'}
        readOnly={readOnly}
        heading={<h3>재무책임임원(CFO)</h3>}
      />
    );
  }

  it('판정 글자와 색 클래스를 같이 보인다(색만으로 구분하지 않는다)', () => {
    const { rerender } = render(band('FOR'));
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('찬성');
    expect(screen.getByTestId('stance-band-CFO')).toHaveClass('stance-band--for');
    rerender(band('AGAINST'));
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('반대');
    expect(screen.getByTestId('stance-band-CFO')).toHaveClass('stance-band--against');
    rerender(band('UNDECIDED'));
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('고민 중');
    expect(screen.getByTestId('stance-band-CFO')).toHaveClass('stance-band--undecided');
  });

  it('기울음은 빗금 띠 + "찬성 쪽?" + "답하면 확정" 칩으로 확정과 다르다', () => {
    render(band('UNDECIDED', 'FOR'));
    expect(screen.getByTestId('stance-band-CFO')).toHaveClass('stance-band--leaning', 'stance-band--for');
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('찬성 쪽?');
    expect(screen.getByRole('heading', { name: '재무책임임원(CFO)' })).toBeInTheDocument();
    expect(document.querySelector('.stance-band__chip')).toHaveTextContent('반대 → 찬성 · 답하면 확정');
  });

  it('처음 그릴 때는 뒤집지 않고, 입장이 바뀐 순간에만 뒤집는다', () => {
    const { rerender } = render(band('FOR'));
    expect(screen.getByTestId('stance-band-CFO')).not.toHaveClass('stance-band--flip');
    rerender(band('FOR'));
    expect(screen.getByTestId('stance-band-CFO')).not.toHaveClass('stance-band--flip');
    rerender(band('AGAINST'));
    expect(screen.getByTestId('stance-band-CFO')).toHaveClass('stance-band--flip');
  });

  it('움직임 줄이기 설정이면 바뀌어도 뒤집지 않는다', () => {
    stubReducedMotion(true);
    const { rerender } = render(band('FOR'));
    rerender(band('AGAINST'));
    expect(screen.getByTestId('stance-band-CFO')).not.toHaveClass('stance-band--flip');
    expect(screen.getByTestId('exec-mood-label-CFO')).toHaveTextContent('반대');
  });

  it('지난 화면 보기(readOnly)에서는 뒤집지 않는다', () => {
    const { rerender } = render(band('FOR', undefined, true));
    rerender(band('AGAINST', undefined, true));
    expect(screen.getByTestId('stance-band-CFO')).not.toHaveClass('stance-band--flip');
  });
});

describe('StageBand 명패·빛·집계', () => {
  function stage(
    stageName: SessionStage,
    extra: { stances?: Record<ExecMemberId, Stance>; leaning?: Partial<Record<ExecMemberId, 'FOR' | 'AGAINST'>>; readOnly?: boolean } = {},
  ) {
    return (
      <StageBand
        stage={stageName}
        mode="scripted"
        roleStatus={roleStatus}
        statements={[]}
        opinions={[]}
        scenario={ai}
        stances={extra.stances ?? stances}
        leaning={extra.leaning}
        readOnly={extra.readOnly}
      />
    );
  }

  it('REACTIONS: 큰 명패 글자·색 클래스·얼굴 빛 고리·집계가 보인다', () => {
    const { container } = render(stage('REACTIONS', { leaning: { CFO: 'FOR' } }));
    expect(screen.getByTestId('stage-mood-CEO')).toHaveTextContent('찬성');
    expect(screen.getByTestId('stage-mood-CEO')).toHaveClass('stage-band__mood--for');
    expect(screen.getByTestId('stage-mood-CISO')).toHaveTextContent('반대');
    expect(screen.getByTestId('stage-mood-CISO')).toHaveClass('stage-band__mood--against');
    expect(screen.getByTestId('stage-mood-CAIO')).toHaveTextContent('고민 중');
    expect(screen.getByTestId('stage-mood-CFO')).toHaveTextContent('찬성 쪽?');
    expect(screen.getByTestId('stage-mood-CFO')).toHaveClass('stage-band__mood--leaning');
    expect(container.querySelectorAll('.stage-band__face-ring')).toHaveLength(4);
    expect(container.querySelectorAll('.stage-band__face-ring--leaning')).toHaveLength(1);
    expect(screen.getByTestId('stage-tally').textContent).toBe('찬성 1기울음 1반대 1고민 중 1');
    // 임원 코드 명패는 그대로다.
    expect(screen.getByTestId('stage-seat-CEO')).toHaveTextContent('CEO');
  });

  it('봉인 단계(MOTION·VOTE)는 명패 "?"·빛 없음·집계 숨김이다', () => {
    for (const name of ['MOTION', 'VOTE'] as const) {
      const { container } = render(stage(name, { stances: NEUTRAL }));
      for (const id of ['CEO', 'CFO', 'CAIO', 'CISO']) {
        expect(screen.getByTestId(`stage-mood-${id}`)).toHaveTextContent('?');
        expect(screen.getByTestId(`stage-mood-${id}`)).toHaveClass('stage-band__mood--sealed');
      }
      expect(container.querySelector('.stage-band__face-ring')).toBeNull();
      expect(screen.queryByTestId('stage-tally')).toBeNull();
      expect(screen.getByTestId('stage-band').textContent ?? '').not.toMatch(/찬성|반대/);
      cleanup();
    }
  });

  it('봉인 단계에 실제 입장이 넘어와도 방향을 드러내지 않는다', () => {
    const { container } = render(stage('VOTE', { leaning: { CFO: 'FOR' } }));
    expect(screen.getByTestId('stage-mood-CEO')).toHaveTextContent('?');
    expect(screen.getByTestId('stage-mood-CFO')).toHaveTextContent('?');
    expect(container.querySelector('.stage-band__face-ring')).toBeNull();
  });

  it('BRIEFING은 집계·빛 고리를 그리지 않고 RESULT는 표 배지가 대신해 명패를 그리지 않는다', () => {
    const { container, rerender } = render(stage('BRIEFING', { stances: NEUTRAL }));
    expect(screen.queryByTestId('stage-tally')).toBeNull();
    expect(container.querySelector('.stage-band__face-ring')).toBeNull();
    rerender(stage('RESULT'));
    expect(screen.queryByTestId('stage-mood-CEO')).toBeNull();
    expect(screen.queryByTestId('stage-tally')).toBeNull();
  });

  it('입장이 바뀐 순간에만 명패가 뒤집힌다(처음·같은 값 재렌더·지난 화면 보기·움직임 줄이기는 안 뒤집힘)', () => {
    const { rerender } = render(stage('REACTIONS'));
    expect(screen.getByTestId('stage-mood-CAIO')).not.toHaveClass('stage-band__mood--flip');
    rerender(stage('REACTIONS'));
    expect(screen.getByTestId('stage-mood-CAIO')).not.toHaveClass('stage-band__mood--flip');
    rerender(stage('REACTIONS', { stances: { ...stances, CAIO: 'AGAINST' } }));
    expect(screen.getByTestId('stage-mood-CAIO')).toHaveClass('stage-band__mood--flip');
    expect(screen.getByTestId('stage-mood-CEO')).not.toHaveClass('stage-band__mood--flip');
  });

  it('지난 화면 보기(readOnly)·움직임 줄이기에서는 바뀌어도 뒤집히지 않는다', () => {
    const view = render(stage('REACTIONS', { readOnly: true }));
    view.rerender(stage('REACTIONS', { readOnly: true, stances: { ...stances, CAIO: 'AGAINST' } }));
    expect(screen.getByTestId('stage-mood-CAIO')).not.toHaveClass('stage-band__mood--flip');
    expect(screen.getByTestId('stage-mood-CAIO')).toHaveTextContent('반대');
    view.unmount();

    stubReducedMotion(true);
    const reduced = render(stage('REACTIONS'));
    reduced.rerender(stage('REACTIONS', { stances: { ...stances, CAIO: 'AGAINST' } }));
    expect(screen.getByTestId('stage-mood-CAIO')).not.toHaveClass('stage-band__mood--flip');
  });
});
