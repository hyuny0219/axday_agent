// 대기(ATTRACT) 화면(T71, docs/design/mockups/S0_Attract.html 시안대로, 미리보기
// preview/S0_Attract.png). 본문 전체가 무대 사진 한 장(시안 글로우 테두리 안에 스캔라인·
// 상하 그라데이션·28px 브래킷)이고, 가운데 세로 블록(모드 배지 → 큰 제목 → 부제 →
// 사건 번호 줄) 위에 좌하단 CTA·우상단 TOP SECRET 도장·우하단 임원 로스터를 올린다.
// T30에서는 감지된 진행 방식(mode.ts)에 따라 가운데 배지 문구를 live/scripted로
// 바꿨으나, T86(2026-10-07 사용자 — "실시간 표시는 제거해줘", 이어서 "사전 구성
// 시뮬레이션 표시도 빼줘")에서 모드와 무관한 고정 문구 하나로 바꿨다(모드 확인은
// 운영 메뉴에서만).

import stageRender from '../../assets/stage-render-01.jpg';
import '../../styles/screens/attract.css';

export interface AttractScreenProps {
  onStart: () => void;
  /** 서버 가용성 확인(live/scripted 판정)이 끝나기 전에는 시작을 막는다(App.tsx). */
  startDisabled?: boolean;
}

const ATTRACT_SUBTITLE = '4분 이사회';

export function AttractScreen({ onStart, startDisabled = false }: AttractScreenProps) {
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
        {/* T87(2026-10-07 사용자 — "붉은 상자 안의 글씨는 영어로, 더 비밀요원스럽다"):
            T83에서 한국어로 바꿨던 이 도장만 영문으로 되돌렸다. */}
        <span className="attract-screen__stamp" aria-hidden="true">
          TOP SECRET
        </span>

        <div className="attract-screen__center">
          <p className="attract-screen__badge" data-testid="attract-mode-badge">
            {ATTRACT_SUBTITLE}
          </p>
          <h1 className="attract-screen__title">BECOME A BOARD</h1>
          <p className="attract-screen__subtitle">오늘 당신이 이사회의 한 자리를 맡습니다</p>
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
