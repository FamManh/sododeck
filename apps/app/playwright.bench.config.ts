import { defineConfig, devices } from '@playwright/test';

/** Performance benchmark (not part of CI gating). `pnpm bench` from the repo root. */
export default defineConfig({
  testDir: './bench',
  testMatch: '*.bench.ts',
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
