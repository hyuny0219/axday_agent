// 대기 화면: 큰 제목 + 부제 + 단일 CTA. CLAUDE_IMPLEMENTATION.md 3장 ATTRACT 행과
// 5장 "네트워크가 없으면 모두 scripted" 절의 '사전 구성 시뮬레이션' 표기를 따른다.
// T30에서 감지된 진행 방식(mode.ts)에 따라 배지 문구를 live/scripted로 바꾼다. 서버
// 확인이 끝나기 전에는 기본값(scripted)을 보여준다.

import type { SessionMode } from '../../domain/types';
import '../../styles/screens/attract.css';

export interface AttractScreenProps {
  mode: SessionMode;
  onStart: () => void;
}

const MODE_BADGE_TEXT: Record<SessionMode, string> = {
  live: 'LIVE · 실제 임원 에이전트',
  scripted: '사전 구성 시뮬레이션',
};

export function AttractScreen({ mode, onStart }: AttractScreenProps) {
  return (
    <section className="screen attract-screen">
      <p className="attract-screen__badge" data-testid="attract-mode-badge">
        {MODE_BADGE_TEXT[mode]}
      </p>
      <h1 className="attract-screen__title">BOARDROOM 2026</h1>
      <p className="attract-screen__subtitle">오늘 당신이 이사회의 한 자리를 맡습니다</p>
      <button type="button" className="cta" onClick={onStart}>
        체험 시작
      </button>
    </section>
  );
}
