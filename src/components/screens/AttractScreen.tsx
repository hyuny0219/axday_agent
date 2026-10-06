// 대기(ATTRACT) 화면(T71, docs/design/mockups/S0_Attract.html 시안대로, 미리보기
// preview/S0_Attract.png). 본문 전체가 무대 사진 한 장(시안 글로우 테두리 안에 스캔라인·
// 상하 그라데이션·28px 브래킷)이고, 가운데 세로 블록(모드 배지 → 큰 제목 → 부제 →
// 사건 번호 줄) 위에 좌하단 CTA·우상단 TOP SECRET 도장·우하단 임원 로스터를 올린다.
// T30에서 감지된 진행 방식(mode.ts)에 따라 가운데 모드 배지 문구를 live/scripted로
// 바꾼다(시안 "LIVE · 실제 임원 에이전트 · 4분 이사회" / scripted는 "사전 구성
// 시뮬레이션"). 서버 확인이 끝나기 전에는 기본값(scripted)을 보여준다.

import type { SessionMode } from '../../domain/types';
import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/attract.css';

export interface AttractScreenProps {
  mode: SessionMode;
  onStart: () => void;
  /** 서버 가용성 확인(live/scripted 판정)이 끝나기 전에는 시작을 막는다(App.tsx). */
  startDisabled?: boolean;
}

const MODE_BADGE_TEXT: Record<SessionMode, string> = {
  live: '실시간 · 실제 임원 에이전트 · 4분 이사회',
  scripted: '사전 구성 시뮬레이션',
};

export function AttractScreen({ mode, onStart, startDisabled = false }: AttractScreenProps) {
  return (
    <section className="screen attract-screen">
      <div className="attract-screen__stage">
        <img src={stageRender} alt="" className="attract-screen__bg" />
        <div className="attract-screen__scanlines" aria-hidden="true" />
        <div className="attract-screen__vignette" aria-hidden="true" />
        <div className="attract-screen__bracket attract-screen__bracket--tl" aria-hidden="true" />
        <div className="attract-screen__bracket attract-screen__bracket--tr" aria-hidden="true" />
        <div className="attract-screen__bracket attract-screen__bracket--bl" aria-hidden="true" />
        <div className="attract-screen__bracket attract-screen__bracket--br" aria-hidden="true" />
        <div className="attract-screen__readout" aria-hidden="true">
          <span>회의실 A</span>
          <span className="attract-screen__readout-dim">대기 중</span>
        </div>
        <span className="attract-screen__stamp" aria-hidden="true">
          극비
        </span>

        <div className="attract-screen__center">
          <p className="attract-screen__badge" data-testid="attract-mode-badge">
            {MODE_BADGE_TEXT[mode]}
          </p>
          <h1 className="attract-screen__title">BOARDROOM 2026</h1>
          <p className="attract-screen__subtitle">오늘 당신이 이사회의 한 자리를 맡습니다</p>
          <p className="attract-screen__case-file">사건 02 · 특별 이사 1석 공석</p>
        </div>

        <button
          type="button"
          className="cta attract-screen__cta"
          onClick={onStart}
          disabled={startDisabled}
          aria-busy={startDisabled || undefined}
          data-testid="attract-start"
        >
          체험 시작 ▶
        </button>

        <div className="attract-screen__roster" aria-hidden="true">
          <span>CEO</span>
          <span>CFO</span>
          <span>CAIO</span>
          <span>CISO</span>
          <span className="attract-screen__roster-you">+ 당신</span>
        </div>
      </div>
    </section>
  );
}
