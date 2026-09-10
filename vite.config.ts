import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // tests/server는 서버 코드(node:http 등)를 다루므로 jsdom이 아니라 node 환경에서 돈다.
    environmentMatchGlobs: [['tests/server/**', 'node']],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/server/**/*.test.ts'],
  },
});
