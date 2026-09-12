import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  // 두 서버를 함께 띄운다: mock board 서버(8787, MODEL_PROVIDER=mock)와 vite preview
  // (4173, /api를 8787로 프록시). 기존 28개 spec은 이 mock 서버가 떠 있어도 각자
  // `?mode=scripted`로 scripted 경로를 강제해 영향을 받지 않는다(T30).
  webServer: [
    {
      command: 'MODEL_PROVIDER=mock PORT=8787 npm run server',
      url: 'http://localhost:8787/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'desktop-1080',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'desktop-720',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
