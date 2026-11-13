import { defineConfig, devices } from '@playwright/test';

const mockPort = 3100;
const webPort = 4173;
const env = {
  FLEET_E2E_PORT: String(mockPort),
  FLEET_E2E_WEB_PORT: String(webPort),
};

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-server.mjs',
      env,
      url: `http://127.0.0.1:${mockPort}/api/routes`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx vite --config e2e/vite.config.mts',
      env,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
