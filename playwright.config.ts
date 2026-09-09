import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'PORT=4101 npm run server',
      url: 'http://127.0.0.1:4101/openapi.yaml',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'ZESTIQ_DEV_API_TARGET=http://127.0.0.1:4101 npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
