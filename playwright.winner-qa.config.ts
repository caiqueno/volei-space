import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'winner-qa.spec.ts',
  timeout: 50 * 60 * 1000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.WINNER_QA_BASE_URL || 'http://127.0.0.1:3001',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1800 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1800 } },
    },
  ],
})
