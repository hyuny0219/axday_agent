// 소리 컨트롤러(T128): AudioContext 하나, 설정(저장·복원), BGM 장면별 재생·덕킹, 효과음 재생.
// 화면은 이 모듈의 `sound` 싱글턴만 부른다. AudioContext가 없는 환경(jsdom, 구형 브라우저)에서는
// 모든 호출이 조용히 아무것도 하지 않는다. 컨텍스트는 첫 사용자 입력(unlock)에서만 만든다.

import { createSynth, BGM_NAMES, type BgmHandle, type BgmName, type SfxName, type SynthEngine } from './synth';

/** 'random'(기본, T130): 체험을 시작할 때마다 세 곡 중 하나를 고른다(바로 전 곡은 피함). */
export type BgmChoice = BgmName | 'random' | 'off';
export const BGM_CHOICES: readonly BgmChoice[] = ['random', ...BGM_NAMES, 'off'];

export interface SoundSettings {
  bgm: BgmChoice;
  /** 0~100 */
  bgmVolume: number;
  sfxOn: boolean;
  /** 0~100 */
  sfxVolume: number;
}

/** 시안의 슬라이더 기본값(BGM 45, 효과음 80), 소리 켬, BGM은 랜덤(2026-10-13 사용자 지시, T130). */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  bgm: 'random',
  bgmVolume: 45,
  sfxOn: true,
  sfxVolume: 80,
};

// v2(T130): 기본 곡이 랜덤으로 바뀌어 키를 올렸다. v1에 저장된 곡 선택('긴장된 회의실' 등)은
// 버리고 음량·효과음 설정만 옮겨 온다 — 이미 쓰던 브라우저도 랜덤으로 시작하게.
export const SOUND_STORAGE_KEY = 'boardroom.sound.v2';
export const LEGACY_SOUND_STORAGE_KEY = 'boardroom.sound.v1';
/** 마지막으로 재생한 BGM. 'scripted로 새 체험'처럼 페이지를 새로 불러와도 랜덤이 직전 곡을 피하게(PR #21 Codex P2). */
export const LAST_BGM_STORAGE_KEY = 'boardroom.sound.lastBgm';

export const BGM_CHOICE_LABELS: Record<BgmChoice, string> = {
  random: '랜덤(체험마다 바뀜)',
  tension: '긴장된 회의실',
  pulse: '브리핑 펄스',
  piano: '조용한 숙고',
  off: '끄기',
};

export const BGM_LABELS: Record<BgmName, string> = {
  tension: '긴장된 회의실',
  pulse: '브리핑 펄스',
  piano: '조용한 숙고',
};

export interface SoundScene {
  /** 체험이 진행 중인가(ATTRACT·처음 화면에서는 false). */
  playing: boolean;
  /** MOTION·VOTE처럼 조금 낮게 깔 장면인가. */
  low: boolean;
}

export interface SoundOptions {
  /** 테스트에서 가짜 AudioContext를 주입한다. null을 돌려주면 소리 없는 환경이다. */
  createContext?: () => AudioContext | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** 랜덤 곡 고르기에 쓰는 난수(0 이상 1 미만). 테스트에서 고정한다. */
  random?: () => number;
}

/** 랜덤 모드의 곡 고르기: 바로 전 곡(exclude)을 빼고 고른다. */
export function pickRandomBgm(exclude: BgmName | null, random: () => number = Math.random): BgmName {
  const pool = BGM_NAMES.filter((name) => name !== exclude);
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] as BgmName;
}

const LEVEL_NORMAL = 1;
const LEVEL_LOW = 0.7;
const LEVEL_DUCK = 0.25;
/** 임원 발언·반응 카드가 겹쳐 도착할 때 효과음 사이 최소 간격(초). */
const ARRIVE_GAP_SECONDS = 0.32;
/** 엔딩 도장이 찍히는 시점(승리/패배 팡파르 안에서, 시안의 순서와 같다). */
const ENDING_STAMP_DELAY = { win: 0.38, lose: 0.66 } as const;

function clamp(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** 저장된 JSON을 안전하게 설정으로 바꾼다. 깨진 값은 기본값으로 둔다. */
export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof SoundSettings, unknown>>;
    const bgm = BGM_CHOICES.includes(data.bgm as BgmChoice) ? (data.bgm as BgmChoice) : DEFAULT_SOUND_SETTINGS.bgm;
    return {
      bgm,
      bgmVolume: clamp(data.bgmVolume, DEFAULT_SOUND_SETTINGS.bgmVolume),
      sfxOn: typeof data.sfxOn === 'boolean' ? data.sfxOn : DEFAULT_SOUND_SETTINGS.sfxOn,
      sfxVolume: clamp(data.sfxVolume, DEFAULT_SOUND_SETTINGS.sfxVolume),
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

function defaultCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface Sound {
  /** 첫 사용자 입력에서 부른다. AudioContext를 만들고(이미 있으면 resume) 대기 중인 BGM을 시작한다. */
  unlock: () => void;
  hasContext: () => boolean;
  getSettings: () => SoundSettings;
  updateSettings: (patch: Partial<SoundSettings>) => void;
  subscribe: (listener: () => void) => () => void;
  setScene: (scene: SoundScene) => void;
  /** 표 공개 연출 동안 BGM을 크게 줄인다. */
  setDuck: (on: boolean) => void;
  /** 엔딩이 열려 있으면 BGM을 멈춘다. */
  setEnding: (on: boolean) => void;
  play: (name: SfxName, delaySeconds?: number) => void;
  /** 카드 도착음: 겹치면 ARRIVE_GAP_SECONDS 간격으로 밀어서 낸다. */
  playArrive: () => void;
  /** 엔딩 팡파르 + 도장. */
  playEnding: (success: boolean) => void;
  /** 이름 있는 현재 BGM(테스트·진단용). 없으면 null. */
  currentBgm: () => BgmName | null;
}

export function createSound(options: SoundOptions = {}): Sound {
  const createContext = options.createContext ?? defaultCreateContext;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;

  const random = options.random ?? Math.random;
  let settings: SoundSettings = (() => {
    try {
      const saved = storage?.getItem(SOUND_STORAGE_KEY) ?? null;
      if (saved) return parseSoundSettings(saved);
      const legacy = parseSoundSettings(storage?.getItem(LEGACY_SOUND_STORAGE_KEY) ?? null);
      return { ...legacy, bgm: DEFAULT_SOUND_SETTINGS.bgm };
    } catch {
      return { ...DEFAULT_SOUND_SETTINGS };
    }
  })();
  /** 랜덤 모드에서 이번 체험에 고른 곡. 체험이 끝나면(scene.playing false) 비운다. */
  let randomPick: BgmName | null = null;
  /** 실제로 마지막에 재생한 곡(랜덤·고정 모두). 랜덤은 이 곡을 피해 고른다(PR #21 Codex P2). */
  let lastPlayedBgm: BgmName | null = (() => {
    try {
      const saved = storage?.getItem(LAST_BGM_STORAGE_KEY) ?? null;
      return BGM_NAMES.includes(saved as BgmName) ? (saved as BgmName) : null;
    } catch {
      return null;
    }
  })();
  let ctx: AudioContext | null = null;
  let synth: SynthEngine | null = null;
  let unavailable = false;
  let scene: SoundScene = { playing: false, low: false };
  let duck = false;
  let ending = false;
  let bgm: BgmHandle | null = null;
  let arriveCursor = 0;
  const listeners = new Set<() => void>();

  function targetLevel(): number {
    return duck ? LEVEL_DUCK : scene.low ? LEVEL_LOW : LEVEL_NORMAL;
  }

  function applyVolumes(): void {
    synth?.setVolumes(settings.bgmVolume / 100, settings.sfxVolume / 100);
  }

  function applyLevel(): void {
    if (!bgm || !ctx) return;
    // 줄일 때는 빠르게, 되돌릴 때는 천천히(시안의 덕킹과 같은 시정수).
    bgm.level.gain.setTargetAtTime(targetLevel(), ctx.currentTime, duck ? 0.15 : 0.6);
  }

  function syncBgm(): void {
    if (!ctx || !synth) return;
    let want: BgmName | null = null;
    if (scene.playing && !ending && settings.bgm !== 'off') {
      if (settings.bgm === 'random') {
        if (!randomPick) {
          randomPick = pickRandomBgm(lastPlayedBgm, random);
        }
        want = randomPick;
      } else {
        want = settings.bgm;
      }
    }
    if (bgm && bgm.name !== want) {
      bgm.stop();
      bgm = null;
    }
    if (want && !bgm) {
      bgm = synth.startBgm(want);
      lastPlayedBgm = want;
      try {
        storage?.setItem(LAST_BGM_STORAGE_KEY, want);
      } catch {
        // 저장소를 못 쓰면 이번 페이지 안에서만 기억한다.
      }
    }
    applyLevel();
  }

  function emit(): void {
    listeners.forEach((listener) => listener());
  }

  return {
    unlock() {
      if (unavailable) return;
      if (!ctx) {
        let created: AudioContext | null = null;
        try {
          created = createContext();
        } catch {
          created = null;
        }
        if (!created) {
          unavailable = true;
          return;
        }
        ctx = created;
        synth = createSynth(created);
        applyVolumes();
      }
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      syncBgm();
    },
    hasContext: () => ctx !== null,
    getSettings: () => settings,
    updateSettings(patch) {
      settings = {
        bgm: patch.bgm ?? settings.bgm,
        bgmVolume: clamp(patch.bgmVolume, settings.bgmVolume),
        sfxOn: patch.sfxOn ?? settings.sfxOn,
        sfxVolume: clamp(patch.sfxVolume, settings.sfxVolume),
      };
      try {
        storage?.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // 저장소에 쓸 수 없으면 이번 화면 동안만 유지한다.
      }
      applyVolumes();
      syncBgm();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setScene(next) {
      if (next.playing === scene.playing && next.low === scene.low) return;
      // 체험이 끝나면(처음 화면) 랜덤 곡을 비워 다음 체험에서 새로 고른다.
      if (!next.playing) randomPick = null;
      scene = next;
      syncBgm();
    },
    setDuck(on) {
      if (duck === on) return;
      duck = on;
      applyLevel();
    },
    setEnding(on) {
      if (ending === on) return;
      ending = on;
      syncBgm();
    },
    play(name, delaySeconds = 0) {
      if (!synth || !settings.sfxOn) return;
      synth.playSfx(name, delaySeconds);
    },
    playArrive() {
      if (!synth || !ctx || !settings.sfxOn) return;
      const now = ctx.currentTime;
      const at = Math.max(now, arriveCursor);
      arriveCursor = at + ARRIVE_GAP_SECONDS;
      synth.playSfx('arriveA', at - now);
    },
    playEnding(success) {
      if (!synth || !settings.sfxOn) return;
      synth.playSfx(success ? 'winA' : 'loseA');
      synth.playSfx('stamp', success ? ENDING_STAMP_DELAY.win : ENDING_STAMP_DELAY.lose);
    },
    currentBgm: () => bgm?.name ?? null,
  };
}

/** 앱 전체가 쓰는 하나의 소리 컨트롤러. */
export const sound: Sound = createSound();
