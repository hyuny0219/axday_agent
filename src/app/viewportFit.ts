// 화면 맞춤 축소(T51, DESIGN_SPEC.md v1.0 6절 "조종석 배치와 무스크롤 규칙" 보강).
// 설계 크기(1200×700)보다 조금 작은 뷰포트(예: 노트북 창 모드)에서도 조종석 2열 배치를
// 유지하기 위해 CSS transform: scale()의 배율을 계산하는 순수 함수. AppShell이 resize를
// 관찰해 이 함수로 다시 계산하고 결과를 CSS 변수(--app-scale)와 data 속성으로 반영한다
// (렌더 루프·타이머 없음).
//
// - scale = min(vw/1200, vh/700), 1을 넘겨 확대하지 않는다(1920×1080·1280×720은
//   'natural'로 기존 그대로).
// - scale < 0.85(56px 클릭 목표가 약 48px로 줄어드는 하한)면 축소를 쓰지 않고 기존
//   세로 1열 + 페이지 스크롤 경로('reflow', shell.css의 max-height:699px/max-width:1199px
//   미디어 쿼리)로 넘긴다. 200% 확대(960×540)는 반드시 이 경로로 가야 한다.

export const DESIGN_WIDTH = 1200;
export const DESIGN_HEIGHT = 700;
export const MIN_SCALE = 0.85;

export type ViewportFitMode = 'natural' | 'scale' | 'reflow';

export interface ViewportFit {
  mode: ViewportFitMode;
  scale: number;
}

/** 뷰포트 폭·높이(px)에서 축소 모드와 배율을 계산한다. */
export function computeViewportFit(width: number, height: number): ViewportFit {
  const rawScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  if (rawScale >= 1) {
    return { mode: 'natural', scale: 1 };
  }
  if (rawScale >= MIN_SCALE) {
    return { mode: 'scale', scale: rawScale };
  }
  return { mode: 'reflow', scale: 1 };
}
