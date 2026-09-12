import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 로컬·Render(server/static.ts가 같은 오리진에서 서빙)는 '/'. GitHub Pages(서버 없이
  // <owner>.github.io/<repo>/ 하위 경로로 서빙)는 빌드 시 VITE_BASE=/<repo>/를 넘긴다
  // (.github/workflows/pages.yml). 기본값 '/'는 기존 동작을 바꾸지 않는다.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // e2e/live.spec.ts가 쓰는 `npm run preview`용 프록시(T30). live 어댑터(src/services/
  // boardAgents/live.ts)는 상대 경로 /api/...로만 fetch하므로, preview 서버가 8787의
  // mock 서버(MODEL_PROVIDER=mock)로 그대로 넘겨줘야 브라우저가 같은 오리진에서 호출할 수
  // 있다. dev 서버(`npm run dev`)는 이 카드 범위 밖이라 건드리지 않는다.
  preview: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'jsdom',
    // tests/server는 서버 코드(node:http 등)를 다루므로 jsdom이 아니라 node 환경에서 돈다.
    environmentMatchGlobs: [['tests/server/**', 'node']],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/server/**/*.test.ts'],
  },
});
