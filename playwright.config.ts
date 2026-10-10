import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, JWT_SECRET, WEBHOOK_SECRET } from './e2e/env'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 3001',
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      JWT_SECRET,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      INFINITEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      INFINITEPAY_API_KEY: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      NEXT_PUBLIC_SUPABASE_ALVO: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_HOSTS_PROIBIDOS: '',
      DATABASE_URL: '',
      DIRECT_URL: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      EMAIL_FROM: '',
      ADMIN_EMAIL: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
