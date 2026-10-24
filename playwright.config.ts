/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

// headless Chrome has no GPU: WebGL runs on SwiftShader, which Chrome now enables only on request
const launchOptions = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173/demo-configurateur/', trace: 'retain-on-failure' },
  // CI downloads Playwright's Chromium; locally the installed Chrome is enough
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome', launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome', launchOptions } },
  ],
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173/demo-configurateur/', reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
