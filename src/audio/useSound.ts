// 소리 설정을 React에서 읽고 바꾸는 훅(T128).

import { useSyncExternalStore } from 'react';
import { sound, type Sound, type SoundSettings } from './sound';

export function useSoundSettings(target: Sound = sound): [SoundSettings, Sound['updateSettings']] {
  const settings = useSyncExternalStore(target.subscribe, target.getSettings, target.getSettings);
  return [settings, target.updateSettings];
}
