// 코드 합성 엔진(T128). 승인된 소리 시안의 tone/noise/kick, BGM 3곡, 효과음 9종을 그대로 옮겼다.
// 음색·음높이·리듬·BGM 대비 효과음 음량 비율을 바꾸지 않는다. 외부 음원 파일은 쓰지 않는다.
// AudioContext는 밖에서 주입한다(첫 사용자 입력에서 sound.ts가 만든다).

export type BgmName = 'tension' | 'pulse' | 'piano';
export type SfxName =
  | 'clickA'
  | 'pickA'
  | 'sendA'
  | 'arriveA'
  | 'revealB'
  | 'stamp'
  | 'winA'
  | 'loseA'
  | 'tick';

export const BGM_NAMES: readonly BgmName[] = ['tension', 'pulse', 'piano'];

interface ToneOptions {
  type?: OscillatorType;
  glide?: number;
  detune?: number;
  gain?: number;
  attack?: number;
  release?: number;
  filter?: number;
}

interface NoiseOptions {
  ftype?: BiquadFilterType;
  q?: number;
  freq?: number;
  sweep?: number;
  gain?: number;
  attack?: number;
}

/** 계이름 → 주파수(Hz). */
const N = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F2: 87.31, F3: 174.61, G2: 98, G3: 196, A3: 220,
  B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, C5: 523.25, E5: 659.25,
} as const;
const CHORDS: ReadonlyArray<readonly [number, number, number]> = [
  [N.A3, N.C4, N.E4],
  [N.F3, N.A3, N.C4],
  [N.C4, N.E4, N.G4],
  [N.G3, N.B3, N.D4],
];

interface TrackState {
  stop?: () => void;
  osc?: OscillatorNode[];
}

export interface BgmTrack {
  bpm: number;
}

export interface BgmHandle {
  name: BgmName;
  /** 트랙 전체 음량(0~1 배율). 덕킹·장면별 음량에 쓴다. */
  level: GainNode;
  /** 서서히 줄이며 멈춘다. */
  stop: () => void;
}

export interface SynthEngine {
  setVolumes: (bgm: number, sfx: number) => void;
  playSfx: (name: SfxName, delaySeconds?: number) => void;
  startBgm: (name: BgmName) => BgmHandle;
}

export function createSynth(ctx: AudioContext): SynthEngine {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const bgmBus = ctx.createGain();
  const sfxBus = ctx.createGain();
  bgmBus.connect(master);
  sfxBus.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;

  function tone(dest: AudioNode, freq: number, t: number, dur: number, o: ToneOptions = {}): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.2;
    const a = o.attack ?? 0.005;
    const r = o.release ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur - r), r / 3);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + r * 2 + 0.05);
  }

  function noise(dest: AudioNode, t: number, dur: number, o: NoiseOptions = {}): void {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    const g = ctx.createGain();
    const peak = o.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function kick(dest: AudioNode, t: number, g = 0.5, from = 90, to = 40): void {
    tone(dest, from, t, 0.28, { glide: to, gain: g, attack: 0.002, release: 0.2 });
  }

  // ---------- BGM ----------
  interface TrackDef extends BgmTrack {
    start?: (out: AudioNode) => TrackState;
    step: (i: number, t: number, out: AudioNode, st: TrackState) => void;
  }

  const TRACKS: Record<BgmName, TrackDef> = {
    tension: {
      bpm: 64,
      start(out) {
        // 저음 드론: 살짝 어긋난 두 톱니파 → 천천히 숨 쉬는 저역 필터
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 260;
        f.Q.value = 6;
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 0.07;
        lg.gain.value = 120;
        lfo.connect(lg);
        lg.connect(f.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.16, ctx.currentTime, 1.2);
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o1.frequency.value = 55;
        o2.frequency.value = 55;
        o2.detune.value = 9;
        o1.connect(f);
        o2.connect(f);
        f.connect(g);
        g.connect(out);
        [o1, o2, lfo].forEach((o) => o.start());
        return {
          stop: () =>
            [o1, o2, lfo].forEach((o) => {
              try {
                o.stop();
              } catch {
                // 이미 멈춘 오실레이터는 무시한다.
              }
            }),
          osc: [o1, o2],
        };
      },
      step(i, t, out, st) {
        const bar = Math.floor(i / 16) % 4;
        if (i % 16 === 0) {
          const root = [55, 43.65, 49, 41.2][bar] ?? 55;
          st.osc?.forEach((o) => o.frequency.setTargetAtTime(root, t, 0.6));
        }
        if (i % 16 === 0) kick(out, t, 0.42, 70, 38);
        if (i % 16 === 3) kick(out, t, 0.24, 66, 38);
        if (i % 64 === 40) {
          tone(out, 880, t, 2.4, { gain: 0.05, attack: 0.01, release: 2 });
          tone(out, 1318.5, t, 2.4, { gain: 0.025, attack: 0.01, release: 2 });
        }
        if (i % 32 === 24) {
          tone(out, CHORDS[bar]![0] * 2, t, 1.6, { type: 'triangle', gain: 0.03, attack: 0.4, release: 1.2 });
        }
        if (i % 8 === 4) noise(out, t, 0.05, { ftype: 'highpass', freq: 8000, gain: 0.025 });
      },
    },
    pulse: {
      bpm: 104,
      step(i, t, out) {
        const bar = Math.floor(i / 16) % 4;
        const ch = CHORDS[bar]!;
        const pat = [0, 1, 2, 1, 0, 2, 1, 2];
        tone(out, ch[pat[i % 8]!]! * (i % 16 >= 8 ? 2 : 1), t, 0.12, {
          type: 'square',
          gain: 0.045,
          filter: 1800,
          release: 0.08,
        });
        if (i % 4 === 0) {
          tone(out, [N.A2, N.F2, 65.41, N.G2][bar]!, t, 0.32, { type: 'sawtooth', gain: 0.11, filter: 500, release: 0.15 });
        }
        if (i % 4 === 2) noise(out, t, 0.04, { ftype: 'highpass', freq: 7000, gain: 0.06 });
        if (i % 16 === 0) kick(out, t, 0.4);
        if (i % 16 === 8) noise(out, t, 0.12, { freq: 1800, q: 0.8, gain: 0.12 });
      },
    },
    piano: {
      bpm: 76,
      step(i, t, out) {
        const bar = Math.floor(i / 16) % 4;
        const ch = CHORDS[bar]!;
        const map: Record<number, number> = {
          0: ch[0] / 2,
          3: ch[1],
          6: ch[2],
          8: ch[1],
          11: ch[2] * 2 > 700 ? ch[0] * 2 : ch[2],
          14: ch[1],
        };
        const s = i % 16;
        const freq = map[s];
        if (freq) {
          tone(out, freq, t, 1.4, { type: 'triangle', gain: 0.11, attack: 0.004, release: 1.2 });
          tone(out, freq * 2, t, 0.8, { type: 'sine', gain: 0.025, attack: 0.004, release: 0.7 });
        }
        if (s === 0) ch.forEach((f) => tone(out, f, t, 3, { type: 'sine', gain: 0.035, attack: 0.6, release: 1.5 }));
      },
    },
  };

  function startBgm(name: BgmName): BgmHandle {
    const tr = TRACKS[name];
    const level = ctx.createGain();
    level.gain.value = 1;
    level.connect(bgmBus);
    const state: TrackState = tr.start ? tr.start(level) : {};
    let step = 0;
    let next = ctx.currentTime + 0.08;
    const dt = 60 / tr.bpm / 4;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.15) {
        tr.step(step, next, level, state);
        step += 1;
        next += dt;
      }
    }, 25);
    return {
      name,
      level,
      stop: () => {
        clearInterval(timer);
        level.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
        setTimeout(() => {
          state.stop?.();
          level.disconnect();
        }, 1200);
      },
    };
  }

  // ---------- 효과음 ----------
  const SFX: Record<SfxName, (t: number) => void> = {
    clickA: (t) => {
      noise(sfxBus, t, 0.035, { freq: 3500, q: 2, gain: 0.35 });
      tone(sfxBus, 1800, t, 0.02, { type: 'square', gain: 0.04, release: 0.01 });
    },
    pickA: (t) => {
      noise(sfxBus, t, 0.22, { freq: 900, sweep: 4200, q: 0.7, gain: 0.22, attack: 0.04 });
    },
    sendA: (t) => {
      noise(sfxBus, t, 0.35, { freq: 600, sweep: 5000, q: 0.6, gain: 0.25, attack: 0.08 });
      tone(sfxBus, 660, t + 0.28, 0.2, { gain: 0.08 });
      tone(sfxBus, 990, t + 0.36, 0.3, { gain: 0.07 });
    },
    arriveA: (t) => {
      tone(sfxBus, 784, t, 0.25, { gain: 0.13 });
      tone(sfxBus, 1046.5, t + 0.11, 0.4, { gain: 0.12 });
    },
    revealB: (t) => {
      noise(sfxBus, t, 0.08, { freq: 1500, sweep: 3500, q: 1, gain: 0.3 });
      noise(sfxBus, t + 0.09, 0.05, { freq: 2500, q: 1.5, gain: 0.25 });
    },
    stamp: (t) => {
      kick(sfxBus, t, 0.9, 140, 35);
      noise(sfxBus, t, 0.25, { ftype: 'lowpass', freq: 1200, gain: 0.45 });
      noise(sfxBus, t + 0.005, 0.06, { freq: 3000, q: 0.7, gain: 0.2 });
    },
    winA: (t) => {
      [N.C4, N.E4, N.G4].forEach((f, k) =>
        tone(sfxBus, f, t + k * 0.12, 0.3, { type: 'square', gain: 0.06, filter: 2400 }),
      );
      [N.C5, N.E5, 783.99].forEach((f) =>
        tone(sfxBus, f, t + 0.38, 1.4, { type: 'triangle', gain: 0.09, attack: 0.01, release: 1.1 }),
      );
      kick(sfxBus, t + 0.38, 0.5);
      noise(sfxBus, t + 0.38, 0.9, { ftype: 'highpass', freq: 6000, gain: 0.06, attack: 0.01 });
    },
    loseA: (t) => {
      [N.E4, N.D4, N.C4].forEach((f, k) =>
        tone(sfxBus, f, t + k * 0.22, 0.4, { type: 'triangle', gain: 0.1, release: 0.25 }),
      );
      tone(sfxBus, N.A3, t + 0.66, 1.4, { type: 'triangle', gain: 0.1, release: 1.1 });
    },
    // 시안은 3초 연속 재생이었지만 앱은 1초마다 한 번씩 부른다.
    tick: (t) => {
      noise(sfxBus, t, 0.03, { freq: 4500, q: 4, gain: 0.3 });
      tone(sfxBus, 2200, t, 0.03, { gain: 0.05, release: 0.02 });
    },
  };

  return {
    setVolumes(bgm, sfx) {
      // 시안과 같은 곡선: 슬라이더 0~1의 제곱, BGM은 0.6배.
      bgmBus.gain.setTargetAtTime(bgm * bgm * 0.6, ctx.currentTime, 0.05);
      sfxBus.gain.setTargetAtTime(sfx * sfx, ctx.currentTime, 0.05);
    },
    playSfx(name, delaySeconds = 0) {
      SFX[name](ctx.currentTime + 0.02 + delaySeconds);
    },
    startBgm,
  };
}
