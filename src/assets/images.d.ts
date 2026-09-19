// 번들 이미지 자산의 타입 선언. Vite가 정적 자산 import를 최종 URL 문자열로 바꿔주므로
// (vite/client의 asset 모듈 규칙), 여기서는 그 규칙만 TypeScript에 알려준다.
declare module '*.jpg' {
  const src: string;
  export default src;
}
