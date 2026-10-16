// 소리 연결 지점(T128): 화면 컴포넌트를 거의 건드리지 않도록 한 곳에서 이어 준다.
//  - 첫 사용자 입력에서 AudioContext를 만든다(자동 재생 정책).
//  - 단계(session.stage)에 따라 BGM 장면을 알린다: ATTRACT는 무음, MOTION·VOTE는 조금 낮게.
//  - 주요 버튼 클릭음: 비활성이 아닌 `.cta`(보조·외곽선 제외)와 `data-sound`가 붙은 버튼.
//  - 임원 발언·반응 카드가 도착하는 순간(DOM에 새로 붙을 때)의 도착음. 지난 화면 보기(T126) 안에서
//    생기는 카드는 소리를 내지 않는다.
// 표 공개음·도장·엔딩음은 해당 화면이 sound를 직접 부른다.

import { useEffect } from 'react';
import { clickCueFor, countArrivals } from './cues';
import { sound, type Sound } from './sound';

const LOW_STAGES: ReadonlySet<string> = new Set(['MOTION', 'VOTE']);

export interface SoundHostProps {
  stage: string;
  target?: Sound;
}

export function SoundHost({ stage, target = sound }: SoundHostProps) {
  useEffect(() => {
    target.setScene({ playing: stage !== 'ATTRACT', low: LOW_STAGES.has(stage) });
  }, [stage, target]);

  useEffect(() => {
    const unlock = () => target.unlock();
    const onClick = (event: Event) => {
      target.unlock();
      const cue = clickCueFor(event.target);
      if (cue) target.play(cue);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', onClick, true);

    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              record.addedNodes.forEach((node) => {
                for (let i = countArrivals(node); i > 0; i -= 1) target.playArrive();
              });
            }
          });
    observer?.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', onClick, true);
      observer?.disconnect();
    };
  }, [target]);

  return null;
}
