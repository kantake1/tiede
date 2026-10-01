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
  projects: [
    { name: 'chromium', testIgnore: 'mobile.e2e.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // スマホ幅 (#48)。App Check を強制するとプレビュー URL が使えないため、ここでモバイル表示を確かめる
    { name: 'iphone', testMatch: 'mobile.e2e.ts', use: { ...devices['iPhone 13'] } },
    { name: 'android', testMatch: 'mobile.e2e.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx vite --mode emulator --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
  },
})
