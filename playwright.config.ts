import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 5000, // Fail any test after 5s
  expect: {
    timeout: 1000, // Fail assertions after 1s
  },
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'firebase emulators:start --only firestore,auth --project demo-vvta',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: false,
      timeout: 60000, // 60s max for Firebase
    },
    {
      command: 'ng serve --configuration e2e --port 4200 --host 127.0.0.1',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 30000, // 30s max for Angular
    },
  ],
});
