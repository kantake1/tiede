import { defineConfig, devices } from '@playwright/test'

// `npm run e2e` で Firestore エミュレータを起動してから実行する (本番に触れない)
export default defineConfig({
  testDir: 'e2e',
  // vitest (*.test.ts / *.spec.ts) に拾わせない
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5180', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: 'npx vite --mode emulator --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
  },
})
