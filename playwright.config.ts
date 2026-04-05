import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '_generated/playwright/results.json' }],
    ['html', { outputFolder: '_generated/playwright/report', open: 'never' }]
  ],
  outputDir: '_generated/playwright/test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'off'
  },
  projects: [
    {
      name: 'desktop',
      grep: /\(Desktop\)$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 }
      }
    },
    {
      name: 'mobile',
      grep: /\(Mobile\)$/,
      use: {
        ...devices['Pixel 7']
      }
    }
  ],
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000/chat',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI
  }
})
