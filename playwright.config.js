import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_URL || 'http://127.0.0.1:3000',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {},
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 30000 },
});
