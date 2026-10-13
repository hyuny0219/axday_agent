// 가짜 AudioContext(T128 테스트용): 만든 노드와 시작된 소리 수를 센다.

interface FakeParam {
  value: number;
  calls: Array<{ kind: string; value: number }>;
  setValueAtTime: (v: number) => void;
  exponentialRampToValueAtTime: (v: number) => void;
  setTargetAtTime: (v: number) => void;
}

function param(initial = 0): FakeParam {
  const p: FakeParam = {
    value: initial,
    calls: [],
    setValueAtTime: (v) => p.calls.push({ kind: 'set', value: v }),
    exponentialRampToValueAtTime: (v) => p.calls.push({ kind: 'ramp', value: v }),
    setTargetAtTime: (v) => p.calls.push({ kind: 'target', value: v }),
  };
  return p;
}

export interface FakeContext {
  ctx: AudioContext;
  gains: Array<{ gain: FakeParam; disconnected: boolean }>;
  started: { oscillators: number; noises: number };
  /** 오실레이터 주파수가 예약된 (값, 시각) 기록. */
  freqSets: Array<{ value: number; time: number }>;
  state: { value: 'running' | 'suspended'; resumeCalls: number };
}

export function createFakeContext(): FakeContext {
  const gains: FakeContext['gains'] = [];
  const started = { oscillators: 0, noises: 0 };
  const freqSets: Array<{ value: number; time: number }> = [];
  const state = { value: 'suspended' as 'running' | 'suspended', resumeCalls: 0 };
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    get state() {
      return state.value;
    },
    resume: async () => {
      state.resumeCalls += 1;
      state.value = 'running';
    },
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), ratio: param() }),
    createGain: () => {
      const entry = { ...node(), gain: param(1), disconnected: false };
      entry.disconnect = () => {
        entry.disconnected = true;
      };
      gains.push(entry);
      return entry;
    },
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      start: () => {
        started.noises += 1;
      },
      stop: () => undefined,
    }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', Q: param(), frequency: param() }),
    createOscillator: () => ({
      ...node(),
      type: 'sine',
      frequency: Object.assign(param(), {
        setValueAtTime: (value: number, time: number) => {
          freqSets.push({ value, time });
        },
      }),
      detune: param(),
      start: () => {
        started.oscillators += 1;
      },
      stop: () => undefined,
    }),
  } as unknown as AudioContext;
  return { ctx, gains, started, freqSets, state };
}

export function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}
