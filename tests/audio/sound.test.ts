// 소리 컨트롤러(T128): 첫 클릭 전 컨텍스트 없음 · BGM 선택/교체/끄기 · 엔딩에서 정지 · 덕킹 ·
// 효과음 끄기 · AudioContext 없는 환경 · 설정 저장/복원.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SOUND_SETTINGS,
  LAST_BGM_STORAGE_KEY,
  LEGACY_SOUND_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  createSound,
  parseSoundSettings,
  pickRandomBgm,
} from '../../src/audio/sound';
import { createFakeContext, memoryStorage } from './fakeAudio';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(stored?: Record<string, string>, random?: () => number) {
  const fake = createFakeContext();
  const createContext = vi.fn(() => fake.ctx);
  const storage = memoryStorage(stored);
  const sound = createSound({ createContext, storage, random });
  return { fake, createContext, storage, sound };
}

describe('AudioContext 생성', () => {
  it('첫 사용자 입력(unlock) 전에는 만들지 않고, 만들어도 하나만 쓴다', () => {
    const { sound, createContext } = setup();
    sound.setScene({ playing: true, low: false });
    sound.play('clickA');
    expect(createContext).not.toHaveBeenCalled();
    sound.unlock();
    sound.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(sound.hasContext()).toBe(true);
  });

  it('suspended면 unlock에서 resume한다', () => {
    const { sound, fake } = setup();
    sound.unlock();
    expect(fake.state.resumeCalls).toBe(1);
  });

  it('AudioContext가 없는 환경에서는 모든 호출이 예외 없이 지나간다', () => {
    const sound = createSound({ createContext: () => null, storage: memoryStorage() });
    expect(() => {
      sound.unlock();
      sound.setScene({ playing: true, low: true });
      sound.setDuck(true);
      sound.setEnding(true);
      sound.play('stamp');
      sound.playArrive();
      sound.playEnding(true);
      sound.updateSettings({ bgm: 'piano' });
    }).not.toThrow();
    expect(sound.hasContext()).toBe(false);
    expect(sound.currentBgm()).toBeNull();
  });

  it('컨텍스트 생성이 예외를 던져도 조용히 넘어간다', () => {
    const sound = createSound({
      createContext: () => {
        throw new Error('blocked');
      },
      storage: null,
    });
    expect(() => sound.unlock()).not.toThrow();
  });
});

describe('BGM', () => {
  it('기본은 소리 켬·랜덤이고, 체험 중 장면에서만 재생한다(T130)', () => {
    const { sound } = setup(undefined, () => 0);
    expect(sound.getSettings()).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(DEFAULT_SOUND_SETTINGS.bgm).toBe('random');
    sound.unlock();
    expect(sound.currentBgm()).toBeNull();
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).toBe('tension');
    sound.setScene({ playing: false, low: false });
    expect(sound.currentBgm()).toBeNull();
  });

  it('unlock 전에 장면이 정해져 있으면 unlock에서 시작한다', () => {
    const { sound } = setup(undefined, () => 0);
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).toBeNull();
    sound.unlock();
    expect(sound.currentBgm()).toBe('tension');
  });

  it('곡을 고르면 재생 중인 곡을 바로 교체하고, 끄기는 멈춘다', () => {
    const { sound } = setup();
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    sound.updateSettings({ bgm: 'pulse' });
    expect(sound.currentBgm()).toBe('pulse');
    sound.updateSettings({ bgm: 'piano' });
    expect(sound.currentBgm()).toBe('piano');
    sound.updateSettings({ bgm: 'off' });
    expect(sound.currentBgm()).toBeNull();
    sound.updateSettings({ bgm: 'tension' });
    expect(sound.currentBgm()).toBe('tension');
  });

  it('엔딩이 열리면 멈추고 닫히면 같은 곡을 다시 깐다', () => {
    const { sound } = setup(undefined, () => 0.99);
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    const picked = sound.currentBgm();
    sound.setEnding(true);
    expect(sound.currentBgm()).toBeNull();
    sound.setEnding(false);
    expect(sound.currentBgm()).toBe(picked);
  });

  it('랜덤: 한 체험 안에서는 같은 곡, 다음 체험에서는 바로 전 곡을 피해 새로 고른다', () => {
    const { sound } = setup(undefined, () => 0);
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).toBe('tension');
    sound.setScene({ playing: true, low: true }); // MOTION·VOTE
    expect(sound.currentBgm()).toBe('tension');
    sound.setScene({ playing: false, low: false }); // 처음 화면
    sound.setScene({ playing: true, low: false }); // 다음 체험
    expect(sound.currentBgm()).toBe('pulse'); // tension을 빼고 첫 번째
    sound.setScene({ playing: false, low: false });
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).toBe('tension'); // 바로 전(pulse)만 피한다
  });

  it('랜덤은 직전 체험에 고정 모드로 재생한 곡도 피한다(PR #21 Codex P2)', () => {
    const { sound } = setup(undefined, () => 0);
    sound.unlock();
    sound.setScene({ playing: true, low: false }); // 랜덤 → tension
    sound.setScene({ playing: false, low: false });
    sound.updateSettings({ bgm: 'pulse' });
    sound.setScene({ playing: true, low: false }); // 고정 pulse로 한 판
    expect(sound.currentBgm()).toBe('pulse');
    sound.setScene({ playing: false, low: false });
    sound.updateSettings({ bgm: 'random' });
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).not.toBe('pulse');
    expect(sound.currentBgm()).toBe('tension'); // pulse를 뺀 첫 번째
  });

  it('페이지를 새로 불러와도(scripted로 새 체험) 직전 곡을 기억해 피한다(PR #21 Codex P2)', () => {
    const first = setup(undefined, () => 0);
    first.sound.unlock();
    first.sound.setScene({ playing: true, low: false });
    expect(first.sound.currentBgm()).toBe('tension');
    expect(first.storage.data[LAST_BGM_STORAGE_KEY]).toBe('tension');
    // 새로고침: 같은 저장소로 컨트롤러를 새로 만든다.
    const fake = createFakeContext();
    const second = createSound({ createContext: () => fake.ctx, storage: first.storage, random: () => 0 });
    second.unlock();
    second.setScene({ playing: true, low: false });
    expect(second.currentBgm()).toBe('pulse');
  });

  it('저장된 직전 곡 값이 이상하면 무시한다', () => {
    const { sound } = setup({ [LAST_BGM_STORAGE_KEY]: 'jazz' }, () => 0);
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    expect(sound.currentBgm()).toBe('tension');
  });

  it('pickRandomBgm은 바로 전 곡을 빼고 고른다', () => {
    for (const r of [0, 0.3, 0.6, 0.999]) {
      expect(pickRandomBgm('piano', () => r)).not.toBe('piano');
    }
    expect(pickRandomBgm(null, () => 0.999)).toBe('piano');
  });

  it('MOTION·VOTE는 낮게, 표 공개 덕킹은 크게 줄이고 끝나면 원래대로', () => {
    const { sound, fake } = setup();
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    const level = fake.gains[3]!.gain; // master, bgmBus, sfxBus 다음이 트랙 음량 노드
    const last = () => level.calls.filter((c) => c.kind === 'target').at(-1)!.value;
    expect(last()).toBe(1);
    sound.setScene({ playing: true, low: true });
    expect(last()).toBeLessThan(1);
    const low = last();
    sound.setDuck(true);
    expect(last()).toBeLessThan(low);
    sound.setDuck(false);
    expect(last()).toBe(low);
    sound.setScene({ playing: true, low: false });
    expect(last()).toBe(1);
  });

  it('멈춘 트랙은 서서히 줄이고 잠시 뒤 연결을 끊는다', () => {
    const { sound, fake } = setup();
    sound.unlock();
    sound.setScene({ playing: true, low: false });
    const level = fake.gains[3]!;
    sound.setScene({ playing: false, low: false });
    expect(level.gain.calls.at(-1)!.value).toBeLessThan(0.01);
    expect(level.disconnected).toBe(false);
    vi.advanceTimersByTime(1300);
    expect(level.disconnected).toBe(true);
  });
});

describe('효과음', () => {
  it('켜져 있으면 소리가 시작되고, 끄면 무음이다', () => {
    const { sound, fake } = setup();
    sound.unlock();
    sound.play('arriveA');
    const after = fake.started.oscillators;
    expect(after).toBeGreaterThan(0);
    sound.updateSettings({ sfxOn: false });
    sound.play('arriveA');
    sound.playArrive();
    sound.playEnding(true);
    expect(fake.started.oscillators).toBe(after);
  });

  it('도착음은 겹치면 간격을 두고 밀어서 낸다', () => {
    const { sound, fake } = setup();
    sound.unlock();
    sound.playArrive();
    sound.playArrive();
    sound.playArrive();
    const delays = fake.freqSets.filter((f) => f.value === 784).map((f) => f.time);
    expect(delays).toHaveLength(3);
    expect(delays[1]! - delays[0]!).toBeGreaterThanOrEqual(0.3);
    expect(delays[2]! - delays[1]!).toBeGreaterThanOrEqual(0.3);
  });
});

describe('설정 저장·복원', () => {
  it('바꾼 설정을 저장하고 새로 만들면 복원한다', () => {
    const first = setup();
    first.sound.updateSettings({ bgm: 'piano', bgmVolume: 20, sfxOn: false, sfxVolume: 55 });
    const second = createSound({ createContext: () => null, storage: first.storage });
    expect(second.getSettings()).toEqual({ bgm: 'piano', bgmVolume: 20, sfxOn: false, sfxVolume: 55 });
  });

  it('v1에 저장된 곡 선택은 버리고(랜덤으로 시작) 음량·효과음은 옮겨 온다(T130)', () => {
    const { sound } = setup({
      [LEGACY_SOUND_STORAGE_KEY]: JSON.stringify({ bgm: 'tension', bgmVolume: 30, sfxOn: false, sfxVolume: 60 }),
    });
    expect(sound.getSettings()).toEqual({ bgm: 'random', bgmVolume: 30, sfxOn: false, sfxVolume: 60 });
  });

  it('저장값이 깨졌거나 저장소를 못 쓰면 기본값이다', () => {
    expect(parseSoundSettings('{oops')).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(parseSoundSettings(JSON.stringify({ bgm: 'jazz', bgmVolume: 'x' }))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(parseSoundSettings(JSON.stringify({ bgmVolume: 999 })).bgmVolume).toBe(100);
    const broken = createSound({
      createContext: () => null,
      storage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });
    expect(broken.getSettings()).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(() => broken.updateSettings({ bgm: 'off' })).not.toThrow();
    expect(broken.getSettings().bgm).toBe('off');
  });

  it('저장 키에 JSON으로 쓴다', () => {
    const { sound, storage } = setup();
    sound.updateSettings({ bgm: 'pulse' });
    expect(JSON.parse(storage.data[SOUND_STORAGE_KEY]!).bgm).toBe('pulse');
  });

  it('구독자에게 변경을 알린다', () => {
    const { sound } = setup();
    const listener = vi.fn();
    const off = sound.subscribe(listener);
    sound.updateSettings({ bgm: 'off' });
    off();
    sound.updateSettings({ bgm: 'tension' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
