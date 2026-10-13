// T128 화면 연결: 클릭음 범위·도착음(지난 화면 보기 제외)·표 공개음(한 번만/장마다)·덕킹·엔딩 소리·
// 추천 카드 선택음·운영 메뉴 '소리' 구역.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { clickCueFor, countArrivals } from '../../src/audio/cues';
import { SoundHost } from '../../src/audio/SoundHost';
import { createSound, sound as appSound, type Sound } from '../../src/audio/sound';
import { useResultSounds } from '../../src/audio/useResultSounds';
import { EndingCard } from '../../src/components/parts/EndingCard';
import { OperatorMenu } from '../../src/components/parts/OperatorMenu';
import { PhraseCard } from '../../src/components/parts/PhraseCard';
import { ENDING_AUTO_RETURN_SECONDS } from '../../src/domain/endingReturn';
import type { EndingModel } from '../../src/components/endingSummary';
import { memoryStorage } from './fakeAudio';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  appSound.updateSettings({ bgm: 'tension', bgmVolume: 45, sfxOn: true, sfxVolume: 80 });
});

function fakeSound() {
  const target = createSound({ createContext: () => null, storage: memoryStorage() });
  return {
    target,
    play: vi.spyOn(target, 'play'),
    playArrive: vi.spyOn(target, 'playArrive'),
    unlock: vi.spyOn(target, 'unlock'),
    setScene: vi.spyOn(target, 'setScene'),
  };
}

describe('클릭음 범위', () => {
  function cue(html: string) {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const result = clickCueFor(host.firstElementChild);
    host.remove();
    return result;
  }
  it('주요 버튼(.cta)만 clickA, 보조·외곽선·비활성은 무음', () => {
    expect(cue('<button class="cta">시작</button>')).toBe('clickA');
    expect(cue('<button class="cta cta--solid">시작</button>')).toBe('clickA');
    expect(cue('<button class="cta cta--secondary">보조</button>')).toBeNull();
    expect(cue('<button class="cta cta--outline" aria-disabled="true">전달</button>')).toBeNull();
    expect(cue('<button class="cta" disabled>시작</button>')).toBeNull();
    expect(cue('<button class="plain">기타</button>')).toBeNull();
    expect(cue('<span>글자</span>')).toBeNull();
  });
  it('data-sound로 전달은 sendA, 이전·다음은 clickA, none은 무음', () => {
    expect(cue('<button class="cta" data-sound="send">의견 전달</button>')).toBe('sendA');
    expect(cue('<button class="cta" data-sound="send" disabled>의견 전달</button>')).toBeNull();
    expect(cue('<button class="view-nav__btn" data-sound="click">다음</button>')).toBe('clickA');
    expect(cue('<button class="cta" data-sound="none">조용히</button>')).toBeNull();
  });
});

describe('SoundHost', () => {
  it('첫 입력에서 unlock하고 주요 버튼에서 clickA를 낸다', () => {
    const { target, play, unlock } = fakeSound();
    render(
      <>
        <SoundHost stage="ATTRACT" target={target} />
        <button className="cta">체험 시작</button>
        <button className="cta cta--secondary">보조</button>
      </>,
    );
    expect(unlock).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('체험 시작'));
    expect(unlock).toHaveBeenCalled();
    fireEvent.click(screen.getByText('체험 시작'));
    expect(play).toHaveBeenCalledWith('clickA');
    play.mockClear();
    fireEvent.click(screen.getByText('보조'));
    expect(play).not.toHaveBeenCalled();
  });

  it('단계에 따라 BGM 장면을 알린다(ATTRACT 무음, MOTION·VOTE 낮게)', () => {
    const { target, setScene } = fakeSound();
    const { rerender } = render(<SoundHost stage="ATTRACT" target={target} />);
    expect(setScene).toHaveBeenLastCalledWith({ playing: false, low: false });
    rerender(<SoundHost stage="DISCUSS" target={target} />);
    expect(setScene).toHaveBeenLastCalledWith({ playing: true, low: false });
    rerender(<SoundHost stage="VOTE" target={target} />);
    expect(setScene).toHaveBeenLastCalledWith({ playing: true, low: true });
    rerender(<SoundHost stage="ATTRACT" target={target} />);
    expect(setScene).toHaveBeenLastCalledWith({ playing: false, low: false });
  });

  it('임원 카드가 새로 붙을 때만 도착음, 지난 화면 보기 안은 무음', async () => {
    const { target, playArrive } = fakeSound();
    render(
      <>
        <SoundHost stage="REACTIONS" target={target} />
        <div id="live" />
      </>,
    );
    const live = document.getElementById('live')!;
    await act(async () => {
      live.innerHTML = '<div data-testid="statement-card-CEO"></div><div data-testid="reaction-card-CFO"></div><div data-testid="reaction-card-badge-CFO"></div>';
      await Promise.resolve();
    });
    expect(playArrive).toHaveBeenCalledTimes(2);
    playArrive.mockClear();
    await act(async () => {
      live.innerHTML = '<div data-past-screen><div data-testid="statement-card-CEO"></div></div>';
      await Promise.resolve();
    });
    expect(playArrive).not.toHaveBeenCalled();
  });

  it('countArrivals는 임원 카드 testid만 센다', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div data-testid="statement-card-CAIO"></div><div data-testid="statement-card-X"></div><div data-testid="reaction-card-cause-CEO"></div>';
    expect(countArrivals(host)).toBe(1);
  });
});

describe('표 공개음', () => {
  function Probe({ target, state }: { target: Sound; state: { execRevealed: number; allRevealed: boolean } }) {
    useResultSounds(state, target);
    return null;
  }
  it('장마다 revealB, 끝나면 도장 한 번, 공개 중에는 덕킹', () => {
    const { target, play } = fakeSound();
    const duck = vi.spyOn(target, 'setDuck');
    const { rerender } = render(<Probe target={target} state={{ execRevealed: 0, allRevealed: false }} />);
    expect(duck).toHaveBeenLastCalledWith(true);
    for (let n = 1; n <= 4; n += 1) {
      rerender(<Probe target={target} state={{ execRevealed: n, allRevealed: false }} />);
    }
    expect(play.mock.calls.filter(([name]) => name === 'revealB')).toHaveLength(4);
    expect(play).not.toHaveBeenCalledWith('stamp');
    rerender(<Probe target={target} state={{ execRevealed: 4, allRevealed: true }} />);
    expect(play.mock.calls.filter(([name]) => name === 'stamp')).toHaveLength(1);
    expect(duck).toHaveBeenLastCalledWith(false);
  });
  it('건너뛰기·감속처럼 한꺼번에 열리면 공개음은 한 번만', () => {
    const { target, play } = fakeSound();
    render(<Probe target={target} state={{ execRevealed: 4, allRevealed: true }} />);
    expect(play.mock.calls.filter(([name]) => name === 'revealB')).toHaveLength(1);
  });
  it('떠날 때 덕킹을 풀어 준다', () => {
    const { target } = fakeSound();
    const duck = vi.spyOn(target, 'setDuck');
    const { unmount } = render(<Probe target={target} state={{ execRevealed: 0, allRevealed: false }} />);
    unmount();
    expect(duck).toHaveBeenLastCalledWith(false);
  });
});

describe('추천 카드', () => {
  it('선택할 때만 pickA(해제는 무음)', () => {
    const play = vi.spyOn(appSound, 'play');
    const onToggle = vi.fn();
    const { rerender } = render(<PhraseCard phrase={{ id: 'p1', text: '문구' }} selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(play).toHaveBeenCalledWith('pickA');
    play.mockClear();
    rerender(<PhraseCard phrase={{ id: 'p1', text: '문구' }} selected onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(play).not.toHaveBeenCalled();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe('엔딩 소리', () => {
  const model = (success: boolean): EndingModel => ({
    success,
    stampText: success ? '성공' : '실패',
    reason: '이유',
    seats: [],
    outcomeLine: '안건',
    epilogueLine: null,
    clue: null,
    conditionLabels: [],
  } as unknown as EndingModel);

  it('열릴 때 BGM을 멈추고 팡파르를 한 번, 닫히면 BGM을 되돌린다', () => {
    const setEnding = vi.spyOn(appSound, 'setEnding');
    const playEnding = vi.spyOn(appSound, 'playEnding');
    const { unmount } = render(<EndingCard model={model(true)} caseTag="A" onDetail={() => undefined} onHome={() => undefined} />);
    expect(setEnding).toHaveBeenLastCalledWith(true);
    expect(playEnding).toHaveBeenCalledTimes(1);
    expect(playEnding).toHaveBeenCalledWith(true);
    unmount();
    expect(setEnding).toHaveBeenLastCalledWith(false);
  });

  it('실패 팡파르는 실패 쪽', () => {
    const playEnding = vi.spyOn(appSound, 'playEnding');
    render(<EndingCard model={model(false)} caseTag="A" onDetail={() => undefined} onHome={() => undefined} />);
    expect(playEnding).toHaveBeenCalledWith(false);
  });

  it('자동 복귀 마지막 10초에만 1초마다 tick', () => {
    vi.useFakeTimers();
    let now = 0;
    const clock = { now: () => now };
    const play = vi.spyOn(appSound, 'play');
    render(<EndingCard model={model(true)} caseTag="A" onDetail={() => undefined} onHome={() => undefined} clock={clock} />);
    const advanceTo = (seconds: number) => {
      now = seconds * 1000;
      act(() => {
        vi.advanceTimersByTime(250);
      });
    };
    advanceTo(ENDING_AUTO_RETURN_SECONDS - 20);
    expect(play).not.toHaveBeenCalledWith('tick');
    for (let left = 10; left >= 1; left -= 1) advanceTo(ENDING_AUTO_RETURN_SECONDS - left);
    expect(play.mock.calls.filter(([name]) => name === 'tick')).toHaveLength(10);
  });
});

describe('운영 메뉴 소리 구역', () => {
  it('곡 선택·끄기·효과음 토글·음량이 설정에 반영된다', () => {
    render(<OperatorMenu onNewSession={() => undefined} />);
    fireEvent.click(screen.getByTestId('operator-menu-button'));
    fireEvent.click(screen.getByTestId('operator-sound'));
    expect(screen.getByTestId('operator-bgm-tension')).toBeChecked();
    fireEvent.click(screen.getByTestId('operator-bgm-piano'));
    expect(appSound.getSettings().bgm).toBe('piano');
    fireEvent.click(screen.getByTestId('operator-bgm-off'));
    expect(appSound.getSettings().bgm).toBe('off');
    fireEvent.change(screen.getByTestId('operator-bgm-volume'), { target: { value: '30' } });
    expect(appSound.getSettings().bgmVolume).toBe(30);
    fireEvent.click(screen.getByTestId('operator-sfx-on'));
    expect(appSound.getSettings().sfxOn).toBe(false);
    expect(screen.getByTestId('operator-sfx-volume')).toBeDisabled();
    fireEvent.click(screen.getByTestId('operator-sfx-on'));
    fireEvent.change(screen.getByTestId('operator-sfx-volume'), { target: { value: '10' } });
    expect(appSound.getSettings().sfxVolume).toBe(10);
    fireEvent.click(screen.getByTestId('operator-sound-back'));
    expect(screen.getByTestId('operator-menu-panel')).toBeInTheDocument();
  });
});
