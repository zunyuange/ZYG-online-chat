import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Usage:
 * - npx playwright test                    # Run all E2E tests
 * - npx playwright test --ui               # Run with UI mode
 * - npx playwright test --debug            # Debug mode with inspector
 * - npx playwright test --project=chromium # Run on specific browser
 * - npx playwright codegen                 # Generate test code by recording
 *
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test files pattern
  testMatch: '**/*.spec.ts',

  // Timeout per test (default 30s)
  timeout: 30 * 1000,

  // Expect timeout (assertions)
  expect: {
    timeout: 5 * 1000,
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // 并发限制：最多同时创建3个浏览器实例，避免资源占用过高
  workers: 3,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report/html' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  // ⚠️ IMPORTANT: Artifact directories configuration
  // All test artifacts are stored in separate directories under playwright-artifacts/
  // Screenshots: playwright-artifacts/screenshots/
  // Videos: playwright-artifacts/videos/
  // Traces: playwright-artifacts/traces/
  // Downloads: playwright-artifacts/downloads/
  outputDir: 'playwright-artifacts',

  // Shared settings for all tests
  use: {
    // Base URL for tests - use in page.goto('/')
    baseURL: 'http://localhost:3010',

    // Collect trace when retrying the failed test
    // Trace files stored in: playwright-artifacts/traces/
    trace: 'on-first-retry',

    // Screenshot on failure
    // Screenshots stored in: playwright-artifacts/screenshots/
    screenshot: 'only-on-failure',

    // Video on failure
    // Videos stored in: playwright-artifacts/videos/
    video: 'retain-on-failure',

    // Browser locale
    locale: 'zh-CN',

    // Timezone
    timezoneId: 'Asia/Shanghai',

    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Projects define different browser configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 指定系统自带浏览器可执行文件路径
        launchOptions: {
          executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
