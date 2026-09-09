// 대기 화면: 큰 제목 + 부제 + 단일 CTA. CLAUDE_IMPLEMENTATION.md 3장 ATTRACT 행과
// 5장 "네트워크가 없으면 모두 scripted" 절의 '사전 구성 시뮬레이션' 표기를 따른다.

import '../../styles/screens/attract.css';

export interface AttractScreenProps {
  onStart: () => void;
}

export function AttractScreen({ onStart }: AttractScreenProps) {
  return (
    <section className="screen attract-screen">
      <p className="attract-screen__badge">사전 구성 시뮬레이션</p>
      <h1 className="attract-screen__title">BOARDROOM 2026</h1>
      <p className="attract-screen__subtitle">오늘 당신이 이사회의 한 자리를 맡습니다</p>
      <button type="button" className="cta" onClick={onStart}>
        체험 시작
      </button>
    </section>
  );
}
